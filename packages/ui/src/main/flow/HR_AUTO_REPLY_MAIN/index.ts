import { createHrReplyPolling, watchHrMessages, snapshotMatchesDueMessage } from '@geekgeekrun/utils/hr-reply-polling.mjs'
import { app } from 'electron'
import { initPuppeteer } from '@geekgeekrun/geek-auto-start-chat-with-boss/index.mjs'
import { readConfigFile, readStorageFile } from '@geekgeekrun/geek-auto-start-chat-with-boss/runtime-file-utils.mjs'
import { setDomainLocalStorage } from '@geekgeekrun/utils/puppeteer/local-storage.mjs'
import { sleep } from '@geekgeekrun/utils/sleep.mjs'
import { completes } from '@geekgeekrun/utils/gpt-request.mjs'
import { processHrMessage, hrReplyIsDue, requestsResume, isResumeInvitation, hrToolOptions, normalizeHrFriend } from '@geekgeekrun/utils/hr-auto-reply.mjs'
import { runHrAgent } from '@geekgeekrun/utils/hr-agent.mjs'
import { storageFilePath } from '@geekgeekrun/geek-auto-start-chat-with-boss/runtime-file-utils.mjs'
import { readHrConversation, isCurrentHrConversation, sendHrText, sendBossResume, readBossResumes, exchangeBossWechat, exchangeBossPhone } from '@geekgeekrun/utils/hr-auto-reply-browser.mjs'
import { readHrAutoReplyConfig, readHrAutoReplyRecords, saveHrAutoReplyRecord, verifyLocalHrResume, ensureHrResumeBinding } from '../../features/hr-auto-reply'
import { recordGptCompletionRequest, RequestSceneEnum } from '../../features/llm-request-log'
import { getLastUsedAndAvailableBrowser } from '../DOWNLOAD_DEPENDENCIES/utils/browser-history'
import { connectToDaemon } from '../OPEN_SETTING_WINDOW/connect-to-daemon'
import { checkShouldExit } from '../../utils/worker'
import initPublicIpc from '../../utils/initPublicIpc'
import { AUTO_CHAT_ERROR_EXIT_CODE } from '../../../common/enums/auto-start-chat'

async function generateReply(messages) {
  const model = (readConfigFile('llm.json') || []).find(item => item.enabled)
  if (!model) throw new Error('没有启用的大语言模型，本条未回复')
  const record: any = { providerCompleteApiUrl: model.providerCompleteApiUrl || model.provider, model: model.model, providerApiSecret: model.providerApiSecret, requestStartTime: new Date(), hasError: false, errorMessage: '', requestScene: RequestSceneEnum.hrAutoReply }
  try {
    const completion = await completes({ ...model, baseURL: model.providerCompleteApiUrl, apiKey: model.providerApiSecret, maxTokens: 800 }, messages)
    Object.assign(record, { completionTokens: completion.usage?.completion_tokens, promptTokens: completion.usage?.prompt_tokens, totalTokens: completion.usage?.total_tokens })
    return completion
  } catch (error: any) { record.hasError = true; record.errorMessage = error.message; throw error }
  finally {
    record.requestEndTime = new Date()
    try { await recordGptCompletionRequest(record) } catch (error) { console.error('HR回复模型用量记录失败', error) }
  }
}

export async function runEntry() {
  const workerRunStartedAt = Date.now()
  let sigtermReceived = false
  process.once('SIGTERM', () => { sigtermReceived = true })
  app.dock?.hide()
  await app.whenReady()
  app.on('window-all-closed', () => {})
  initPublicIpc()
  await connectToDaemon()
  let browser
  let exitCode = AUTO_CHAT_ERROR_EXIT_CODE.NORMAL
  try {
    const executable = await getLastUsedAndAvailableBrowser()
    console.log('HR回复：招聘浏览器配置已读取')
    if (!executable) throw new Error('未配置可用浏览器')
    process.env.PUPPETEER_EXECUTABLE_PATH = executable.executablePath
    const { puppeteer } = await initPuppeteer()
    console.log('HR回复：浏览器组件已加载')
    browser = await puppeteer.launch({ executablePath: executable.executablePath, headless: false, ignoreHTTPSErrors: true, defaultViewport: { width: 1440, height: 800 } })
    console.log('HR回复：招聘浏览器已打开')
    const initialPage = (await browser.pages())[0]
    const cookies = readStorageFile('boss-cookies.json') || []
    if (!cookies.length) throw new Error('BOSS登录已失效，请重新登录')
    await initialPage.setCookie(...cookies)
    await setDomainLocalStorage(browser, 'https://www.zhipin.com/desktop/', readStorageFile('boss-local-storage.json') || {})
    const page = await browser.newPage()
    await page.goto('https://www.zhipin.com/web/geek/chat', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForFunction(() => Array.isArray(document.querySelector('.main-wrap .chat-user')?.__vue__?.list), { timeout: 60000 })
    const records = new Set((await readHrAutoReplyRecords()).map(record => record.key))
    const startedAt = Date.now()
    const attempted = new Set<string>()
    const pending = new Map()
    const staleMessages = new Map<string, string>()
    const pollingOptions = { idleMinutes: 5, observeMinutes: 5, observeIntervalSeconds: 5 }
    const polling = createHrReplyPolling(pollingOptions)
    let scanLimit = (await readHrAutoReplyConfig()).scanLimit
    let rawLoadedCount = 0
    let friends: any[] = []
    const receive = (items: any[]) => {
      const sliced = items.slice(0, scanLimit)
      rawLoadedCount = sliced.length
      friends = sliced.map((raw, rawIndex) => ({ ...normalizeHrFriend(raw), rawIndex })).filter((item: any) => {
        const key = JSON.stringify([item.encryptBossId, item.encryptJobId])
        if (!staleMessages.has(key)) return true
        if (String(item.lastMessageId) === staleMessages.get(key)) return false
        staleMessages.delete(key)
        return true
      })
      for (const item of polling.observe(friends)) hrReplyIsDue(item, pending, 60)
    }
    const watching = await watchHrMessages(page, receive)
    if (!watching) console.warn('BOSS新消息监听不可用，按设置的空闲巡检间隔补查；发现消息后开始合并等待')
    while (!sigtermReceived && !await checkShouldExit() && !page.isClosed()) {
      const delayConfig = await readHrAutoReplyConfig()
      if (!delayConfig.enabled) break
      scanLimit = delayConfig.scanLimit
      pollingOptions.idleMinutes = delayConfig.idleScanMinutes
      pollingOptions.observeMinutes = delayConfig.observeMinutes
      pollingOptions.observeIntervalSeconds = delayConfig.observeIntervalSeconds
      friends = friends.filter((item: any) => (item.rawIndex ?? 0) < scanLimit)
      if (polling.shouldScan()) {
        for (let unchanged = 0; unchanged < 10 && !sigtermReceived && !await checkShouldExit();) {
          const items = await page.evaluate(() => document.querySelector('.main-wrap .chat-user')?.__vue__?.list || [])
          receive(items)
          if (items.length >= scanLimit || !items.length) break
          if (items.length) await page.evaluate(index => document.querySelector('.chat-content .user-list .user-list-content')?.__vue__?.scrollToIndex(index), items.length - 1)
          await sleep(1500)
          const count = await page.evaluate(() => document.querySelector('.main-wrap .chat-user')?.__vue__?.list?.length || 0)
          unchanged = count > items.length ? 0 : unchanged + 1
        }
        if (rawLoadedCount < scanLimit) console.warn(`HR回复：列表已加载${rawLoadedCount}条，未达到设置的${scanLimit}条；可能已到底或仍在加载，下次补查继续尝试`)
        if (rawLoadedCount > 0) await page.evaluate(index => document.querySelector('.chat-content .user-list .user-list-content')?.__vue__?.scrollToIndex(index), Math.min(scanLimit, rawLoadedCount) - 1)
      }
      const friend = friends.find(item => {
        const due = hrReplyIsDue(item, pending, delayConfig.replyDelaySeconds)
        const time = Number(item.lastTS || item.updateTime)
        return !item.lastIsSelf && (item.unreadCount > 0 || (time < 1e12 ? time * 1000 : time) >= startedAt) &&
          item.encryptBossId && item.encryptJobId && item.lastMessageId && !attempted.has(`${item.uniqueId}:${item.lastMessageId}`) && due
      })
      if (!friend) {
        await sleep(1000)
        continue
      }
      const attemptKey = `${friend.uniqueId}:${friend.lastMessageId}`
      await page.evaluate(index => document.querySelector('.chat-content .user-list .user-list-content')?.__vue__?.scrollToIndex(index), friend.rawIndex ?? friends.indexOf(friend))
      await sleep(500)
      const handle = await page.evaluateHandle(({ boss, job }) => [...document.querySelectorAll('.main-wrap .chat-user li[role=listitem]')].find(element =>
        element.__vue__?.source?.encryptBossId === boss && element.__vue__?.source?.encryptJobId === job
      ), { boss: friend.encryptBossId, job: friend.encryptJobId })
      const element = handle.asElement()
      if (!element) { await handle.dispose(); throw new Error('无法定位HR会话，已停止') }
      try { await element.click() } finally { await handle.dispose() }
      await page.waitForFunction(({ boss, job, mid }) => {
        const selected = document.querySelector('.chat-conversation')?.__vue__?.selectedFriend$
        const messages = document.querySelector('.message-content .chat-record')?.__vue__?.list$ || []
        return selected?.encryptBossId === boss && selected?.encryptJobId === job && messages.some(message => String(message.mid) === String(mid))
      }, { timeout: 15000 }, { boss: friend.encryptBossId, job: friend.encryptJobId, mid: friend.lastMessageId })
      const snapshot = await readHrConversation(page)
      const config = await readHrAutoReplyConfig()
      const last = snapshot.messages.at(-1)
      if (!snapshotMatchesDueMessage(friend, last)) {
        staleMessages.set(JSON.stringify([friend.encryptBossId, friend.encryptJobId]), String(friend.lastMessageId))
        if (last?.isSelf === false && last.mid) hrReplyIsDue({ ...friend, lastMessageId: last.mid, lastIsSelf: false }, pending, config.replyDelaySeconds)
        friends = friends.filter(item => item !== friend)
        continue
      }
      if (process.argv.includes('--resume-only') && !(last?.isSelf === false && (isResumeInvitation(last) || last?.messageType === 'text' && requestsResume(last.text)))) { attempted.add(attemptKey); continue }
      if (config.autoSendResume && last?.isSelf === false && (isResumeInvitation(last) || requestsResume(last?.text))) {
        try { config.resumeBinding = await ensureHrResumeBinding(config, await readBossResumes(page)) }
        catch (error: any) { config.resumeBinding = null; config.resumeBindingIssue = error.message }
      }
      const result = await processHrMessage({
        friend, history: snapshot.messages, config, records, save: saveHrAutoReplyRecord,
        runAgent: args => runHrAgent({ ...args, batchStartMid: pending.get(JSON.stringify([friend.encryptBossId, friend.encryptJobId]))?.firstMid, directory: storageFilePath, complete: generateReply }),
        isCurrent: () => isCurrentHrConversation(page, friend, snapshot.messages.at(-1)?.mid),
        send: async plan => {
          const tool = hrToolOptions.find(tool => tool.action === plan.action)
          const currentConfig = await readHrAutoReplyConfig()
          const inRange = await page.evaluate(({ boss, job, limit }) => (document.querySelector('.main-wrap .chat-user')?.__vue__?.list || []).slice(0, limit).some(item => item.encryptBossId === boss && item.encryptJobId === job), { boss: friend.encryptBossId, job: friend.encryptJobId, limit: currentConfig.scanLimit })
          if (!inRange) throw new Error('会话已移出扫描范围，本条未操作')
          if (!currentConfig.enabled) throw new Error('HR消息自动回复已关闭，未操作')
          if (tool && !currentConfig[tool.configKey]) throw new Error(`${tool.label}工具已关闭，未操作`)
          if (plan.action === 'wechat') return exchangeBossWechat(page, friend, last.mid, plan)
          if (plan.action === 'phone') return exchangeBossPhone(page, friend, last.mid, plan)
          if (plan.action !== 'resume') return sendHrText(page, friend, snapshot.messages.at(-1)?.mid, plan.text)
          await verifyLocalHrResume(config)
          return sendBossResume(page, friend, snapshot.messages.at(-1)?.mid, { invitation: plan.invitation, binding: config.resumeBinding })
        }
      })
      if (['replied', 'resume_sent', 'resume_requested', 'wechat_exchanged', 'wechat_requested', 'phone_exchanged', 'phone_requested'].includes(result?.status)) polling.replied()
      attempted.add(attemptKey)
      await sleep(1000)
    }
  } catch (error: any) {
    exitCode = AUTO_CHAT_ERROR_EXIT_CODE.LLM_UNAVAILABLE
    await saveHrAutoReplyRecord({ key: `task:${Date.now()}`, runStartedAt: workerRunStartedAt, at: new Date().toISOString(), status: 'failed', reason: error.message || String(error) })
    console.error('HR自动回复停止', error)
  } finally {
    await browser?.close().catch(() => {})
    // This code is explicitly excluded from automatic worker restarts.
    app.exit(exitCode)
  }
}

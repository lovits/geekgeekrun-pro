import { boundBossResume, bossResumeIdentity, hrToolOptions, isHrToolInvitation, requestsContact } from './hr-auto-reply.mjs'

export async function readBossResumes(page) {
  return page.evaluate(async () => {
    const response = await fetch('/wapi/zpgeek/resume/attachment/checkbox.json?from=2', { credentials: 'include' })
    if (!response.ok) throw new Error('读取BOSS附件失败，请检查登录状态')
    const data = await response.json()
    if (data.code !== 0 || !Array.isArray(data.zpData?.resumeList)) throw new Error(data.message || 'BOSS未返回有效附件列表')
    return data.zpData.resumeList.map(resume => ({ resumeId: String(resume.resumeId || resume.encryptId || ''), showName: resume.showName || resume.customName || resume.originalName || '', uploadTime: String(resume.uploadTime || ''), resumeSize: resume.resumeSize ?? '', resumeSizeDesc: resume.resumeSizeDesc || '', annexType: resume.annexType, restricted: !!resume.restricted }))
  })
}

export async function readHrConversation(page) {
  return page.evaluate(() => {
    const selected = document.querySelector('.chat-conversation')?.__vue__?.selectedFriend$
    const messages = document.querySelector('.message-content .chat-record')?.__vue__?.list$
    const conversation = document.querySelector('.chat-conversation .chat-im.chat-editor')?.__vue__?.conversation$
    if (!selected || !Array.isArray(messages)) throw new Error('无法读取当前BOSS会话')
    return { friend: { encryptBossId: selected.encryptBossId, encryptJobId: selected.encryptJobId }, messages: JSON.parse(JSON.stringify(messages)), requestResume: !!conversation?.requestResume, requestPhone: !!conversation?.requestPhone, requestWechat: !!conversation?.requestWeiXin }
  })
}

export async function isCurrentHrConversation(page, friend, mid) {
  const current = await readHrConversation(page)
  return current.friend.encryptBossId === friend.encryptBossId && current.friend.encryptJobId === friend.encryptJobId &&
    String(current.messages.at(-1)?.mid) === String(mid) && current.messages.at(-1)?.isSelf === false
}

async function clickVisible(page, selector, text, beforeClick) {
  const handle = await page.evaluateHandle((selector, text) => [...document.querySelectorAll(selector)].find(element =>
    element.getClientRects().length && (!text || [...element.childNodes].filter(node => node.nodeType === 3).map(node => node.textContent).join('').trim() === text || element.textContent?.trim() === text) &&
    !element.classList.contains('disabled') && !element.classList.contains('unable') && !element.disabled
  ), selector, text)
  const element = handle.asElement()
  if (!element) { await handle.dispose(); throw new Error('未找到可用的BOSS操作按钮，未继续操作') }
  try { beforeClick?.(); await element.click() } finally { await handle.dispose() }
}

async function acceptInvitation(page, mid) {
  const handle = await page.evaluateHandle(mid => {
    const item = [...document.querySelectorAll('.message-content [data-mid]')].find(element => element.getAttribute('data-mid') === String(mid))
    return [...(item?.querySelectorAll('button,a,.btn,.btn-v2,.card-btn') || [])].find(element => element.getClientRects().length &&
      /^(?:同意|接受)(?:交换(?:微信|电话)?)?$|^(?:同意发送|发送简历)$/.test(element.textContent?.trim() || '') && !element.classList.contains('disabled') && !element.disabled)
  }, mid)
  const button = handle.asElement()
  if (!button) { await handle.dispose(); throw new Error('邀请卡片没有可用的同意按钮，请人工查看') }
  try { await button.click() } finally { await handle.dispose() }
}

export async function sendHrText(page, friend, mid, text) {
  let sendAttempted = false
  try {
    if (!await isCurrentHrConversation(page, friend, mid)) return { status: 'superseded', reason: '发送前会话已变化，未发送' }
    const beforeIds = (await readHrConversation(page)).messages.map(message => String(message.mid))
    const input = await page.$('.chat-conversation .message-controls .chat-input')
    if (!input) throw new Error('未找到BOSS消息输入框')
    if (await input.evaluate(element => !!element.textContent?.trim())) throw new Error('输入框中已有草稿，请人工处理')
    await input.type(text)
    if (!await isCurrentHrConversation(page, friend, mid)) {
      await input.evaluate((element, text) => {
        if (element.textContent === text) { element.textContent = ''; element.dispatchEvent(new Event('input', { bubbles: true })) }
      }, text)
      return { status: 'superseded', reason: '输入期间收到新消息，已撤销本次草稿，等待处理新消息' }
    }
    if (await input.evaluate(element => element.textContent?.trim()) !== text) throw new Error('草稿已变化，请人工处理')
    await page.waitForFunction(() => [...document.querySelectorAll('.chat-conversation .message-controls .btn-send')].some(element => element.getClientRects().length && !element.classList.contains('disabled') && !element.classList.contains('unable') && !element.disabled), { timeout: 5000 }).catch(() => { throw new Error('等待BOSS发送按钮可用超时，尚未点击发送') })
    if (!await isCurrentHrConversation(page, friend, mid)) {
      await input.evaluate((element, text) => {
        if (element.textContent === text) { element.textContent = ''; element.dispatchEvent(new Event('input', { bubbles: true })) }
      }, text)
      return { status: 'superseded', reason: '等待发送按钮期间收到新消息，已撤销本次草稿' }
    }
    if (await input.evaluate(element => element.textContent?.trim()) !== text) throw new Error('草稿已变化，请人工处理')
    await clickVisible(page, '.chat-conversation .message-controls .btn-send', undefined, () => { sendAttempted = true })
    await page.waitForFunction((text, beforeIds) => {
      const list = document.querySelector('.message-content .chat-record')?.__vue__?.list$ || []
      return list.some(message => message.isSelf && !beforeIds.includes(String(message.mid)) && message.text === text && [1, 2].includes(message.status))
    }, { timeout: 15000 }, text, beforeIds)
    return { status: 'replied', reason: 'BOSS已确认发送文字回复' }
  } catch (error) {
    error.definitelyNotSent = !sendAttempted
    throw error
  }
}

export async function sendBossResume(page, friend, mid, { invitation, binding }) {
  if (!await isCurrentHrConversation(page, friend, mid)) throw new Error('发送前会话已变化，未发送简历')
  boundBossResume(await readBossResumes(page), binding)
  if (!await isCurrentHrConversation(page, friend, mid)) throw new Error('核对简历时会话已变化，未发送简历')
  const before = await readHrConversation(page)
  const beforeIds = before.messages.map(message => String(message.mid))
  const invitations = before.messages.filter(message => !message.isSelf && message.dialog?.type === 2 && !message.dialog.operated).map(message => String(message.mid))
  if (invitation) {
    if (!invitations.includes(String(mid))) throw new Error('当前消息不是待接受的简历请求，未操作')
    await acceptInvitation(page, mid)
  } else {
    if (before.requestResume) throw new Error('BOSS已有简历发送请求，等待对方确认，请勿重复发送')
    await clickVisible(page, '.chat-conversation .message-controls .toolbar-btn', '发简历')
  }
  // The native flow may send immediately, show an attachment chooser, or ask for confirmation.
  for (let step = 0; step < 4; step++) {
    await page.waitForFunction((invitations, beforeIds) => {
      const list = document.querySelector('.message-content .chat-record')?.__vue__?.list$ || []
      return list.some(message => invitations.includes(String(message.mid)) && message.dialog?.operated) ||
        list.some(message => !beforeIds.includes(String(message.mid)) && message.isSelf && message.dialog?.type === 2) ||
        [...document.querySelectorAll('.choose-resume-dialog, .panel-resume')].some(element => element.getClientRects().length) ||
        !!document.querySelector('.chat-conversation .chat-im.chat-editor')?.__vue__?.conversation$?.requestResume
    }, { timeout: 15000 }, invitations, beforeIds)
    const current = await readHrConversation(page)
    if (current.friend.encryptBossId !== friend.encryptBossId || current.friend.encryptJobId !== friend.encryptJobId) throw new Error('会话已切换，请人工核对简历发送结果')
    if (current.messages.some(message => invitations.includes(String(message.mid)) && message.dialog?.operated)) return { status: 'resume_sent', reason: '已接受HR简历请求，BOSS已确认' }
    if (current.requestResume || current.messages.some(message => !beforeIds.includes(String(message.mid)) && message.isSelf && message.dialog?.type === 2)) {
      return { status: 'resume_requested', reason: '已通过BOSS发简历，等待HR确认接收' }
    }
    if (!await isCurrentHrConversation(page, friend, mid)) throw new Error('收到新消息，未继续确认简历发送')
    const chooser = await page.evaluate(() => {
      const element = [...document.querySelectorAll('.choose-resume-dialog')].find(element => Array.isArray(element.__vue__?.resumeList))
      return element?.getClientRects().length ? element.__vue__?.resumeList || [] : null
    })
    if (chooser) {
      const resume = boundBossResume(chooser, binding)
      const id = bossResumeIdentity(resume).id
      const handle = await page.evaluateHandle(id => {
        const root = [...document.querySelectorAll('.choose-resume-dialog')].find(element => Array.isArray(element.__vue__?.resumeList))
        const index = (root?.__vue__?.resumeList || []).findIndex(resume => String(resume.resumeId || resume.encryptId) === id)
        return index < 0 ? null : root?.querySelectorAll('.resume-list .list-item:not(.video-list-item)')[index]
      }, id)
      const item = handle.asElement()
      if (!item) { await handle.dispose(); throw new Error('未找到所选BOSS附件简历') }
      try { await item.click() } finally { await handle.dispose() }
      boundBossResume(await readBossResumes(page), binding)
      if (!await isCurrentHrConversation(page, friend, mid)) throw new Error('确认前消息已变化，未发送简历')
      await clickVisible(page, '.choose-resume-dialog .btn-confirm', '发送')
    } else {
      boundBossResume(await readBossResumes(page), binding)
      await clickVisible(page, '.panel-resume .btn-sure-v2', '确定')
    }
    await page.waitForFunction(() => ![...document.querySelectorAll('.choose-resume-dialog, .panel-resume')].some(element => element.getClientRects().length), { timeout: 15000 })
  }
  throw new Error('BOSS未确认简历发送结果，请人工核对')
}

export const exchangeBossWechat = (page, friend, mid, options) => exchangeBossContact(page, friend, mid, 'wechat', options)
export const exchangeBossPhone = (page, friend, mid, options) => exchangeBossContact(page, friend, mid, 'phone', options)

async function exchangeBossContact(page, friend, mid, action, { invitation }) {
  const tool = hrToolOptions.find(tool => tool.action === action)
  if (!await isCurrentHrConversation(page, friend, mid)) throw new Error('交换前会话已变化，未操作')
  const before = await readHrConversation(page), last = before.messages.at(-1)
  if (invitation ? !isHrToolInvitation(last, action) : last.messageType !== 'text' || !requestsContact(last.text, action)) throw new Error(`HR未明确请求${tool.label}，未操作`)
  const beforeIds = before.messages.map(message => String(message.mid))
  const pending = action === 'wechat' ? before.requestWechat : before.requestPhone
  if (!invitation && pending) throw new Error(`${tool.label}请求已在等待确认，未重复发送`)
  if (invitation) await acceptInvitation(page, mid)
  else await clickVisible(page, '.chat-conversation .message-controls .toolbar-btn', tool.label)
  const panel = action === 'wechat' ? '.panel-wechat' : '.panel-contact'
  for (let step = 0; step < 3; step++) {
    await page.waitForFunction((panel, mid, beforeIds, type, action) => {
      const list = document.querySelector('.message-content .chat-record')?.__vue__?.list$ || []
      const conversation = document.querySelector('.chat-conversation .chat-im.chat-editor')?.__vue__?.conversation$
      return list.some(message => String(message.mid) === String(mid) && message.dialog?.operated) ||
        list.some(message => !beforeIds.includes(String(message.mid)) && message.isSelf && (message.dialog?.type === type || message.messageType === 'action' && message.action?.aid === (action === 'phone' ? 27 : 32))) ||
        !!conversation?.[action === 'phone' ? 'requestPhone' : 'requestWeiXin'] ||
        [...document.querySelectorAll(panel)].some(element => element.getClientRects().length)
    }, { timeout: 15000 }, panel, mid, beforeIds, tool.dialogType, action)
    const current = await readHrConversation(page)
    if (current.friend.encryptBossId !== friend.encryptBossId || current.friend.encryptJobId !== friend.encryptJobId) throw new Error('会话已切换，请核对交换结果')
    if (invitation && current.messages.some(message => String(message.mid) === String(mid) && message.dialog?.operated)) return { status: `${action}_exchanged`, reason: `BOSS已确认接受${tool.label}邀请` }
    if (!invitation && (current[action === 'phone' ? 'requestPhone' : 'requestWechat'] || current.messages.some(message => !beforeIds.includes(String(message.mid)) && message.isSelf && (message.dialog?.type === tool.dialogType || message.messageType === 'action' && message.action?.aid === (action === 'phone' ? 27 : 32))))) return { status: `${action}_requested`, reason: `BOSS已确认发起${tool.label}请求，等待HR同意` }
    if (!await isCurrentHrConversation(page, friend, mid)) throw new Error('确认前收到新消息，未继续交换')
    const needsAccount = await page.evaluate(panel => [...document.querySelectorAll(`${panel} input[type=text]`)].some(element => element.getClientRects().length), panel)
    if (needsAccount) throw new Error('BOSS尚未配置可用微信号，请先在BOSS设置，本条未交换')
    // Keep the website's existing phone privacy setting; never switch it off.
    await clickVisible(page, `${panel} .btn-sure-v2, ${panel} .virtual-confirm`, '确定')
    await page.waitForFunction(panel => ![...document.querySelectorAll(panel)].some(element => element.getClientRects().length), { timeout: 15000 }, panel)
  }
  throw new Error('BOSS未确认交换结果，请人工核对，不会自动重发')
}

import { configSaveHandler, waitForConfigSaves, validateConfigRegex } from '../../../features/config-save'
import { registerAutoChatSchedule, pauseScheduledChatWindow, clearScheduledChatPause } from '../../../features/auto-chat-schedule'
import { assertAutoChatTime, validateAutoChatSchedule } from '@geekgeekrun/utils/auto-chat-schedule.mjs'
import { readAutoChatSchedule, autoChatSchedulePath } from '@geekgeekrun/utils/auto-chat-schedule-store.mjs'
import { atomicWriteFile } from '@geekgeekrun/utils/atomic-file-write.mjs'
import { normalizeChatRestConfig } from '@geekgeekrun/utils/successful-chat-rest.mjs'
import { piStatus, piCompletion, listPiModels, resolvePiBinary } from '@geekgeekrun/utils/pi-request.mjs'
import { registerHrAutoReply, readHrAutoReplyRecords } from '../../../features/hr-auto-reply'
import { companyLibraryConditions } from '@geekgeekrun/utils/company-library-filters.mjs'
import { downloadReleaseAsset } from '@geekgeekrun/utils/update-download.mjs'
import { readJobFeedback, saveJobFeedback } from '@geekgeekrun/utils/job-feedback.mjs'
import { hasConfiguredLlm, feedbackLearningState } from '@geekgeekrun/utils/job-feedback-learning.mjs'
import { codexContextLimits, validateContextWindow } from '@geekgeekrun/utils/codex-context.mjs'
import fs from 'node:fs/promises'
import { portableFiles, exportPortableConfig, preparePortableImport } from '@geekgeekrun/utils/portable-config.mjs'
import { exportScopes, normalizeExportOptions, selectExportRecords, recordsToCsv } from '@geekgeekrun/utils/runtime-export.mjs'
import { resumeDocumentPath, saveResumeDocument } from '@geekgeekrun/utils/resume-document.mjs'
import { recentScoreExamples } from '@geekgeekrun/utils/score-examples.mjs'
import { registerApplicationSimulation, readDisplayedSimulation } from '../../../features/application-simulation'
import { readOnlineSimulation, onlineSimulationRunning } from '@geekgeekrun/utils/online-application-simulation.mjs'
import { openResumePreview } from '../../../window/resumePreviewWindow'
import { listCodexModels } from '@geekgeekrun/utils/codex-models.mjs'
import { buildJobMatchContext } from '@geekgeekrun/utils/job-match-context.mjs'
import filterCatalog from '@geekgeekrun/geek-auto-start-chat-with-boss/internal-config/job-filter-conditions-20241002.json'
import { jobFilterOptions, matchInputSources, mergeJobFilterSettings } from '@geekgeekrun/utils/job-filter-options.mjs'
import { parseResumeFile, parseResumeWithAi } from '@geekgeekrun/utils/resume-ai-parser.mjs'
import { defaultJobPreferences, defaultMatchPrompt, jobMatchSystemPrompt, matchingPayload, matchJobWithResume } from '@geekgeekrun/utils/ai-job-match.mjs'
import { completes } from '@geekgeekrun/utils/gpt-request.mjs'
import { codexStatus, codexCompletion, resolveCodexBinary } from '@geekgeekrun/utils/codex-request.mjs'
import { ipcMain, shell, app, dialog, BrowserWindow } from 'electron'
import path from 'path'
import * as childProcess from 'node:child_process'
import {
  readConfigFile,
  writeConfigFile,
  configFolderPath,
  readStorageFile,
  storageFilePath
} from '@geekgeekrun/geek-auto-start-chat-with-boss/runtime-file-utils.mjs'
import { ChildProcess } from 'child_process'
import { checkCookieListFormat } from '../../../../common/utils/cookie'
import { getAnyAvailablePuppeteerExecutable } from '../../DOWNLOAD_DEPENDENCIES/utils/puppeteer-executable/index'
import { mainWindow } from '../../../window/mainWindow'
import {
  getAutoStartChatRecord,
  getBossLibrary,
  getCompanyLibrary,
  getJobLibrary,
  getJobHistoryByEncryptId,
  getMarkAsNotSuitRecord,
  exportRuntimeData
} from '../utils/db/index'
import { PageReq } from '../../../../common/types/pagination'
// eslint-disable-next-line vue/prefer-import-from-vue
import { hasOwn } from '@vue/shared'
import { createLlmConfigWindow, llmConfigWindow } from '../../../window/llmConfigWindow'
import { createResumeEditorWindow, resumeEditorWindow } from '../../../window/resumeEditorWindow'
import {
  getValidTemplate,
  requestNewMessageContent
} from '../../READ_NO_REPLY_AUTO_REMINDER_MAIN/boss-operation'
import {
  defaultPromptMap,
  writeDefaultAutoRemindPrompt
} from '../../READ_NO_REPLY_AUTO_REMINDER_MAIN/boss-operation'
import {
  checkIsResumeContentValid,
  resumeContentEnoughDetect
} from '../../../../common/utils/resume'
import {
  createReadNoReplyReminderLlmMockWindow,
  readNoReplyReminderLlmMockWindow
} from '../../../window/readNoReplyReminderLlmMockWindow'
import { RequestSceneEnum } from '../../../features/llm-request-log'
import { checkUpdateForUi } from '../../../features/updater'
import gtag from '../../../utils/gtag'
import { daemonEE, sendToDaemon } from '../connect-to-daemon'
import { runCommon } from '../../../features/run-common'
import { loginWithCookieAssistant } from '../../../features/login-with-cookie-assistant'
import { configWithBrowserAssistant } from '../../../features/config-with-browser-assistant'
import {
  createFirstLaunchNoticeApproveFlag,
  isFirstLaunchNoticeApproveFlagExist,
  waitForUserApproveAgreement
} from '../../../features/first-launch-notice-window'
import { getLastUsedAndAvailableBrowser } from '../../DOWNLOAD_DEPENDENCIES/utils/browser-history'
import { waitForCommonJobConditionDone } from '../../../features/common-job-condition'
import { ensureConfigFileExist } from '@geekgeekrun/geek-auto-start-chat-with-boss/runtime-file-utils.mjs'
import { registerUiThemeIpc } from '../../../utils/theme'

export default function initIpc() {
  registerUiThemeIpc()
  registerHrAutoReply()
  registerAutoChatSchedule()
  registerApplicationSimulation()
  configSaveHandler('save-config-file-from-ui', async (_ev, payload) => {
    payload = JSON.parse(payload)
    validateConfigRegex(payload)
    const schedule = hasOwn(payload, 'autoChatSchedule') ? validateAutoChatSchedule(payload.autoChatSchedule) : undefined
    ensureConfigFileExist()

    const promiseArr: Array<Promise<unknown>> = []

    const dingtalkConfig = readConfigFile('dingtalk.json')
    if (hasOwn(payload, 'dingtalkRobotAccessToken')) {
      dingtalkConfig.groupRobotAccessToken = payload.dingtalkRobotAccessToken
    }
    promiseArr.push(writeConfigFile('dingtalk.json', dingtalkConfig))

    const bossConfig = readConfigFile('boss.json')
    if (hasOwn(payload, 'expectEmploymentType')) {
      if (![0, 1901, 1902, 1903].includes(payload.expectEmploymentType)) {
        throw new Error('无效的求职类型配置')
      }
      bossConfig.expectEmploymentType = payload.expectEmploymentType
    }
    if (hasOwn(payload, 'anyCombineRecommendJobFilter')) {
      bossConfig.anyCombineRecommendJobFilter = payload.anyCombineRecommendJobFilter
    }
    delete bossConfig.expectJobRegExpStr
    if (hasOwn(payload, 'expectJobNameRegExpStr')) {
      bossConfig.expectJobNameRegExpStr = payload.expectJobNameRegExpStr
    }
    if (hasOwn(payload, 'expectJobTypeRegExpStr')) {
      bossConfig.expectJobTypeRegExpStr = payload.expectJobTypeRegExpStr
    }
    if (hasOwn(payload, 'expectJobDescRegExpStr')) {
      bossConfig.expectJobDescRegExpStr = payload.expectJobDescRegExpStr
    }
    if (hasOwn(payload, 'jobNotMatchStrategy')) {
      bossConfig.jobNotMatchStrategy = payload.jobNotMatchStrategy
    }
    if (hasOwn(payload, 'markAsNotActiveSelectedTimeRange')) {
      bossConfig.markAsNotActiveSelectedTimeRange = payload.markAsNotActiveSelectedTimeRange
    }
    if (hasOwn(payload, 'jobNotActiveStrategy')) {
      bossConfig.jobNotActiveStrategy = payload.jobNotActiveStrategy
    }
    if (hasOwn(payload, 'autoReminder')) {
      bossConfig.autoReminder = payload.autoReminder
    }

    // city
    if (hasOwn(payload, 'expectCityList')) {
      bossConfig.expectCityList = payload.expectCityList
    }
    if (hasOwn(payload, 'expectCityNotMatchStrategy')) {
      bossConfig.expectCityNotMatchStrategy = payload.expectCityNotMatchStrategy
    }
    if (hasOwn(payload, 'strategyScopeOptionWhenMarkJobCityNotMatch')) {
      bossConfig.strategyScopeOptionWhenMarkJobCityNotMatch =
        payload.strategyScopeOptionWhenMarkJobCityNotMatch
    }

    // salary
    if (hasOwn(payload, 'expectSalaryCalculateWay')) {
      bossConfig.expectSalaryCalculateWay = payload.expectSalaryCalculateWay
    }
    if (hasOwn(payload, 'expectSalaryNotMatchStrategy')) {
      bossConfig.expectSalaryNotMatchStrategy = payload.expectSalaryNotMatchStrategy
    }
    if (hasOwn(payload, 'strategyScopeOptionWhenMarkSalaryNotMatch')) {
      bossConfig.strategyScopeOptionWhenMarkSalaryNotMatch =
        payload.strategyScopeOptionWhenMarkSalaryNotMatch
    }
    if (hasOwn(payload, 'expectSalaryLow')) {
      bossConfig.expectSalaryLow = payload.expectSalaryLow
    }
    if (hasOwn(payload, 'expectSalaryHigh')) {
      bossConfig.expectSalaryHigh = payload.expectSalaryHigh
    }

    // work exp
    if (hasOwn(payload, 'expectWorkExpList')) {
      bossConfig.expectWorkExpList = payload.expectWorkExpList
    }
    if (hasOwn(payload, 'expectWorkExpNotMatchStrategy')) {
      bossConfig.expectWorkExpNotMatchStrategy = payload.expectWorkExpNotMatchStrategy
    }
    if (hasOwn(payload, 'strategyScopeOptionWhenMarkJobWorkExpNotMatch')) {
      bossConfig.strategyScopeOptionWhenMarkJobWorkExpNotMatch =
        payload.strategyScopeOptionWhenMarkJobWorkExpNotMatch
    }
    if (hasOwn(payload, 'jobDetailRegExpMatchLogic')) {
      bossConfig.jobDetailRegExpMatchLogic = payload.jobDetailRegExpMatchLogic
    }
    if (hasOwn(payload, 'isSkipEmptyConditionForCombineRecommendJobFilter')) {
      bossConfig.isSkipEmptyConditionForCombineRecommendJobFilter =
        payload.isSkipEmptyConditionForCombineRecommendJobFilter
    }
    if (hasOwn(payload, 'jobSourceList')) {
      bossConfig.jobSourceList = payload.jobSourceList
    }
    if (hasOwn(payload, 'combineRecommendJobFilterType')) {
      bossConfig.combineRecommendJobFilterType = payload.combineRecommendJobFilterType
    }
    if (hasOwn(payload, 'staticCombineRecommendJobFilterConditions')) {
      bossConfig.staticCombineRecommendJobFilterConditions =
        payload.staticCombineRecommendJobFilterConditions
    }
    if (hasOwn(payload, 'successfulChatRestEnabled')) {
      if (typeof payload.successfulChatRestEnabled !== 'boolean' || !Number.isInteger(payload.successfulChatRestEvery) || payload.successfulChatRestEvery < 1 || payload.successfulChatRestEvery > 10000 || !Number.isFinite(payload.successfulChatRestMinutes) || payload.successfulChatRestMinutes < 0 || payload.successfulChatRestMinutes > 1440) throw new Error('请检查成功开聊次数与休息分钟数')
      bossConfig.successfulChatRestEnabled = payload.successfulChatRestEnabled
      bossConfig.successfulChatRestEvery = payload.successfulChatRestEvery
      bossConfig.successfulChatRestMinutes = payload.successfulChatRestMinutes
    }
    if (hasOwn(payload, 'isSageTimeEnabled')) {
      bossConfig.isSageTimeEnabled = payload.isSageTimeEnabled
    }
    if (hasOwn(payload, 'sageTimeOpTimes')) {
      bossConfig.sageTimeOpTimes = payload.sageTimeOpTimes
    }
    if (hasOwn(payload, 'sageTimePauseMinute')) {
      bossConfig.sageTimePauseMinute = payload.sageTimePauseMinute
    }
    if (hasOwn(payload, 'blockCompanyNameRegExpStr')) {
      bossConfig.blockCompanyNameRegExpStr = payload.blockCompanyNameRegExpStr
    }
    if (hasOwn(payload, 'blockCompanyNameRegMatchStrategy')) {
      bossConfig.blockCompanyNameRegMatchStrategy = payload.blockCompanyNameRegMatchStrategy
    }
    if (hasOwn(payload, 'fieldsForUseCommonConfig')) {
      bossConfig.fieldsForUseCommonConfig = { ...payload.fieldsForUseCommonConfig, expectCompanies: true, blockCompanyNameRegExpStr: true }
    }

    promiseArr.push(writeConfigFile('boss.json', normalizeChatRestConfig(bossConfig)))

    if (hasOwn(payload, 'expectCompanies')) {
      promiseArr.push(
        writeConfigFile('target-company-list.json', payload.expectCompanies?.split(',') ?? [])
      )
    }

    const result = await Promise.all(promiseArr)
    if (schedule) await atomicWriteFile(autoChatSchedulePath, JSON.stringify(schedule))
    return result
  })

  ipcMain.handle('run-geek-auto-start-chat-with-boss', async (_ev) => {
    if (onlineSimulationRunning(await readOnlineSimulation())) throw new Error('在线模拟正在运行，请先停止在线模拟后再启动真实开聊')
    assertAutoChatTime(readAutoChatSchedule())
    await clearScheduledChatPause()
    const mode = 'geekAutoStartWithBossMain'
    const { runRecordId } = await runCommon({ mode })
    return { runRecordId }
  })

  async function stopWorkerAndWait(workerId: string) {
    const p = new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        daemonEE.off('message', handler)
        resolve()
      }, 8000)
      function handler(message: any) {
        if (message.workerId !== workerId) return
        if (message.type === 'worker-exited' || message.type === 'worker-disconnected') {
          clearTimeout(timer)
          daemonEE.off('message', handler)
          resolve()
        }
      }
      daemonEE.on('message', handler)
    })
    await sendToDaemon(
      {
        type: 'stop-worker',
        workerId
      },
      {
        needCallback: true
      }
    )
    await p
  }

  ipcMain.handle('stop-geek-auto-start-chat-with-boss', async () => {
    await pauseScheduledChatWindow()
    mainWindow?.webContents.send('geek-auto-start-chat-with-boss-stopping')
    await stopWorkerAndWait('geekAutoStartWithBossMain')
    mainWindow?.webContents.send('geek-auto-start-chat-with-boss-stopped')
  })

  ipcMain.handle('stop-read-no-reply-auto-reminder', async () => {
    mainWindow?.webContents.send('read-no-reply-auto-reminder-stopping')
    await stopWorkerAndWait('readNoReplyAutoReminderMain')
    mainWindow?.webContents.send('read-no-reply-auto-reminder-stopped')
  })

  ipcMain.handle('get-task-manager-list', async () => {
    const result = await sendToDaemon(
      {
        type: 'get-status'
      },
      {
        needCallback: true
      }
    )
    return result
  })

  // IPC处理：停止工具进程
  ipcMain.handle('stop-task', async (_, workerId) => {
    if (workerId === 'geekAutoStartWithBossMain') await pauseScheduledChatWindow()
    await sendToDaemon(
      {
        type: 'stop-worker',
        workerId
      },
      {
        needCallback: true
      }
    )
  })

  ipcMain.handle('check-boss-zhipin-cookie-file', () => {
    const cookies = readStorageFile('boss-cookies.json')
    return checkCookieListFormat(cookies)
  })

  ipcMain.handle('get-job-feedback', async () => Object.fromEntries((await readJobFeedback()).map(item => [item.jobId, item.value])))
  ipcMain.handle('get-job-feedback-availability', async () => {
    const model = readConfigFile('llm.json')?.find(it => it.enabled)
    return hasConfiguredLlm(model) && (model.provider === 'pi-cli' ? (await piStatus(model)).loggedIn : model.provider !== 'codex-cli' || (await codexStatus(model)).loggedIn)
  })
  let feedbackUpdate = Promise.resolve()
  function queueJobMatchUpdate(action) {
    const operation = feedbackUpdate.catch(() => {}).then(action)
    feedbackUpdate = operation.then(() => {}, () => {})
    return operation
  }
  async function refreshFeedbackLearning(config, records) {
    const model = readConfigFile('llm.json')?.find(it => it.enabled)
    return feedbackLearningState(config, records, model)
  }
  async function feedbackSwitchPatch(existing, updated) {
    if (matchInputSources(existing).feedback === matchInputSources(updated).feedback) return { warning: '' }
    return refreshFeedbackLearning(updated, matchInputSources(updated).feedback ? await readJobFeedback() : [])
  }
  ipcMain.handle('save-job-feedback', (_, payload) => queueJobMatchUpdate(async () => {
    if (typeof payload?.jobId !== 'string' || typeof payload.jobName !== 'string' || typeof payload.description !== 'string') throw new Error('岗位反馈缺少必要信息')
    const model = readConfigFile('llm.json')?.find(it => it.enabled)
    if (!hasConfiguredLlm(model) || (model.provider === 'codex-cli' && !(await codexStatus(model)).loggedIn) || (model?.provider === 'pi-cli' && !(await piStatus(model)).loggedIn)) throw new Error('请先配置并登录大模型，再使用偏好反馈')
    const records = await saveJobFeedback(payload)
    const config = readConfigFile('job-ai-match.json')
    const { warning, ...learning } = await refreshFeedbackLearning(config, records)
    await writeConfigFile('job-ai-match.json', { ...config, ...learning })
    return { value: payload.value, ...learning, warning }
  }))
  async function readPortableFiles() {
    const files: Record<string, any> = {}
    for (const name of portableFiles) {
      try { files[name] = JSON.parse(await fs.readFile(path.join(configFolderPath, name), 'utf8')) }
      catch (error: any) { if (error.code !== 'ENOENT') throw error }
    }
    return files
  }
  ipcMain.handle('export-portable-config', async (_, settings) => {
    const selection = await dialog.showSaveDialog(mainWindow!, { title: '导出配置', defaultPath: path.join(app.getPath('downloads'), 'GeekGeekRun-Pro-配置.json'), filters: [{ name: '配置文件', extensions: ['json'] }] })
    if (selection.canceled || !selection.filePath) return null
    const bundle = { ...exportPortableConfig(await readPortableFiles()), settings: { autoCheckUpdates: Boolean(settings?.autoCheckUpdates) } }
    await fs.writeFile(selection.filePath, JSON.stringify(bundle, null, 2), { mode: 0o600 })
    return { path: selection.filePath }
  })
  ipcMain.handle('import-portable-config', async () => {
    const selection = await dialog.showOpenDialog(mainWindow!, { title: '导入配置', properties: ['openFile'], filters: [{ name: '配置文件', extensions: ['json'] }] })
    if (selection.canceled || !selection.filePaths[0]) return null
    const file = selection.filePaths[0]
    if ((await fs.stat(file)).size > 5 * 1024 * 1024) throw new Error('配置文件过大')
    const status = await sendToDaemon({ type: 'get-status' }, { needCallback: true })
    if (!Array.isArray(status?.workers)) throw new Error('无法确认任务状态，请稍后重试')
    if (status.workers.length) throw new Error('请先停止正在运行的任务，再导入配置')
    const existing = await readPortableFiles()
    const bundle = JSON.parse(await fs.readFile(file, 'utf8'))
    const imported = preparePortableImport(bundle, existing)
    const backup = path.join(configFolderPath, `导入前备份-${Date.now()}`)
    await fs.mkdir(backup, { recursive: true })
    for (const name of Object.keys(imported)) if (existing[name] !== undefined) await fs.copyFile(path.join(configFolderPath, name), path.join(backup, name))
    const written: string[] = []
    try {
      for (const [name, value] of Object.entries(imported)) { await writeConfigFile(name, value); written.push(name) }
    } catch (error) {
      for (const name of written) {
        if (existing[name] !== undefined) await writeConfigFile(name, existing[name])
        else await fs.rm(path.join(configFolderPath, name), { force: true })
      }
      throw error
    }
    return { backup, autoCheckUpdates: typeof bundle.settings?.autoCheckUpdates === 'boolean' ? bundle.settings.autoCheckUpdates : null }
  })
  ipcMain.handle('export-runtime-data', async (_, requested = {}) => {
    const options = normalizeExportOptions(requested)
    const result = await exportRuntimeData() as any
    if (result.data?.exportError) throw new Error('读取运行数据失败，未导出')
    const feedback = await readJobFeedback()
    const simulation = options.scope === 'all' || options.scope === 'simulation' ? await readDisplayedSimulation() : null
    const replies = options.scope === 'all' || options.scope === 'replies' ? await readHrAutoReplyRecords() : null
    if (options.scope === 'replies') result.data.replies = replies
    if (options.scope === 'simulation') result.data.simulation = simulation?.displayJobs || []
    const records = options.scope === 'all' ? null : selectExportRecords(result.data, options, feedback)
    if (records && !records.length) throw new Error('没有符合条件的记录，请调整筛选条件')
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' })
    const selection = await dialog.showSaveDialog(mainWindow!, { title: '导出' + exportScopes[options.scope].label, defaultPath: path.join(app.getPath('downloads'), `GeekGeekRun-Pro-${exportScopes[options.scope].label}-${today}.${options.format}`), filters: [{ name: options.format === 'csv' ? 'CSV 表格' : 'JSON 完整数据', extensions: [options.format] }] })
    if (selection.canceled || !selection.filePath) return null
    async function readOptional(name, lines = false) {
      try { const text = await fs.readFile(path.join(storageFilePath, name), 'utf8'); return lines ? text.split('\n').filter(Boolean).map(line => JSON.parse(line)) : JSON.parse(text) }
      catch (error: any) { if (error.code === 'ENOENT') return []; throw error }
    }
    const output = records ? { version: 1, exportedAt: new Date().toISOString(), scope: options.scope, filters: options.filters, recordCount: records.length, records } : { version: 1, exportedAt: new Date().toISOString(), database: result.data, simulation, replies, feedback, matchingAudit: await readOptional('job-ai-match-audit.jsonl', true), scoreExamples: await readOptional('job-ai-score-examples.json'), learnedPreferences: readConfigFile('job-ai-match.json')?.learnedPreferences || '' }
    await fs.writeFile(selection.filePath, options.format === 'csv' ? recordsToCsv(records, options.scope) : JSON.stringify(output, null, 2), { mode: 0o600 })
    return { path: selection.filePath, scope: options.scope, count: records?.length, tables: Object.keys(result.data).length }
  })
  ipcMain.handle('get-auto-start-chat-record', async (_ev, payload: PageReq) => {
    const a = await getAutoStartChatRecord(payload)
    return a
  })
  ipcMain.handle('get-mark-as-not-suit-record', async (_ev, payload: PageReq) => {
    const a = await getMarkAsNotSuitRecord(payload)
    return a
  })
  ipcMain.handle('get-job-library', async (_ev, payload: PageReq & { companyName?: string; companyId?: string; companyOrder?: string | null }) => {
    for (const key of ['companyName', 'companyId'] as const) {
      if (payload[key] != null && (typeof payload[key] !== 'string' || payload[key]!.length > 500)) throw new Error('公司筛选条件无效')
    }
    if (payload.companyOrder != null && !['ascending', 'descending'].includes(payload.companyOrder)) throw new Error('公司排序方式无效')
    const a = await getJobLibrary(payload as Parameters<typeof getJobLibrary>[0])
    return a
  })
  ipcMain.handle('get-boss-library', async (_ev, payload: PageReq) => {
    const a = await getBossLibrary(payload)
    return a
  })
  ipcMain.handle('get-company-library', async (_ev, payload: Parameters<typeof getCompanyLibrary>[0]) => {
    companyLibraryConditions(payload)
    const a = await getCompanyLibrary(payload)
    return a
  })

  let subProcessOfOpenBossSiteDefer: null | PromiseWithResolvers<ChildProcess> = null
  let subProcessOfOpenBossSite: null | ChildProcess = null
  ipcMain.handle('open-site-with-boss-cookie', async (ev, data) => {
    const url = new URL(data.url)
    if (url.protocol !== 'https:' || url.hostname !== 'www.zhipin.com') throw new Error('职位详情链接无效')
    if (
      !subProcessOfOpenBossSiteDefer ||
      !subProcessOfOpenBossSite ||
      subProcessOfOpenBossSite.killed || !subProcessOfOpenBossSite.connected
    ) {
      subProcessOfOpenBossSiteDefer = Promise.withResolvers()
      let puppeteerExecutable = await getLastUsedAndAvailableBrowser()
      if (!puppeteerExecutable) {
        try {
          const parent = BrowserWindow.fromWebContents(ev.sender) || undefined
          await configWithBrowserAssistant({
            autoFind: true,
            windowOption: {
              parent,
              modal: !!parent,
              show: true
            }
          })
          puppeteerExecutable = await getLastUsedAndAvailableBrowser()
        } catch (error) {
          //
        }
      }
      if (!puppeteerExecutable) {
        await dialog.showMessageBox({
          type: `error`,
          message: `未找到可用的浏览器`,
          detail: `请前往「浏览器设置」自动检测、下载或手动选择 Chrome / Edge 浏览器`
        })
        return
      }
      const subProcessEnv = {
        ...process.env,
        PUPPETEER_EXECUTABLE_PATH: puppeteerExecutable!.executablePath
      }
      subProcessOfOpenBossSite = childProcess.spawn(
        process.argv[0],
        process.env.NODE_ENV === 'development'
          ? [process.argv[1], `--mode=launchBossSite`]
          : [`--mode=launchBossSite`],
        {
          env: subProcessEnv,
          stdio: ['inherit', 'inherit', 'inherit', 'ipc']
        }
      )
      const child = subProcessOfOpenBossSite
      const ready = subProcessOfOpenBossSiteDefer
      const timer = setTimeout(() => { ready.reject(new Error('招聘浏览器启动超时，请重试')); child.kill() }, 30_000)
      const reset = (error: Error) => {
        clearTimeout(timer)
        ready.reject(error)
        if (subProcessOfOpenBossSite === child) {
          subProcessOfOpenBossSiteDefer = null
          subProcessOfOpenBossSite = null
        }
      }
      child.once('error', reset)
      child.once('exit', () => reset(new Error('招聘浏览器已关闭，请重试')))
      child.on('message', (message: any) => {
        if (message?.type === 'SUB_PROCESS_OF_OPEN_BOSS_SITE_READY') {
          clearTimeout(timer)
          ready.resolve(child)
        } else if (message?.type === 'OPEN_BOSS_SITE_ERROR') {
          void dialog.showMessageBox({ type: 'error', message: '无法打开职位详情', detail: message.error })
        } else if (message?.type === 'SUB_PROCESS_OF_OPEN_BOSS_SITE_CAN_BE_KILLED') child.kill()
      })
    }
    try {
      const child = await subProcessOfOpenBossSiteDefer.promise
      await new Promise<void>((resolve, reject) => {
        child.send({ type: 'NEW_WINDOW', url: url.href }, error => error ? reject(error) : resolve())
      })
    } catch (error) {
      await dialog.showMessageBox({ type: 'error', message: '无法打开职位详情', detail: String(error) })
    }
  })

  ipcMain.handle('get-job-history-by-encrypt-id', async (_, encryptJobId) => {
    return await getJobHistoryByEncryptId(encryptJobId)
  })

  function matchingContext() {
    return buildJobMatchContext(readConfigFile('boss.json'), readConfigFile('common-job-condition-config.json'), readConfigFile('target-company-list.json'), filterCatalog)
  }
  ipcMain.handle('get-job-ai-context', () => matchingContext())
  ipcMain.handle('preview-job-ai-input', async (_, draft) => {
    const config = readConfigFile('job-ai-match.json')
    return { systemInstructions: jobMatchSystemPrompt, ...matchingPayload({ ...config, inputSources: matchInputSources(draft), customPrompt: draft.customPrompt, resumeText: draft.resumeText, preferences: draft.preferences, filterContext: matchingContext(), feedbackRecords: await readJobFeedback() }, { jobInfo: draft.job, selectedJob: { brandName: draft.job?.company, cityName: draft.job?.city } }) }
  })
  ipcMain.handle('get-job-ai-model', async () => {
    const model = readConfigFile('llm.json')?.find(it => it.enabled)
    if (!model) return { provider: '未启用模型', model: '', account: '' }
    const codex = model.provider === 'codex-cli'
    const pi = model.provider === 'pi-cli'
    const status = pi ? await piStatus(model) : codex ? await codexStatus(model) : null
    return { provider: pi ? '本机 Pi CLI（Codex / Antigravity 等）' : codex ? '本机 Codex CLI' : '在线 API 接入', model: model.model || '自动选择（实际模型显示在每次运行结果）', reasoningEffort: model.reasoningEffort || '模型默认', account: status?.email || '', endpoint: codex || pi ? status?.binary : model.providerCompleteApiUrl }
  })
  ipcMain.handle('get-job-ai-score-examples', () => {
    try { return recentScoreExamples(JSON.parse(require('node:fs').readFileSync(path.join(storageFilePath, 'job-ai-score-examples.json'), 'utf8'))) }
    catch { return [] }
  })
  function matchingSettings() {
    const config = readConfigFile('job-ai-match.json')
    const options = jobFilterOptions(config)
    return { ...config, enabled: options.enabled, regexFilters: options.regex, aiFilters: options.ai, inputSources: matchInputSources(config), customPrompt: config.customPrompt || defaultMatchPrompt, preferences: config.preferences || defaultJobPreferences }
  }
  ipcMain.handle('get-job-ai-match', async () => { await waitForConfigSaves(); return matchingSettings() })
  ipcMain.handle('get-job-matching-preview', async () => {
    await waitForConfigSaves()
    const config = matchingSettings(), context = matchingContext()
    const payload = { systemInstructions: jobMatchSystemPrompt, ...matchingPayload({ ...config, filterContext: context, feedbackRecords: await readJobFeedback() }, { jobInfo: {} }) }
    return { config, context, payload }
  })
  configSaveHandler('save-job-filter-switches', (_, payload) => queueJobMatchUpdate(async () => {
    const config = readConfigFile('job-ai-match.json')
    const updated = mergeJobFilterSettings(config, payload)
    const { warning, ...learning } = await feedbackSwitchPatch(config, updated)
    await writeConfigFile('job-ai-match.json', { ...updated, ...learning })
    return { enabled: updated.enabled, regexFilters: updated.regexFilters, aiFilters: updated.aiFilters, inputSources: updated.inputSources, warning }
  }))
  configSaveHandler('save-job-ai-match', (_, config) => queueJobMatchUpdate(async () => {
    if (typeof config?.resumeText !== 'string' || typeof config.preferences !== 'string' || config.resumeText.length > 80000 || config.preferences.length > 20000) throw new Error('AI筛选配置格式无效或内容过长')
    const existing = readConfigFile('job-ai-match.json')
    if (typeof config.customPrompt !== 'string' || config.customPrompt.length > 20000) throw new Error('提示词无效或过长')
    const inputSources = matchInputSources(config)
    if (config.resumeFileId) await fs.access(resumeDocumentPath(config.resumeFileId))
    const { warning, ...learning } = await feedbackSwitchPatch(existing, { ...existing, ...config, inputSources })
    await writeConfigFile('job-ai-match.json', { ...existing, inputSources, customPrompt: config.customPrompt, resumeText: config.resumeText, resumeFileName: path.basename(String(config.resumeFileName || '')), resumeFileId: config.resumeFileId || '', preferences: config.preferences, resumeSourceText: typeof config.resumeSourceText === 'string' ? config.resumeSourceText.slice(0, 80000) : '', resumeParsingNotes: Array.isArray(config.resumeParsingNotes) ? config.resumeParsingNotes.filter(v => typeof v === 'string') : [], resumeParseMethod: String(config.resumeParseMethod || ''), resumeParseModel: String(config.resumeParseModel || ''), ...learning })
    return { warning }
  }))
  ipcMain.handle('import-job-ai-resume', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, { title: '使用AI解析简历', properties: ['openFile'], filters: [{ name: '简历', extensions: ['pdf', 'txt', 'md'] }] })
    if (result.canceled || !result.filePaths[0]) return null
    const parsed = await parseResumeFile(result.filePaths[0], readConfigFile('llm.json')?.find(it => it.enabled))
    return { ...parsed, resumeFileId: await saveResumeDocument(result.filePaths[0]) }
  })
  ipcMain.handle('preview-job-ai-resume', async (_, id) => {
    const file = resumeDocumentPath(id)
    await fs.access(file)
    await openResumePreview(file, readConfigFile('job-ai-match.json')?.resumeFileName || '简历.pdf', mainWindow!)
  })
  ipcMain.handle('parse-job-ai-resume-text', async (_, text) => {
    if (typeof text !== 'string' || text.length > 80000) throw new Error('简历文本无效或过长')
    return parseResumeWithAi(text, readConfigFile('llm.json')?.find(it => it.enabled))
  })
  ipcMain.handle('test-job-ai-match', async (_, candidate) => {
    if (typeof candidate?.jobName !== 'string' || typeof candidate?.postDescription !== 'string' || candidate.postDescription.length > 80000) throw new Error('请填写岗位名称与完整岗位描述')
    const config = readConfigFile('job-ai-match.json')
    const model = readConfigFile('llm.json')?.find(it => it.enabled)
    return matchJobWithResume({ ...config, filterContext: matchingContext() }, { jobInfo: candidate, selectedJob: { brandName: candidate.company || '', cityName: candidate.city || '' } }, model)
  })
  const llmEndpointCachePath = path.join(configFolderPath, 'llm-endpoint-cache.json')
  function normalizeEndpointUrl(url?: string) {
    return String(url || '').trim().replace(/\/+$/, '')
  }
  async function readLlmEndpointCache(): Promise<Record<string, { providerCompleteApiUrl: string; model: string; providerApiSecret: string }>> {
    try {
      const parsed = JSON.parse(await fs.readFile(llmEndpointCachePath, 'utf8'))
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }
  async function updateLlmEndpointCache(configs: any[]) {
    const cache = await readLlmEndpointCache()
    let changed = false
    for (const conf of configs || []) {
      if ((conf?.provider || 'openai') !== 'openai') continue
      const key = normalizeEndpointUrl(conf.providerCompleteApiUrl)
      if (!key || !/^https?:\/\//i.test(key)) continue
      const prev = cache[key]
      const nextSecret = conf.providerApiSecret?.trim() || prev?.providerApiSecret || ''
      const nextModel = conf.model?.trim() || prev?.model || ''
      if (!prev || prev.providerApiSecret !== nextSecret || prev.model !== nextModel || prev.providerCompleteApiUrl !== conf.providerCompleteApiUrl.trim()) {
        cache[key] = {
          providerCompleteApiUrl: conf.providerCompleteApiUrl.trim(),
          model: nextModel,
          providerApiSecret: nextSecret
        }
        changed = true
      }
    }
    if (changed) {
      await atomicWriteFile(llmEndpointCachePath, JSON.stringify(cache, null, 2))
      await fs.chmod(llmEndpointCachePath, 0o600).catch(() => {})
    }
    return cache
  }
  ipcMain.handle('get-llm-endpoint-cache', () => readLlmEndpointCache())
  ipcMain.handle('test-openai-connection', async (_, settings = {}) => {
    const baseURL = String(settings?.providerCompleteApiUrl || '').trim()
    const model = String(settings?.model || '').trim()
    const apiKey = String(settings?.providerApiSecret || '').trim()
    if (!/^https?:\/\//i.test(baseURL)) throw new Error('请先填写以 http:// 或 https:// 开头的服务地址')
    if (!model) throw new Error('请先填写模型名称')
    if (!apiKey) throw new Error('请先填写 API Key')
    const result = await completes(
      { provider: 'openai', baseURL, apiKey, model, reasoningEffort: settings?.reasoningEffort, maxTokens: 200 },
      [{ role: 'user', content: '只回复：连接成功' }]
    )
    const content = result?.choices?.[0]?.message?.content?.trim() || '连接成功'
    return `${content}；实际模型：${result?.model || model}`
  })
  ipcMain.handle('pi-models', (_, settings = {}) => listPiModels(settings))
  ipcMain.handle('pi-status', (_, settings = {}) => piStatus(settings))
  ipcMain.handle('test-pi-connection', async (_, settings = {}) => {
    const result = await piCompletion([{ role: 'user', content: '只回复：连接成功' }], settings.model || '', settings)
    return `${result.choices[0].message.content}；实际模型：${result.model}`
  })
  ipcMain.handle('codex-models', async (_, settings = {}) => listCodexModels({ binary: await resolveCodexBinary(settings) }))
  ipcMain.handle('codex-status', (_, settings = {}) => codexStatus(settings))
  ipcMain.handle('test-codex-connection', async (_, settings) => {
    const model = typeof settings === 'string' ? settings : settings?.model || ''
    const result = await codexCompletion([{ role: 'user', content: '只回复：连接成功' }], model, { codexDetectionMode: settings?.codexDetectionMode, codexBinaryPath: settings?.codexBinaryPath, reasoningEffort: typeof settings === 'object' ? settings.reasoningEffort : '', contextWindowTokens: settings?.contextWindowTokens })
    return `${result.choices[0].message.content}；实际模型：${result.model}`
  })
  configSaveHandler('save-llm-config', async (_, configToSave, { embedded = false } = {}) => {
    for (const config of configToSave) {
      if (config.provider === 'codex-cli' && config.enabled !== false && config.contextWindowTokens) {
        try {
          await resolveCodexBinary(config)
          validateContextWindow(config.contextWindowTokens, await codexContextLimits(config.model))
        } catch (err: any) {
          if (String(err?.message || '').includes('上下文')) throw err
        }
      }
      if (config.provider === 'pi-cli' && config.enabled !== false && config.contextWindowTokens) {
        try {
          await resolvePiBinary(config)
          const models = await listPiModels(config)
          const selected = config.model ? models.find(item => item.id === config.model) : models.find(item => item.isDefault)
          validateContextWindow(config.contextWindowTokens, selected?.contextLimits)
        } catch (err: any) {
          if (String(err?.message || '').includes('上下文')) throw err
        }
      }
    }
    await writeConfigFile('llm.json', configToSave)
    await updateLlmEndpointCache(configToSave)
    if (!embedded) ipcMain.emit('llm-config-saved')
  })
  ipcMain.handle('llm-config', async () => {
    const win = createLlmConfigWindow({ parent: mainWindow!, modal: true, show: true })
    return new Promise<void>((resolve) => {
      let saved = false
      const done = () => { saved = true; resolve(); win.close() }
      ipcMain.once('llm-config-saved', done)
      win.once('closed', () => { ipcMain.off('llm-config-saved', done); if (!saved) resolve() })
    })
  })
  ipcMain.on('close-llm-config', () => llmConfigWindow?.close())

  ipcMain.handle('resume-edit', async () => {
    createResumeEditorWindow({
      parent: mainWindow!,
      modal: true,
      show: true
    })
    const defer = Promise.withResolvers()
    async function saveResumeHandler(_, resumeContent) {
      await writeConfigFile('resumes.json', [
        {
          name: '默认简历',
          updateTime: Number(new Date()),
          content: resumeContent
        }
      ])
      defer.resolve()
      resumeEditorWindow?.close()
    }
    ipcMain.removeHandler('save-resume-content')
    ipcMain.handle('save-resume-content', saveResumeHandler)
    resumeEditorWindow?.once('closed', () => {
      ipcMain.removeHandler('save-resume-content')
      defer.reject(new Error('cancel'))
    })

    return defer.promise
  })
  ipcMain.handle('fetch-resume-content', async () => {
    const res = (await readConfigFile('resumes.json'))?.[0]
    return res?.content ?? null
  })
  ipcMain.on('no-reply-reminder-prompt-edit', async (_, { type }) => {
    const template = await readStorageFile(defaultPromptMap[type].fileName, {
      isJson: false
    })
    if (!template) {
      await writeDefaultAutoRemindPrompt({ type })
    }
    const filePath = path.join(storageFilePath, defaultPromptMap[type].fileName)
    shell.openPath(filePath)
  })
  ipcMain.on('close-resume-editor', () => resumeEditorWindow?.close())
  ipcMain.handle('check-if-auto-remind-prompt-valid', async (_, { type }) => {
    await getValidTemplate({ type })
  })
  ipcMain.handle('check-is-resume-content-valid', async () => {
    const res = (await readConfigFile('resumes.json'))?.[0]
    return checkIsResumeContentValid(res)
  })
  ipcMain.handle('resume-content-enough-detect', async () => {
    const res = (await readConfigFile('resumes.json'))?.[0]
    return resumeContentEnoughDetect(res)
  })
  ipcMain.handle('overwrite-auto-remind-prompt-with-default', async (_, { type }) => {
    await writeDefaultAutoRemindPrompt({ type })
  })
  ipcMain.handle('check-if-llm-config-list-valid', async () => {
    const llmConfigList = await readConfigFile('llm.json')
    if (!Array.isArray(llmConfigList) || !llmConfigList?.length) {
      throw new Error('CANNOT_FIND_VALID_CONFIG')
    }
    if (llmConfigList.some((it) => (llmConfigList.length === 1 || it.enabled) && !['codex-cli', 'pi-cli'].includes(it.provider) && !/^http(s)?:\/\//.test(it.providerCompleteApiUrl))) {
      throw new Error('CANNOT_FIND_VALID_CONFIG')
    }
    if (llmConfigList.length > 1) {
      const firstEnabledModel = llmConfigList.find((it) => it.enabled)
      if (!firstEnabledModel) {
        throw new Error('CANNOT_FIND_VALID_CONFIG')
      }
    }
  })
  ipcMain.on('test-llm-config-effect', (_, { autoReminderConfig } = {}) => {
    createReadNoReplyReminderLlmMockWindow(
      {
        parent: mainWindow!,
        modal: true,
        show: true
      },
      {
        autoReminderConfig
      }
    )
    async function requestLlm(_, requestPayload) {
      return await requestNewMessageContent(requestPayload.messageList, {
        requestScene: RequestSceneEnum.testing,
        llmConfigIdForPick: requestPayload.llmConfigIdForPick ?? null
      })
    }
    ipcMain.removeHandler('request-llm-for-test')
    ipcMain.handle('request-llm-for-test', requestLlm)
    readNoReplyReminderLlmMockWindow?.once('closed', () => {
      ipcMain.removeHandler('request-llm-for-test')
    })
    async function getLlmConfigList() {
      return await readConfigFile('llm.json')
    }
    ipcMain.removeHandler('get-llm-config-for-test')
    ipcMain.handle('get-llm-config-for-test', getLlmConfigList)
    readNoReplyReminderLlmMockWindow?.once('closed', () => {
      ipcMain.removeHandler('get-llm-config-for-test')
    })
  })
  ipcMain.on('close-read-no-reply-reminder-llm-mock-window', () => {
    readNoReplyReminderLlmMockWindow?.close()
    gtag('mock_chat_window_closed')
  })
  let updateDownload: Promise<unknown> | null = null
  ipcMain.handle('download-update', async () => {
    if (updateDownload) return updateDownload
    updateDownload = (async () => {
      const release = await checkUpdateForUi()
      if (!release) throw new Error('没有可下载的新正式版本')
      return downloadReleaseAsset(release, path.join(app.getPath('downloads'), 'GeekGeekRun-Pro-updates'))
    })().finally(() => { updateDownload = null })
    return updateDownload
  })
  ipcMain.handle('check-update', async () => {
    const newRelease = await checkUpdateForUi()
    return newRelease
  })
  ipcMain.handle('login-with-cookie-assistant', async () => {
    return await loginWithCookieAssistant({
      windowOption: {
        parent: mainWindow!,
        modal: true,
        show: true
      }
    })
  })
  ipcMain.handle('config-with-browser-assistant', async () => {
    return await configWithBrowserAssistant({
      windowOption: {
        parent: mainWindow!,
        modal: true,
        show: true
      }
    })
  })

  ipcMain.handle('pre-enter-setting-ui', async () => {
    if (!isFirstLaunchNoticeApproveFlagExist()) {
      try {
        await waitForUserApproveAgreement({
          windowOption: {
            parent: mainWindow!,
            modal: true,
            show: true
          }
        })
        createFirstLaunchNoticeApproveFlag()
      } catch {
        app.exit(0)
        return
      }
    }
    const puppeteerExecutable = await getAnyAvailablePuppeteerExecutable()
    if (!puppeteerExecutable) {
      const lastBrowser = await getLastUsedAndAvailableBrowser()
      if (!lastBrowser) {
        try {
          await configWithBrowserAssistant({
            windowOption: {
              parent: mainWindow!,
              modal: true,
              show: true
            },
            autoFind: true
          })
        } catch (err) {
          void err
        }
      }
    }
  })
  ipcMain.handle('common-job-condition-config', async () => {
    await waitForCommonJobConditionDone()
    mainWindow?.webContents.send('common-job-condition-config-updated', {
      config: await readConfigFile('common-job-condition-config.json')
    })
  })

  ipcMain.handle('exit-app-immediately', () => {
    app.exit(0)
  })
}

import { checkAutoChatTime } from '@geekgeekrun/utils/auto-chat-schedule-store.mjs'
import DingtalkPlugin from '@geekgeekrun/dingtalk-plugin/index.mjs'
import { app, dialog } from 'electron'
import { SyncHook, AsyncSeriesHook } from 'tapable'
import {
  readConfigFile,
  getPublicDbFilePath
} from '@geekgeekrun/geek-auto-start-chat-with-boss/runtime-file-utils.mjs'
// import { pipeWriteRegardlessError } from '../utils/pipe'
import { sleep } from '@geekgeekrun/utils/sleep.mjs'
import { AUTO_CHAT_ERROR_EXIT_CODE } from '../../../common/enums/auto-start-chat'
import attachListenerForKillSelfOnParentExited from '../../utils/attachListenerForKillSelfOnParentExited'
import minimist from 'minimist'
import SqlitePluginModule from '@geekgeekrun/sqlite-plugin'
import gtag from '../../utils/gtag'
import GtagPlugin from '../../utils/gtag/GtagPlugin'
import { connectToDaemon, sendToDaemon } from '../OPEN_SETTING_WINDOW/connect-to-daemon'
// import { PeriodPushCurrentPageScreenshotPlugin } from '../../utils/screenshot'
import { checkShouldExit } from '../../utils/worker'
import { CookieInvalidHandlePlugin } from '../../features/cookie-invalid-handle-plugin'
import initPublicIpc from '../../utils/initPublicIpc'
import { getLastUsedAndAvailableBrowser } from '../DOWNLOAD_DEPENDENCIES/utils/browser-history'
import { configWithBrowserAssistant } from '../../features/config-with-browser-assistant'
import { attachApplicationRecording } from '@geekgeekrun/utils/application-run-records.mjs'
import { readOnlineSimulation, saveOnlineSimulation, onlineSimulationWorker } from '@geekgeekrun/utils/online-application-simulation.mjs'
import { checkCookieListFormat } from '../../../common/utils/cookie'
const { default: SqlitePlugin } = SqlitePluginModule
const workerArgs = minimist(process.argv.slice(1))
const isSimulation = workerArgs.mode === onlineSimulationWorker
const simulationLimit = Number(workerArgs['simulation-limit'])
const simulationRunId = String(workerArgs['simulation-run-id'] || '')
async function updateSimulation(patch) {
  const current = await readOnlineSimulation()
  if (current?.runId === simulationRunId) await saveOnlineSimulation({ ...current, ...patch, updatedAt: new Date().toISOString() })
}

process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，正在退出')
  process.exit(0)
})

const rerunInterval = (() => {
  let v = Number(process.env.MAIN_BOSSGEEKGO_RERUN_INTERVAL)
  if (isNaN(v)) {
    v = 5000
  }

  return v
})()

const { groupRobotAccessToken: dingTalkAccessToken } = readConfigFile('dingtalk.json')

const initPlugins = (hooks) => {
  if (!isSimulation) new DingtalkPlugin(dingTalkAccessToken).apply(hooks)
  new SqlitePlugin(getPublicDbFilePath()).apply(hooks)
  new GtagPlugin().apply(hooks)
  // new PeriodPushCurrentPageScreenshotPlugin().apply(hooks)
  if (!isSimulation) new CookieInvalidHandlePlugin().apply(hooks)
  else hooks.cookieWillSet.tapPromise('OnlineSimulationLogin', async ({ cookies }) => {
    if (!checkCookieListFormat(cookies || [])) throw new Error('LOGIN_STATUS_INVALID')
  })
  attachApplicationRecording(hooks, undefined, isSimulation ? { simulationRunId } : {})
}

const runRecordId = minimist(process.argv.slice(2))['run-record-id'] ?? null
const runAutoChat = async () => {
  if (isSimulation) {
    if (!Number.isSafeInteger(simulationLimit) || simulationLimit < 1) throw new Error('在线模拟数量无效')
    await updateSimulation({ running: true, ownerPid: process.pid })
  }
  app.dock?.hide()
  let puppeteerExecutable = await getLastUsedAndAvailableBrowser()
  if (!puppeteerExecutable) {
    if (isSimulation) await updateSimulation({ running: false, runError: '未找到可用的招聘浏览器，请先配置浏览器' })
    try {
      await configWithBrowserAssistant({ autoFind: true })
    } catch (error) {
      //
    }
    puppeteerExecutable = await getLastUsedAndAvailableBrowser()
  }
  if (!puppeteerExecutable) {
    await dialog.showMessageBox({
      type: `error`,
      message: `未找到可用的浏览器`,
      detail: `请前往「浏览器设置」自动检测、下载或手动选择 Chrome / Edge 浏览器`
    })
    sendToDaemon({
      type: 'worker-to-gui-message',
      workerId: process.env.GEEKGEEKRUND_WORKER_ID,
      data: {
        type: 'prerequisite-step-by-step-check',
        step: {
          id: 'puppeteer-executable-check',
          status: 'rejected'
        },
        runRecordId
      }
    })
    app.exit(AUTO_CHAT_ERROR_EXIT_CODE.PUPPETEER_IS_NOT_EXECUTABLE)
    return
  }
  sendToDaemon({
    type: 'worker-to-gui-message',
    workerId: process.env.GEEKGEEKRUND_WORKER_ID,
    data: {
      type: 'prerequisite-step-by-step-check',
      step: {
        id: 'puppeteer-executable-check',
        status: 'fulfilled'
      },
      runRecordId
    }
  })
  process.env.PUPPETEER_EXECUTABLE_PATH = puppeteerExecutable.executablePath
  const { initPuppeteer, mainLoop, closeBrowserWindow, autoStartChatEventBus } = await import(
    '@geekgeekrun/geek-auto-start-chat-with-boss/index.mjs'
  )
  process.on('disconnect', async () => {
    await closeBrowserWindow()
    try { await hooks.flushLocalRecords() } catch (error) { console.error(error) }
    app.exit()
  })
  await initPuppeteer()

  const hooks = {
    flushLocalRecords: async () => {},
    puppeteerLaunched: new SyncHook(['browser']),
    pageGotten: new SyncHook(['page']),
    pageLoaded: new SyncHook(),
    cookieWillSet: new AsyncSeriesHook(['cookies']),
    userInfoResponse: new AsyncSeriesHook(['userInfo']),
    mainFlowWillLaunch: new AsyncSeriesHook(['args']),
    jobDetailIsGetFromRecommendList: new AsyncSeriesHook(['userInfo']),
    jobScreened: new AsyncSeriesHook<[any, any]>(['positionInfoDetail', 'decision']),
    jobMatchEvaluated: new AsyncSeriesHook<[any, any]>(['positionInfoDetail', 'decision']),
    simulationProgress: new AsyncSeriesHook<[any]>(['progress']),
    newChatWillStartup: new AsyncSeriesHook(['positionInfoDetail']),
    newChatStartup: new AsyncSeriesHook<[any, any]>(['positionInfoDetail', 'chatRunningContext']),
    jobMarkedAsNotSuit: new AsyncSeriesHook<[any, any]>(['positionInfoDetail', 'markDetail']),
    noPositionFoundForCurrentJob: new SyncHook(),
    noPositionFoundAfterTraverseAllJob: new SyncHook(),
    errorEncounter: new SyncHook(['errorInfo']),
    encounterEmptyRecommendJobList: new AsyncSeriesHook(['args']),
    sageTimeEnter: new AsyncSeriesHook(['args']),
    sageTimeExit: new AsyncSeriesHook(['args'])
  }
  initPlugins(hooks)
  if (isSimulation) hooks.simulationProgress.tapPromise('OnlineSimulationProgress', updateSimulation)

  gtag('run_auto_chat_with_boss_main_ready')

  autoStartChatEventBus.once('LOGIN_STATUS_INVALID', () => {
  })

  while (true) {
    try {
      if (!isSimulation) checkAutoChatTime()
      const result = await mainLoop(hooks, isSimulation ? { simulationLimit } : {})
      if (isSimulation) {
        await updateSimulation({ ...result, running: false })
        app.exit(0)
        return
      }
    } catch (err) {
      if (!isSimulation && err instanceof Error && 'code' in err && err.code === 'AUTO_CHAT_SCHEDULE_CLOSED') { await closeBrowserWindow(); app.exit(AUTO_CHAT_ERROR_EXIT_CODE.SCHEDULE_CLOSED); return }
      if ((err as any)?.code === 'LOCAL_REJECTION_SAVE_FAILED') {
        await dialog.showMessageBox({ type: 'error', message: '本地记录保存失败', detail: String(err) })
        app.exit(1)
        return
      }
      if (isSimulation) {
        const message = err instanceof Error ? err.message : String(err)
        await updateSimulation({ running: false, runError: message.includes('LOGIN_STATUS_INVALID') ? 'BOSS登录失效，请先在「编辑登录凭据」中登录后重试' : message.includes('ACCESS_IS_DENIED') ? 'BOSS访问受限，需要在招聘浏览器中完成验证' : `在线模拟已停止：${message}` })
        app.exit(0)
        return
      }
      if (err instanceof Error) {
        if (err.message.includes('LOGIN_STATUS_INVALID')) {
          await dialog.showMessageBox({
            type: `error`,
            message: `登录状态无效`,
            detail: `请重新登录BOSS直聘`
          })
          process.exit(AUTO_CHAT_ERROR_EXIT_CODE.LOGIN_STATUS_INVALID)
          break
        }
        if (err.message.includes('ERR_INTERNET_DISCONNECTED')) {
          process.exit(AUTO_CHAT_ERROR_EXIT_CODE.ERR_INTERNET_DISCONNECTED)
          break
        }
        if (err.message.includes('ACCESS_IS_DENIED')) {
          process.exit(AUTO_CHAT_ERROR_EXIT_CODE.ACCESS_IS_DENIED)
          break
        }
        if (err.message.includes(`Could not find Chrome`) || err.message.includes(`no executable was found`)) {
          process.exit(AUTO_CHAT_ERROR_EXIT_CODE.PUPPETEER_IS_NOT_EXECUTABLE)
          break
        }
      }
      closeBrowserWindow?.()
      console.error(err)
      const shouldExit = await checkShouldExit()
      if (shouldExit) {
        app.exit()
        return
      }
      console.log(
        `[Run core main] An internal error is caught, and browser will be restarted in ${rerunInterval}ms.`
      )
      await sleep(rerunInterval)
    }
  }
}

export const waitForProcessHandShakeAndRunAutoChat = async () => {
  await app.whenReady()
  app.on('window-all-closed', () => {})
  initPublicIpc()
  await connectToDaemon()
  await sendToDaemon(
    {
      type: 'ping'
    },
    {
      needCallback: true
    }
  )
  sendToDaemon({
    type: 'worker-to-gui-message',
    workerId: process.env.GEEKGEEKRUND_WORKER_ID,
    data: {
      type: 'prerequisite-step-by-step-check',
      step: {
        id: 'worker-launch',
        status: 'fulfilled'
      },
      runRecordId
    }
  })
  if (isSimulation) {
    runAutoChat().catch(async error => {
      try { await updateSimulation({ running: false, runError: `在线模拟启动失败：${error instanceof Error ? error.message : String(error)}` }) }
      finally { app.exit(0) }
    })
  } else runAutoChat()
}

attachListenerForKillSelfOnParentExited()

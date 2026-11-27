import { ipcMain } from 'electron'
import { atomicWriteFile } from '@geekgeekrun/utils/atomic-file-write.mjs'
import { createAutoChatScheduler } from '@geekgeekrun/utils/auto-chat-schedule.mjs'
import { readAutoChatSchedule, currentAutoChatWindow, readScheduleJson, autoChatScheduleStatePath, autoChatSchedulePausePath } from '@geekgeekrun/utils/auto-chat-schedule-store.mjs'
import { connectToDaemon, sendToDaemon } from '../flow/OPEN_SETTING_WINDOW/connect-to-daemon'
import { runCommon } from './run-common'

export async function pauseScheduledChatWindow() { await atomicWriteFile(autoChatSchedulePausePath, JSON.stringify(currentAutoChatWindow() || '')) }
export async function clearScheduledChatPause() { await atomicWriteFile(autoChatSchedulePausePath, JSON.stringify('')) }
export function registerAutoChatSchedule() {
  ipcMain.handle('get-auto-chat-schedule', async () => {
    const config = readAutoChatSchedule(), state = readScheduleJson(autoChatScheduleStatePath, {}), window = currentAutoChatWindow()
    const workers = config.enabled ? (await sendToDaemon({ type: 'get-status' }, { needCallback: true }))?.workers || [] : []
    const status = !config.enabled ? '已关闭' : !window ? '等待时段' : workers.some(worker => worker.workerId === 'geekAutoStartWithBossMain') ? '运行中' : state.attemptedWindow === window || readScheduleJson(autoChatSchedulePausePath, '') === window ? state.error ? '启动失败：' + state.error : '本时段已停止' : '等待启动'
    return { config, state: { ...state, status }, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }
  })
}

export async function startAutoChatScheduleService() {
  await connectToDaemon()
  await sendToDaemon({ type: 'user-process-register' }, { needCallback: true })
  await atomicWriteFile(autoChatScheduleStatePath, JSON.stringify({ ...readScheduleJson(autoChatScheduleStatePath, {}), servicePid: process.pid, serviceStartedAt: new Date().toISOString() }))
  const tick = createAutoChatScheduler({
    readConfig: readAutoChatSchedule,
    readState: () => readScheduleJson(autoChatScheduleStatePath, {}),
    writeState: state => atomicWriteFile(autoChatScheduleStatePath, JSON.stringify(state)),
    pausedWindow: () => readScheduleJson(autoChatSchedulePausePath, ''),
    workers: async () => (await sendToDaemon({ type: 'get-status' }, { needCallback: true }))?.workers || [],
    start: () => runCommon({ mode: 'geekAutoStartWithBossMain', scheduled: true, keepHostAlive: true }),
    stop: () => sendToDaemon({ type: 'stop-worker', workerId: 'geekAutoStartWithBossMain' }, { needCallback: true })
  })
  const check = () => tick().catch(error => console.error('定时开聊检查失败', error.message))
  await check()
  setInterval(check, 5000)
}

export const defaultAutoChatSchedule = { enabled: false, weekdays: [1, 2, 3, 4, 5], morning: { enabled: true, start: '09:00', end: '12:00' }, afternoon: { enabled: true, start: '14:00', end: '18:00' } }

export function validateAutoChatSchedule(config) {
  if (!config || typeof config.enabled !== 'boolean' || !Array.isArray(config.weekdays) || !config.weekdays.length || config.weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6)) throw new Error('请选择有效的执行日期')
  const windows = []
  for (const name of ['morning', 'afternoon']) {
    const item = config[name]
    if (!item || typeof item.enabled !== 'boolean' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.end) || item.start >= item.end) throw new Error('请检查开始和结束时间，同一时段不能跨天')
    if (item.enabled) windows.push(item)
  }
  if (!windows.length || windows.length === 2 && windows[0].start < windows[1].end && windows[1].start < windows[0].end) throw new Error('至少启用一个时段，两个时段不能重叠')
  return { enabled: config.enabled, weekdays: [...new Set(config.weekdays)], morning: { ...config.morning }, afternoon: { ...config.afternoon } }
}

export function autoChatWindow(config, now = new Date()) {
  validateAutoChatSchedule(config)
  if (!config.enabled || !config.weekdays.includes(now.getDay())) return null
  const pad = number => String(number).padStart(2, '0')
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  for (const name of ['morning', 'afternoon']) {
    const item = config[name]
    if (item.enabled && time >= item.start && time < item.end) return `${date}/${name}/${item.start}-${item.end}`
  }
  return null
}

export function assertAutoChatTime(config, now = new Date(), { scheduled = false, pausedWindow = '' } = {}) {
  const window = autoChatWindow(config, now)
  if ((config.enabled && (!window || pausedWindow === window)) || (scheduled && !config.enabled)) {
    const error = new Error('当前不在允许开聊的时段内，或本时段已手动停止')
    error.code = 'AUTO_CHAT_SCHEDULE_CLOSED'
    throw error
  }
}

export async function waitAndCheckAutoChatTime(ms, wait, check) {
  await wait(ms)
  check()
}

// All worker actions are injected so the same controller can run with a simulated clock.
export function createAutoChatScheduler({ readConfig, readState, writeState, pausedWindow, workers, start, stop, now = () => new Date() }) {
  let busy = false
  return async () => {
    if (busy) return
    busy = true
    try {
      const config = readConfig(), state = await readState()
      const window = autoChatWindow(config, now())
      const list = await workers()
      const running = list.some(worker => worker.workerId === 'geekAutoStartWithBossMain')
      const paused = window && await pausedWindow() === window
      if (!config.enabled && !running && state.owned) { await writeState({ ...state, owned: false, status: '已关闭' }); return }
      if ((!config.enabled || !window || paused) && running && (config.enabled || state.owned)) {
        await stop(); await writeState({ ...state, owned: false, status: config.enabled ? '等待时段' : '已关闭' }); return
      }
      if (!config.enabled || !window || paused) return
      if (running) { if (!state.owned) await writeState({ ...state, owned: true, status: '运行中' }); return }
      if (state.attemptedWindow === window || list.some(worker => worker.workerId === 'geekSimulateApplications')) return
      if (autoChatWindow(readConfig(), now()) !== window || await pausedWindow() === window) return
      await writeState({ attemptedWindow: window, owned: true, status: '启动中' })
      try { await start(); await writeState({ attemptedWindow: window, owned: true, status: '运行中' }) }
      catch (error) { await writeState({ attemptedWindow: window, owned: false, status: '启动失败', error: error.message }) }
    } finally { busy = false }
  }
}

export const replyWorkers = { hr: 'hrAutoReplyMain', followup: 'readNoReplyAutoReminderMain' }

export function createAutoReplyController({ workers, flags, start, stop }) {
  let checking = false
  const attempted = new Map()
  return async () => {
    if (checking) return
    checking = true
    try {
      const list = await workers(), enabled = await flags()
      for (const [name, workerId] of Object.entries(replyWorkers)) {
        const running = list.some(worker => worker.workerId === workerId)
        const master = name === 'followup' && list.find(worker => worker.workerId === 'geekAutoStartWithBossMain' && !(worker.args || []).some(arg => String(arg).startsWith('--simulation-limit')))
        const desired = enabled[name] === true && (name === 'hr' || !!master)
        const generation = name === 'hr' ? 'independent' : master && JSON.stringify([master.pid, master.args])
        if (!desired) {
          attempted.delete(workerId)
          if (running) await stop(workerId)
        } else if (!running && attempted.get(workerId) !== generation) {
          attempted.set(workerId, generation)
          await start(workerId)
        }
      }
    } finally { checking = false }
  }
}

export function canSendFollowup(config, lastMessage) {
  return config?.enabled === true && lastMessage?.isSelf === true
}

export function normalizeChatRestConfig(config) {
  const successMinutes = Number(config.successfulChatRestMinutes ?? 5)
  const operationMinutes = Number(config.sageTimePauseMinute ?? 15)
  const success = config.successfulChatRestEnabled === true && Number.isFinite(successMinutes) && successMinutes > 0
  const operations = !success && (config.isSageTimeEnabled ?? true) && Number.isFinite(operationMinutes) && operationMinutes > 0
  return { ...config, successfulChatRestEnabled: success, successfulChatRestMinutes: success ? successMinutes : 0,
    isSageTimeEnabled: !!operations, sageTimePauseMinute: operations ? operationMinutes : 0 }
}

export function createSuccessfulChatRest(wait) {
  let count = 0, totalRests = 0
  const seen = new Set()
  return async (jobId, config, hooks) => {
    config = normalizeChatRestConfig(config)
    if (!jobId || seen.has(jobId)) return
    seen.add(jobId)
    if (!config.successfulChatRestEnabled) { count = 0; return }
    const every = config.successfulChatRestEvery ?? 20
    const minutes = config.successfulChatRestMinutes ?? 5
    if (!Number.isInteger(every) || every < 1 || !Number.isFinite(minutes) || minutes <= 0) return
    count++
    if (count < every) return
    const event = { tag: 'afterSuccessfulChats', recordedOpCount: count, totalEnabledTimes: ++totalRests }
    console.log(`已成功开聊${count}次，休息${minutes}分钟`)
    await hooks?.sageTimeEnter?.promise(event)
    await wait(minutes * 60 * 1000)
    count = 0
    await hooks?.sageTimeExit?.promise(event)
  }
}

;(async () => {
  await import('@geekgeekrun/pm/daemon.js')
  const { startAutoChatScheduleService } = await import('../features/auto-chat-schedule')
  const { startAutoReplyService } = await import('../features/auto-reply-service')
  const start = () => startAutoChatScheduleService().then(startAutoReplyService).catch(error => { console.error('后台服务连接失败', error.message); setTimeout(start, 2000) })
  void start()
})()

export {}

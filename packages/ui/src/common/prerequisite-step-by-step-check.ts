export const getAutoStartChatSteps = () => [
  {
    id: 'worker-launch',
    describe: '启动后台任务'
  },
  {
    id: 'puppeteer-executable-check',
    describe: '检查浏览器环境'
  },
  {
    id: 'basic-cookie-check',
    describe: '检查登录凭证'
  },
  {
    id: 'login-status-check',
    describe: '验证 BOSS 登录状态'
  }
]

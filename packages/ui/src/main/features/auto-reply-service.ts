import fs from 'node:fs/promises'
import path from 'node:path'
import { createAutoReplyController } from '@geekgeekrun/utils/auto-reply-controller.mjs'
import { configFolderPath, readConfigFile } from '@geekgeekrun/geek-auto-start-chat-with-boss/runtime-file-utils.mjs'
import { sendToDaemon } from '../flow/OPEN_SETTING_WINDOW/connect-to-daemon'
import { runCommon } from './run-common'

export async function startAutoReplyService() {
  const tick = createAutoReplyController({
    workers: async () => (await sendToDaemon({ type: 'get-status' }, { needCallback: true }))?.workers || [],
    flags: async () => {
      let hr: any = {}
      try { hr = JSON.parse(await fs.readFile(path.join(configFolderPath, 'hr-auto-reply.json'), 'utf8')) }
      catch (error: any) { if (error.code !== 'ENOENT') throw error }
      return { hr: hr.enabled === true, followup: readConfigFile('boss.json')?.autoReminder?.enabled === true }
    },
    start: workerId => runCommon({ mode: workerId, keepHostAlive: true }),
    stop: workerId => sendToDaemon({ type: 'stop-worker', workerId }, { needCallback: true })
  })
  const check = () => tick().catch(error => console.error('自动回复开关检查失败', error.message))
  await check()
  setInterval(check, 1000)
}

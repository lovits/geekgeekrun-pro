import { app, ipcMain } from 'electron'

let writes = Promise.resolve(), pending = 0, registered = false, quitting = false
export function configSaveHandler(channel: string, handler: (...args: any[]) => any) {
  if (!registered) {
    registered = true
    app.on('before-quit', event => {
      if (!pending || quitting) return
      event.preventDefault()
      writes.finally(() => { quitting = true; app.quit() })
    })
  }
  ipcMain.handle(channel, (...args) => {
    pending++
    const operation = writes.then(() => handler(...args))
    writes = operation.then(() => {}, () => {}).finally(() => { pending-- })
    return operation
  })
}

export function waitForConfigSaves() { return writes }

export function validateConfigRegex(config: Record<string, any>) {
  for (const key of ['expectWorkExpRegExpStr', 'expectJobNameRegExpStr', 'expectJobTypeRegExpStr', 'expectJobDescRegExpStr', 'blockCompanyNameRegExpStr']) {
    if (config[key] == null || config[key] === '') continue
    if (typeof config[key] !== 'string') throw new Error('正则表达式必须为文本')
    try { new RegExp(config[key], 'im') } catch { throw new Error('正则表达式尚未填写完整或格式无效，未保存') }
  }
}

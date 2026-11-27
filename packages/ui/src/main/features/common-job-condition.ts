import { waitForConfigSaves } from './config-save'
import { ipcMain } from 'electron'
import { createCommonJobConditionConfigWindow } from '../window/commonJobConditionConfigWindow'
import { mainWindow } from '../window/mainWindow'

export async function waitForCommonJobConditionDone() {
  return new Promise((resolve) => {
    const win = createCommonJobConditionConfigWindow({
      parent: mainWindow!,
      modal: true,
      show: true
    })
    function handler() {
      win.close()
    }
    ipcMain.once('common-job-condition-config-done', handler)
    win.on('closed', async () => {
      ipcMain.off('common-job-condition-config-done', handler)
      await waitForConfigSaves()
      resolve(true)
    })
  })
}

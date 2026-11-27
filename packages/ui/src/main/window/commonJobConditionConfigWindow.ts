import { BrowserWindow } from 'electron'
import path from 'path'
import { windowBackgroundColor } from '../utils/theme'

export let commonJobConditionConfigWindow: BrowserWindow | null = null
export function createCommonJobConditionConfigWindow(
  opt?: Electron.BrowserWindowConstructorOptions
): BrowserWindow {
  if (commonJobConditionConfigWindow && !commonJobConditionConfigWindow.isDestroyed()) {
    commonJobConditionConfigWindow.show()
    commonJobConditionConfigWindow.focus()
    return commonJobConditionConfigWindow
  }
  commonJobConditionConfigWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    resizable: false,
    show: false,
    backgroundColor: windowBackgroundColor(),
    autoHideMenuBar: true,
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false
    },
    ...opt
  })

  commonJobConditionConfigWindow.on('ready-to-show', () => {
    commonJobConditionConfigWindow!.show()
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (process.env.NODE_ENV === 'development' && process.env['ELECTRON_RENDERER_URL']) {
    commonJobConditionConfigWindow.loadURL(
      process.env['ELECTRON_RENDERER_URL'] + '#/commonJobConditionConfig'
    )
  } else {
    commonJobConditionConfigWindow.loadURL(
      'file://' + path.join(__dirname, '../renderer/index.html') + '#/commonJobConditionConfig'
    )
  }

  commonJobConditionConfigWindow!.once('closed', () => {
    commonJobConditionConfigWindow = null
  })

  return commonJobConditionConfigWindow!
}

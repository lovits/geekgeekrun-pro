import { BrowserWindow } from 'electron'
import path from 'path'
import { windowBackgroundColor } from '../utils/theme'

export let llmConfigWindow: BrowserWindow | null = null
export function createLlmConfigWindow(
  opt?: Electron.BrowserWindowConstructorOptions
): BrowserWindow {
  if (llmConfigWindow && !llmConfigWindow.isDestroyed()) {
    llmConfigWindow.show()
    llmConfigWindow.focus()
    return llmConfigWindow
  }
  llmConfigWindow = new BrowserWindow({
    width: 780,
    height: 740,
    minWidth: 540,
    minHeight: 440,
    resizable: true,
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

  llmConfigWindow.on('ready-to-show', () => {
    llmConfigWindow!.show()
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (process.env.NODE_ENV === 'development' && process.env['ELECTRON_RENDERER_URL']) {
    llmConfigWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#/llmConfig')
  } else {
    llmConfigWindow.loadURL(
      'file://' + path.join(__dirname, '../renderer/index.html') + '#/llmConfig'
    )
  }

  llmConfigWindow!.once('closed', () => {
    llmConfigWindow = null
  })

  return llmConfigWindow!
}

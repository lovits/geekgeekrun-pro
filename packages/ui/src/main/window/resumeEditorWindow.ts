import { BrowserWindow } from 'electron'
import path from 'path'
import { windowBackgroundColor } from '../utils/theme'

export let resumeEditorWindow: BrowserWindow | null = null
export function createResumeEditorWindow(
  opt?: Electron.BrowserWindowConstructorOptions
): BrowserWindow {
  if (resumeEditorWindow && !resumeEditorWindow.isDestroyed()) {
    resumeEditorWindow.show()
    resumeEditorWindow.focus()
    return resumeEditorWindow
  }
  resumeEditorWindow = new BrowserWindow({
    width: 960,
    height: 720,
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

  resumeEditorWindow.on('ready-to-show', () => {
    resumeEditorWindow!.show()
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (process.env.NODE_ENV === 'development' && process.env['ELECTRON_RENDERER_URL']) {
    resumeEditorWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#/resumeEditor')
  } else {
    resumeEditorWindow.loadURL(
      'file://' + path.join(__dirname, '../renderer/index.html') + '#/resumeEditor'
    )
  }

  resumeEditorWindow!.once('closed', () => {
    resumeEditorWindow = null
  })

  return resumeEditorWindow!
}

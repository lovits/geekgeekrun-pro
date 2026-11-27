import { BrowserWindow, shell } from 'electron'
import path from 'path'
import { openDevTools } from '../commands'
import { daemonEE } from '../flow/OPEN_SETTING_WINDOW/connect-to-daemon'
import { applyNativeTheme, windowBackgroundColor } from '../utils/theme'
export let mainWindow: BrowserWindow | null = null

export function createMainWindow(): BrowserWindow {
  applyNativeTheme()
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 780,
    minWidth: 1120,
    minHeight: 660,
    show: false,
    backgroundColor: windowBackgroundColor(),
    autoHideMenuBar: true,
    frame: true,
    ...(process.platform === 'linux'
      ? {
          /* icon */
        }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })
  mainWindow.on('ready-to-show', async () => {
    process.env.NODE_ENV === 'development' &&
      setTimeout(() => {
        mainWindow && openDevTools(mainWindow)
      }, 500)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (process.env.NODE_ENV === 'development' && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  const forwardDaemonMessage = (message: any) => {
    if (message.type === 'worker-to-gui-message') {
      mainWindow?.webContents?.send('worker-to-gui-message', message)
    } else if (message.type === 'worker-exited') {
      mainWindow?.webContents?.send('worker-exited', message)
    }
  }
  const handleDaemonError = (err: unknown) => {
    console.log(err)
  }
  daemonEE.on('message', forwardDaemonMessage)
  daemonEE.on('error', handleDaemonError)
  mainWindow!.once('closed', () => {
    daemonEE.off('message', forwardDaemonMessage)
    daemonEE.off('error', handleDaemonError)
    mainWindow = null
  })
  return mainWindow!
}

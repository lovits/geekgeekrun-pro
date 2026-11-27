import { BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { getAnyAvailablePuppeteerExecutable } from '../flow/DOWNLOAD_DEPENDENCIES/utils/puppeteer-executable'
import {
  getLastUsedAndAvailableBrowser,
  saveLastUsedAndAvailableBrowserInfo
} from '../flow/DOWNLOAD_DEPENDENCIES/utils/browser-history'
import { openBrowserDownloadWindow } from '../features/open-browser-download-window'
import { windowBackgroundColor } from '../utils/theme'

export let browserAssistantWindow: BrowserWindow | null = null

export function createBrowserAssistantWindow(
  opt?: Electron.BrowserWindowConstructorOptions,
  { autoFind }: { autoFind?: boolean } = {}
): BrowserWindow {
  // Create the browser window.
  if (browserAssistantWindow && !browserAssistantWindow.isDestroyed()) {
    browserAssistantWindow.close()
  }
  browserAssistantWindow = new BrowserWindow({
    width: 800,
    minWidth: 800,
    height: 460,
    resizable: true,
    frame: true,
    show: false,
    backgroundColor: windowBackgroundColor(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false
    },
    ...opt
  })
  browserAssistantWindow!.setAlwaysOnTop(true, 'normal')
  browserAssistantWindow!.focus()
  browserAssistantWindow!.setAlwaysOnTop(false)
  browserAssistantWindow.on('ready-to-show', () => {
    browserAssistantWindow!.show()
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  let routePath = '#/browserAssistant'
  if (autoFind) {
    routePath = '#/browserAutoFind'
  }
  if (process.env.NODE_ENV === 'development' && process.env['ELECTRON_RENDERER_URL']) {
    browserAssistantWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + routePath)
  } else {
    browserAssistantWindow.loadURL(
      'file://' + path.join(__dirname, '../renderer/index.html') + routePath
    )
  }

  browserAssistantWindow!.once('closed', () => {
    browserAssistantWindow = null
  })

  return browserAssistantWindow!
}

export function registerBrowserAssistantIpc() {
  ipcMain.handle('get-any-available-puppeteer-executable', async (_, { ignoreCached, noSave } = {}) => getAnyAvailablePuppeteerExecutable({ ignoreCached, noSave }))
  ipcMain.handle('get-last-used-and-available-browser', () => getLastUsedAndAvailableBrowser())
  ipcMain.handle('save-last-used-and-available-browser-info', (_, payload) => saveLastUsedAndAvailableBrowserInfo(payload))
  ipcMain.handle('download-browser-with-downloader', event => openBrowserDownloadWindow({ windowOption: { parent: BrowserWindow.fromWebContents(event.sender) || undefined, modal: true, show: true } }))
}

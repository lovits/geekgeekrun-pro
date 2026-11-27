import fs from 'node:fs'
import path from 'node:path'
import { BrowserWindow, ipcMain, nativeTheme } from 'electron'
import { atomicWriteFile } from '@geekgeekrun/utils/atomic-file-write.mjs'
import { configFolderPath } from '@geekgeekrun/geek-auto-start-chat-with-boss/runtime-file-utils.mjs'

export type UiThemeMode = 'light' | 'dark' | 'system'

const themeFile = path.join(configFolderPath, 'ui-theme.json')

export function readUiThemeMode(): UiThemeMode {
  try {
    const raw = JSON.parse(fs.readFileSync(themeFile, 'utf8'))
    if (raw?.mode === 'light' || raw?.mode === 'dark' || raw?.mode === 'system') {
      return raw.mode
    }
  } catch {
    // default to system
  }
  return 'system'
}

export function applyNativeTheme(mode: UiThemeMode = readUiThemeMode()) {
  if (nativeTheme.themeSource !== mode) {
    nativeTheme.themeSource = mode
  }
}

export function windowBackgroundColor(): string {
  return nativeTheme.shouldUseDarkColors ? '#111518' : '#f5f7f8'
}

function syncAllWindows() {
  const bg = windowBackgroundColor()
  const mode = readUiThemeMode()
  const payload = { mode, isDark: nativeTheme.shouldUseDarkColors }
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    try {
      win.setBackgroundColor(bg)
      win.webContents.send('ui-theme-changed', payload)
    } catch {
      // ignore closing windows
    }
  }
}

let initialized = false
export function registerUiThemeIpc() {
  applyNativeTheme()
  if (initialized) return
  initialized = true

  nativeTheme.on('updated', () => {
    syncAllWindows()
  })

  ipcMain.handle('get-ui-theme', () => {
    const mode = readUiThemeMode()
    applyNativeTheme(mode)
    return { mode, isDark: nativeTheme.shouldUseDarkColors }
  })

  ipcMain.handle('set-ui-theme', async (_, nextMode: string) => {
    const mode: UiThemeMode =
      nextMode === 'light' || nextMode === 'dark' || nextMode === 'system' ? nextMode : 'system'
    await atomicWriteFile(themeFile, JSON.stringify({ mode }))
    applyNativeTheme(mode)
    syncAllWindows()
    return { mode, isDark: nativeTheme.shouldUseDarkColors }
  })
}

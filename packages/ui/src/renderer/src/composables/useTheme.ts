import { ref, readonly } from 'vue'

export type UiThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'ggr-theme-mode'
const mode = ref<UiThemeMode>('system')
const isDark = ref(false)
let initialized = false

function readStoredMode(): UiThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  } catch {
    // ignore storage errors
  }
  return 'system'
}

function applyDomTheme(dark: boolean, currentMode: UiThemeMode) {
  isDark.value = dark
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.dataset.themeMode = currentMode
  root.style.colorScheme = dark ? 'dark' : 'light'
}

function computeDark(targetMode: UiThemeMode): boolean {
  if (targetMode === 'dark') return true
  if (targetMode === 'light') return false
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

export function initTheme() {
  if (initialized) return
  initialized = true

  const initialMode = readStoredMode()
  mode.value = initialMode
  applyDomTheme(computeDark(initialMode), initialMode)

  const media = window.matchMedia?.('(prefers-color-scheme: dark)')
  media?.addEventListener?.('change', () => {
    if (mode.value === 'system') {
      applyDomTheme(computeDark('system'), 'system')
    }
  })

  if (typeof electron !== 'undefined' && electron.ipcRenderer) {
    electron.ipcRenderer.invoke('get-ui-theme').then((res) => {
      if (res && (res.mode === 'light' || res.mode === 'dark' || res.mode === 'system')) {
        mode.value = res.mode
        try { localStorage.setItem(STORAGE_KEY, res.mode) } catch {}
        applyDomTheme(Boolean(res.isDark), res.mode)
      }
    }).catch(() => {})

    electron.ipcRenderer.on('ui-theme-changed', (_ev, payload) => {
      if (payload && (payload.mode === 'light' || payload.mode === 'dark' || payload.mode === 'system')) {
        mode.value = payload.mode
        try { localStorage.setItem(STORAGE_KEY, payload.mode) } catch {}
        applyDomTheme(Boolean(payload.isDark), payload.mode)
      }
    })
  }
}

export function useTheme() {
  initTheme()

  async function setTheme(nextMode: UiThemeMode) {
    mode.value = nextMode
    try { localStorage.setItem(STORAGE_KEY, nextMode) } catch {}
    applyDomTheme(computeDark(nextMode), nextMode)
    try {
      const res = await electron?.ipcRenderer?.invoke('set-ui-theme', nextMode)
      if (res && typeof res.isDark === 'boolean') {
        applyDomTheme(res.isDark, res.mode)
      }
    } catch {
      // fallback already applied in DOM
    }
  }

  return {
    mode: readonly(mode),
    isDark: readonly(isDark),
    setTheme
  }
}

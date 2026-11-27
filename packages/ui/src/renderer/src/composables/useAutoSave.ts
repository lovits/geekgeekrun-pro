import { onBeforeUnmount, onDeactivated, ref, watch, type WatchSource } from 'vue'
import { ElMessage } from 'element-plus'

export function useAutoSave<T>(source: WatchSource<T>, save: (value: T) => Promise<unknown>, ready: () => boolean) {
  const status = ref(''), lastError = ref('')
  const snapshot = () => JSON.stringify(typeof source === 'function' ? source() : source.value)
  let latest = snapshot(), revision = 0, pending: Promise<unknown> = Promise.resolve()
  function flush() {
    if (!ready()) return pending
    const value = snapshot()
    if (latest === value) return pending
    latest = value
    const current = ++revision
    status.value = '正在保存'
    lastError.value = ''
    pending = save(JSON.parse(value)).then(() => {
      if (current === revision) status.value = '已自动保存'
    }).catch(error => {
      if (current !== revision) return
      latest = ''
      lastError.value = error.message || String(error)
      status.value = '保存失败'
      ElMessage.error({ message: '自动保存失败：' + lastError.value, grouping: true })
    })
    return pending
  }
  watch(source, () => { if (!ready()) latest = snapshot(); else void flush() }, { deep: true, flush: 'post' })
  const beforeClose = () => { void flush() }
  window.addEventListener('beforeunload', beforeClose)
  onDeactivated(() => { void flush() })
  onBeforeUnmount(() => { void flush(); window.removeEventListener('beforeunload', beforeClose) })
  return { status, lastError, flush }
}

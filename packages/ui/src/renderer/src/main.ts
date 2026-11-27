import { createApp } from 'vue'
import ElementPlus, { ElMessage } from 'element-plus'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia'
import { initTheme } from './composables/useTheme'
import 'normalize.css'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import './style/theme.scss'
import './style/public.scss'
import './style/runtime-records.scss'
import 'virtual:uno.css'
import 'animate.css'

initTheme()

document.addEventListener('click', (event) => {
  const target = event.target
  if (!(target instanceof Element)) return
  const checkbox = target.closest('.el-checkbox')
  if (checkbox && !target.closest('.el-checkbox__input, .el-checkbox__label, a, button')) {
    event.preventDefault()
    event.stopPropagation()
  }
}, true)

const pinia = createPinia()
createApp(App).use(pinia).use(router).use(ElementPlus).mount('#app')
electron.ipcRenderer.on('toast-message', (_, payload) => {
  ElMessage(payload)
})

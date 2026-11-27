<template>
  <div class="h-screen of-hidden flex flex-col flex-items-center flex-justify-center" style="padding: 24px">
    <div class="ggr-card" style="max-width: 520px; text-align: center; margin-bottom: 0">
      <h3 class="ggr-card-title" style="justify-content: center; margin-bottom: 10px">正在检测可用浏览器</h3>
      <p style="margin: 0 0 8px; font-size: 13.5px; line-height: 1.65; color: var(--el-text-color-regular)">
        首次启动或原有浏览器路径变更时，程序会自动搜索系统中兼容的 Chrome / Edge 浏览器。
      </p>
      <p style="margin: 0; font-size: 12.5px; color: var(--el-text-color-secondary)">
        检测成功后将自动进入主界面；若未检测到，将引导您手动选择或下载。
      </p>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { gtagRenderer as baseGtagRenderer } from '@renderer/utils/gtag'

const { ipcRenderer } = electron
const router = useRouter()
// const checkDependenciesResult = ref({})
// const downloadProcessWaitee = ref(null)

const gtagRenderer = (name, params?: object) => {
  return baseGtagRenderer(name, {
    scene: 'browser-auto-find',
    ...params
  })
}

async function autoDetectPuppeteerExecutable() {
  const result = await ipcRenderer.invoke('get-any-available-puppeteer-executable')
  if (!result) {
    gtagRenderer('first-run-auto-detect-pptr-exe-fail')
    ElMessage({
      message: '未找到可用浏览器的可执行文件，请尝试手动配置',
      type: 'warning',
      grouping: true
    })
    router.replace({
      path: '/browserAssistant',
      query: {
        firstRun: 1
      }
    })
    return
  }
  gtagRenderer('first-run-auto-detect-pptr-exe-success')
  await ipcRenderer.send('browser-config-saved')
}

autoDetectPuppeteerExecutable()
</script>

<style lang="scss" scoped>
a:link,
a:visited,
a:hover,
a:active {
  color: var(--el-color-primary);
}
</style>

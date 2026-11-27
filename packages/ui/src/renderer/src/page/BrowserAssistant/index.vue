<template>
  <div class="browser-preferences" :class="{ embedded }">
    <div class="ggr-page">
      <header class="ggr-page-header">
        <div>
          <h2 class="ggr-page-title">{{ embedded ? '浏览器设置' : '配置招聘浏览器' }}</h2>
          <p class="ggr-page-desc">选择供自动化流程调用的 Chromium 内核浏览器（推荐使用 Chrome 或 Edge）</p>
        </div>
      </header>

      <section class="ggr-card">
        <div class="ggr-card-header">
          <h3 class="ggr-card-title">浏览器可执行文件路径</h3>
        </div>
        <el-form ref="formRef" :model="formData" :rules="rules" label-position="top">
          <el-form-item prop="browserPath" class="mb0">
            <div class="path-row">
              <el-input
                v-model="formData.browserPath"
                class="ggr-mono path-input"
                placeholder="点击右侧「自动检测」查找本机 Chrome / Edge，或手动选择可执行文件"
                @change="handleSave"
              />
              <el-button
                type="primary"
                :loading="isAutoDetectLoading"
                @click="autoDetectPuppeteerExecutable"
              >
                自动检测
              </el-button>
              <el-button @click="chooseExecutableFile">手动选择</el-button>
            </div>
          </el-form-item>
        </el-form>
      </section>

      <section ref="faqMainRef" class="ggr-card">
        <div class="ggr-card-header">
          <h3 class="ggr-card-title">常见问题与支持列表</h3>
        </div>

        <details class="faq-item" data-faq-id="cannot-auto-find-executable" open>
          <summary>点击「自动检测」提示未检测到可用浏览器怎么办？</summary>
          <div class="faq-answer">
            <ul>
              <li>
                <strong>方案一（推荐）：下载专用测试版 Chrome</strong> —
                <a href="javascript:;" @click="handleClickLaunchBrowserDownloader">点击此处一键下载 Google Chrome for Testing ({{ EXPECT_CHROMIUM_BUILD_ID }})</a>。该浏览器独立存放，不影响你日常使用的 Chrome，且版本固定、兼容性最稳定。
              </li>
              <li>
                <strong>方案二：安装最新版 Google Chrome</strong> —
                <a href="javascript:;" @click="handleOpenChromeDownloadPage">前往 Chrome 官网下载安装</a>，安装完成后回到本页再次点击
                <a href="javascript:;" @click="autoDetectPuppeteerExecutable">自动检测</a>。若后续遇到浏览器自动升级引起的不兼容，可随时切换回方案一或
                <a href="javascript:;" @click="handleFeedbackClick">提交反馈</a>。
              </li>
            </ul>
          </div>
        </details>

        <details class="faq-item" data-faq-id="manual-select-browser-prerequisite">
          <summary>手动选择时支持哪些浏览器与系统版本？</summary>
          <div class="faq-answer">
            <p>仅支持 <strong>Chromium {{ EXPECT_CHROMIUM_BUILD_ID }} 及以上内核</strong>的浏览器（Safari、Firefox 及低内核国产浏览器无法使用）：</p>
            <ul>
              <li><strong>macOS</strong>：Google Chrome for Testing {{ EXPECT_CHROMIUM_BUILD_ID }}、Google Chrome 144+、Microsoft Edge 144+</li>
              <li><strong>Windows</strong>：Google Chrome for Testing {{ EXPECT_CHROMIUM_BUILD_ID }}、Google Chrome 144+、Microsoft Edge 144+、Opera 127+</li>
              <li><strong>Linux</strong>：Google Chrome for Testing {{ EXPECT_CHROMIUM_BUILD_ID }}</li>
            </ul>
          </div>
        </details>

        <details class="faq-item" data-faq-id="what-will-happen-when-select-unsupported-browser">
          <summary>选择了不兼容或非浏览器文件会有什么现象？</summary>
          <div class="faq-answer">
            <ul>
              <li>浏览器打开后停留在空白页无法跳转，或反复重启打开新窗口；</li>
              <li>若误选普通程序，该程序会自行启动且不受本工具控制，重新在上方点击「自动检测」即可恢复。</li>
            </ul>
          </div>
        </details>
      </section>
    </div>
  </div>
</template>

<script lang="ts" setup>
const { embedded = false } = defineProps<{ embedded?: boolean }>()
import { nextTick, onActivated, onMounted, ref } from 'vue'
import debounce from 'lodash/debounce'
import { ElMessage } from 'element-plus'
import { gtagRenderer as baseGtagRenderer } from '@renderer/utils/gtag'
import { EXPECT_CHROMIUM_BUILD_ID } from '../../../../common/constant'
import { sleep } from '@geekgeekrun/utils/sleep.mjs'

const { ipcRenderer } = electron

const gtagRenderer = (name, params?: object) => {
  return baseGtagRenderer(name, {
    scene: 'browser-assistant',
    ...params
  })
}

const handleOpenChromeDownloadPage = debounce(
  async () => {
    gtagRenderer('open_chrome_download_page_clicked')
    ipcRenderer.send('open-external-link', 'https://www.google.cn/chrome/')
  },
  1000,
  { leading: true, trailing: false }
)

const formData = ref({
  browserPath: ''
})

const rules = {
  browserPath: {
    validator: async (_, value, callback) => {
      if (!value?.trim()) {
        callback(new Error('请选择或输入浏览器可执行文件路径'))
        return
      }
      const err = await ipcRenderer.invoke('check-executable-file', value)
      if (err) {
        callback(err?.message ?? '所选文件不可执行，请核对路径')
      } else {
        callback()
      }
    },
    trigger: 'blur'
  }
}

const isAutoDetectLoading = ref(false)
async function autoDetectPuppeteerExecutable() {
  gtagRenderer('auto_detect_pptr_exe_clicked')
  isAutoDetectLoading.value = true
  await sleep(50)
  try {
    const result = await ipcRenderer.invoke('get-any-available-puppeteer-executable', {
      ignoreCached: true,
      noSave: true
    })
    if (!result) {
      gtagRenderer('auto_detect_pptr_exe_not_found')
      ElMessage({
        message: '未检测到可用浏览器，请按下方常见问题安装或下载专用浏览器',
        type: 'warning',
        grouping: true
      })
      return
    }
    gtagRenderer('auto_detect_pptr_exe_done', {
      isUseCached: !!(
        result.executablePath?.includes(`cache`) && result.executablePath?.includes(`.geekgeekrun`)
      ),
      executableName: result.executablePath?.split(/\/|\\/).pop() ?? ''
    })
    formData.value.browserPath = result.executablePath
    await nextTick()
    await handleSave()
  } finally {
    isAutoDetectLoading.value = false
  }
}

async function chooseExecutableFile() {
  gtagRenderer('choose_pptr_exe_clicked')
  const chooseResult = await ipcRenderer.invoke('choose-file', {
    fileChooserConfig: {
      properties: ['openFile', 'treatPackageAsDirectory'],
      filters: [
        {
          name: '可执行文件',
          extensions: (await ipcRenderer.invoke('get-os-platform')) === 'win32' ? ['exe'] : ['']
        },
        { name: '所有文件', extensions: ['*'] }
      ]
    }
  })
  if (chooseResult.canceled || !chooseResult.filePaths?.length) {
    gtagRenderer('choose_pptr_exe_cancelled')
    return
  }
  formData.value.browserPath = chooseResult.filePaths[0]
  gtagRenderer('choose_pptr_exe_done', {
    executableName: chooseResult.filePaths[0]?.split(/\/|\\/).pop() ?? ''
  })
  await nextTick()
  await handleSave()
}

async function loadBrowserPreference() {
  const res = await ipcRenderer.invoke('get-last-used-and-available-browser')
  formData.value.browserPath = res?.executablePath ?? ''
}
loadBrowserPreference()
onActivated(() => { if (embedded) loadBrowserPreference() })
const formRef = ref()
async function handleSave() {
  gtagRenderer('save_clicked', {
    executablePath: formData.value.browserPath,
    executableName: formData.value.browserPath?.split(/\/|\\/).pop() ?? ''
  })
  try {
    await formRef.value.validate()
    await ipcRenderer.invoke('save-last-used-and-available-browser-info', {
      executablePath: formData.value.browserPath,
      browser: ''
    })
    if (embedded) ElMessage.success('浏览器设置已保存')
    else ipcRenderer.send('browser-config-saved')
    gtagRenderer('save_done', {
      executablePath: formData.value.browserPath,
      executableName: formData.value.browserPath?.split(/\/|\\/).pop() ?? ''
    })
  } catch (err) {
    gtagRenderer('save_validate_failed', {
      error: (err instanceof Error ? err.message : ''),
      executablePath: formData.value.browserPath,
      executableName: formData.value.browserPath?.split(/\/|\\/).pop() ?? ''
    })
  }
}
const handleFeedbackClick = () => {
  gtagRenderer('goto_feedback_for_ba_clicked')
  electron.ipcRenderer.send('send-feed-back-to-github-issue')
}
const handleClickLaunchBrowserDownloader = async () => {
  gtagRenderer('launch_browser_downloader_clicked')
  try {
    const downloadedBrowserPath = await electron.ipcRenderer.invoke('download-browser-with-downloader')
    if (downloadedBrowserPath) {
      formData.value.browserPath = downloadedBrowserPath
      ElMessage({
        message: '专用浏览器下载完成，已自动填入并保存路径',
        type: 'success',
        grouping: true
      })
      await handleSave()
      gtagRenderer('browser_downloader_done_with_path')
    } else {
      ElMessage({
        message: '下载已完成，请点击「自动检测」加载路径',
        type: 'success',
        grouping: true
      })
      gtagRenderer('browser_downloader_done_without_path')
    }
  } catch {
    gtagRenderer('browser_downloader_cancelled')
  }
}

const faqMainRef = ref()
onMounted(() => {
  const faqItemEls = faqMainRef?.value?.querySelectorAll(`details`) ?? []
  for (const el of faqItemEls) {
    el.addEventListener('toggle', () => {
      gtagRenderer('faq_item_toggled', {
        faqId: el.dataset.faqId,
        isOpen: el.open
      })
    })
  }
})
</script>

<style lang="scss" scoped>
.browser-preferences {
  height: 100vh;
  overflow-y: auto;
  background-color: var(--el-bg-color-page);

  &.embedded {
    height: auto;
    flex: 0 0 auto;
    overflow: visible;
  }
}

.path-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  flex-wrap: wrap;

  .path-input {
    flex: 1;
    min-width: 240px;
  }

  .el-button + .el-button {
    margin-left: 0;
  }
}

.mb0 {
  margin-bottom: 0;
}

.faq-item {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background-color: var(--el-fill-color-lighter);
  padding: 10px 14px;

  & + .faq-item {
    margin-top: 10px;
  }

  summary {
    font-size: 13.5px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    cursor: pointer;
    line-height: 1.6;
  }

  .faq-answer {
    margin-top: 8px;
    font-size: 13px;
    line-height: 1.7;
    color: var(--el-text-color-regular);

    p {
      margin: 0 0 6px;
    }

    ul {
      margin: 0;
      padding-left: 18px;
    }

    li + li {
      margin-top: 6px;
    }

    a {
      color: var(--el-color-primary);
      font-weight: 500;

      &:hover {
        text-decoration: underline;
      }
    }
  }
}
</style>

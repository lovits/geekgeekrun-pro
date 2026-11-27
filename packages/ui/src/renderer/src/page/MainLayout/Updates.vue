<template>
  <div class="ggr-page updates-page">
    <header class="ggr-page-header">
      <div>
        <h2 class="ggr-page-title">应用设置</h2>
        <p class="ggr-page-desc">管理界面外观主题、跨设备配置备份以及版本检查更新</p>
      </div>
    </header>

    <!-- Card 1: 外观主题 -->
    <section class="ggr-card">
      <div class="ggr-card-header">
        <h3 class="ggr-card-title">界面外观模式</h3>
        <span class="ggr-card-subtitle">切换后所有窗口即时生效并自动记住偏好</span>
      </div>
      <div class="theme-cards">
        <button
          type="button"
          class="theme-option"
          :class="{ active: theme.mode.value === 'light' }"
          @click="theme.setTheme('light')"
        >
          <strong>☀ 浅色模式</strong>
          <span>清爽通透，适合日间明亮环境</span>
        </button>
        <button
          type="button"
          class="theme-option"
          :class="{ active: theme.mode.value === 'dark' }"
          @click="theme.setTheme('dark')"
        >
          <strong>☾ 深色模式</strong>
          <span>柔和护眼，降低夜间屏幕眩光</span>
        </button>
        <button
          type="button"
          class="theme-option"
          :class="{ active: theme.mode.value === 'system' }"
          @click="theme.setTheme('system')"
        >
          <strong>🖥 跟随系统</strong>
          <span>随 macOS / Windows 系统外观自动切换</span>
        </button>
      </div>
    </section>

    <!-- Card 2: 配置导入与导出 -->
    <section class="ggr-card">
      <div class="ggr-card-header">
        <h3 class="ggr-card-title">配置备份与迁移</h3>
      </div>
      <p class="card-text">
        可将筛选规则、求职偏好、提示词与定时策略导出为单个配置文件。出于安全考虑，API 密钥、BOSS 登录状态和本机程序路径不会包含在导出文件中。
      </p>
      <div class="actions">
        <el-button type="primary" plain @click="exportConfig">导出配置文件</el-button>
        <el-button @click="importConfig">导入配置文件</el-button>
        <RecordExport label="导出记录" button-size="default" />
      </div>
    </section>

    <!-- Card 3: 版本与自动更新 -->
    <section class="ggr-card">
      <div class="ggr-card-header">
        <h3 class="ggr-card-title">版本与软件更新</h3>
        <el-tag size="small" type="info" effect="plain">当前版本 v{{ buildInfo.version }}</el-tag>
      </div>

      <div class="repo-links">
        <div>
          <span class="label">项目仓库：</span>
          <el-link type="primary" @click="open(projectUrl)">{{ projectRepository }}</el-link>
        </div>
        <div>
          <span class="label">上游仓库：</span>
          <el-link type="primary" @click="open(upstreamUrl)">geekgeekrun/geekgeekrun</el-link>
        </div>
      </div>

      <div class="update-controls">
        <el-checkbox :model-value="store.autoCheck" @change="store.setAutoCheck(Boolean($event))">
          启动时自动检查更新（每天最多检查一次，发现新版本自动下载安装包）
        </el-checkbox>
        <div class="actions">
          <el-button :loading="store.checking" @click="store.checkUpdate(true)">立即检查更新</el-button>
          <span v-if="store.lastCheckedAt" class="muted">上次检查：{{ store.lastCheckedAt }}</span>
        </div>
      </div>

      <el-alert v-if="store.updateError" :title="store.updateError" type="error" :closable="false" class="mt12" />
      <p v-if="store.checking" class="muted mt12">正在检查新版本…</p>

      <div v-else-if="store.checkStatus === 'available' && store.availableNewRelease" class="release-box mt12">
        <div class="release-head">
          <strong>发现新版本 {{ store.availableNewRelease.releaseVersion }}</strong>
          <div class="actions">
            <el-button type="primary" size="small" :loading="store.downloading" @click="store.downloadUpdate">
              {{ store.downloading ? '正在下载…' : '下载安装包' }}
            </el-button>
            <el-button size="small" @click="open(store.availableNewRelease.releasePageUrl)">查看发布说明</el-button>
          </div>
        </div>
        <pre class="release-note">{{ store.availableNewRelease.releaseNote }}</pre>
        <p v-if="store.downloaded" class="muted">安装包已保存至：{{ store.downloaded.path }}（请双击手动安装）</p>
        <el-alert v-if="store.downloadError" :title="store.downloadError" type="error" :closable="false" />
      </div>

      <p v-else-if="store.checkStatus === 'latest'" class="muted mt12">当前已是最新版本。</p>
      <p v-else-if="store.checkStatus === 'error'" class="muted mt12">检查更新失败，请检查网络后重试。</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUpdateStore } from '@renderer/store'
import useBuildInfo from '@renderer/hooks/useBuildInfo'
import { useTheme } from '@renderer/composables/useTheme'
import { projectRepository, projectUrl, upstreamUrl } from '@geekgeekrun/utils/project-links.mjs'
import RecordExport from '@renderer/features/RecordExport/index.vue'

const store = useUpdateStore()
const { buildInfo } = useBuildInfo()
const theme = useTheme()

async function exportConfig() {
  try {
    const result = await window.electron.ipcRenderer.invoke('export-portable-config', { autoCheckUpdates: store.autoCheck })
    if (result) ElMessage.success(`配置已导出至：${result.path}`)
  } catch (error) {
    ElMessage.error(String(error))
  }
}

async function importConfig() {
  try {
    await ElMessageBox.confirm(
      '导入后将覆盖当前筛选项与偏好设置（系统会自动生成备份）。BOSS 登录状态和本机程序路径不受影响；自动回复与定时开聊默认保持关闭，需确认后再手动开启。',
      '导入配置文件',
      { type: 'warning', confirmButtonText: '选择配置文件', cancelButtonText: '取消' }
    )
    const result = await window.electron.ipcRenderer.invoke('import-portable-config')
    if (result) {
      if (typeof result.autoCheckUpdates === 'boolean') localStorage.setItem('auto-check-updates', String(result.autoCheckUpdates))
      await ElMessageBox.alert('配置已成功导入，建议重启应用以使全部设置生效。', '导入完成')
    }
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(String(error))
  }
}

function open(url: string) {
  window.electron.ipcRenderer.send('open-external-link', url)
}
</script>

<style scoped lang="scss">
.updates-page {
  flex: 0 0 auto;
}

.theme-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 780px) {
  .theme-cards {
    grid-template-columns: minmax(0, 1fr);
  }
}

.theme-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid var(--el-border-color-light);
  background-color: var(--el-fill-color-lighter);
  color: var(--el-text-color-primary);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;

  strong {
    font-size: 13.5px;
    font-weight: 600;
  }

  span {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  &:hover {
    border-color: var(--el-border-color);
  }

  &.active {
    border-color: var(--el-color-primary);
    background-color: var(--el-color-primary-light-9);

    strong {
      color: var(--el-color-primary);
    }
  }
}

.card-text {
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 1.65;
  color: var(--el-text-color-regular);
}

.repo-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 28px;
  margin-bottom: 12px;
  font-size: 13px;

  .label {
    color: var(--el-text-color-secondary);
  }
}

.update-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;

  .el-button + .el-button {
    margin-left: 0;
  }
}

.muted {
  font-size: 12.5px;
  color: var(--el-text-color-secondary);
  margin: 0;
}

.mt12 {
  margin-top: 12px;
}

.release-box {
  padding: 14px 16px;
  border-radius: 10px;
  background-color: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-light);
}

.release-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.release-note {
  margin: 0 0 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background-color: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 12.5px;
  line-height: 1.65;
  max-height: 260px;
  overflow: auto;
}
</style>

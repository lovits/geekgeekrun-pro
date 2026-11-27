<template>
  <div class="main-layout-shell">
    <aside class="aside-nav">
      <div class="brand-header">
        <div class="brand-logo">G</div>
        <div class="brand-meta">
          <div class="brand-title">GeekGeekRun</div>
          <div class="brand-subtitle">求职自动化工作台</div>
        </div>
      </div>

      <nav class="nav-list">
        <RouterLink v-show="false" to="./TaskManager">任务管理</RouterLink>
        <BossPart />
        <hr class="group-divider" />
        <GlobalConfigPart />
        <hr class="group-divider" />
        <RunDataRecordPart />
      </nav>

      <footer class="aside-footer">
        <div class="theme-switcher" role="radiogroup" aria-label="界面外观模式">
          <button
            type="button"
            class="theme-btn"
            :class="{ active: theme.mode.value === 'light' }"
            @click="theme.setTheme('light')"
          >
            ☀ 浅色
          </button>
          <button
            type="button"
            class="theme-btn"
            :class="{ active: theme.mode.value === 'dark' }"
            @click="theme.setTheme('dark')"
          >
            ☾ 深色
          </button>
          <button
            type="button"
            class="theme-btn"
            :class="{ active: theme.mode.value === 'system' }"
            @click="theme.setTheme('system')"
          >
            跟随系统
          </button>
        </div>

        <div class="footer-meta">
          <span class="version-text" :title="`构建号 ${buildInfo.buildVersion}`">v{{ buildInfo.version }}</span>
          <div class="footer-links">
            <el-button link size="small" @click="handleGotoProjectPageClick">主页</el-button>
            <span class="dot">·</span>
            <el-button link size="small" @click="handleFeedbackClick">反馈</el-button>
            <span class="dot">·</span>
            <el-button
              link
              size="small"
              :type="route.path === '/main-layout/Updates' ? 'primary' : 'default'"
              @click="$router.push('/main-layout/Updates')"
            >
              设置
            </el-button>
          </div>
        </div>
      </footer>
    </aside>

    <div ref="contentPane" class="router-view-wrap">
      <RouterView v-slot="{ Component }">
        <KeepAlive>
          <component :is="Component" />
        </KeepAlive>
      </RouterView>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { projectUrl } from '@geekgeekrun/utils/project-links.mjs'
import { useRouter, useRoute } from 'vue-router'
import { ref, watch, nextTick } from 'vue'
import useBuildInfo from '@renderer/hooks/useBuildInfo'
import { useTheme } from '@renderer/composables/useTheme'
import { gtagRenderer } from '@renderer/utils/gtag'
import { useUpdateStore, useTaskManagerStore } from '../../store/index'
import BossPart from './LeftNavBar/BossPart.vue'
import GlobalConfigPart from './LeftNavBar/GlabalConfigPart.vue'
import RunDataRecordPart from './LeftNavBar/RunDataRecordPart.vue'

useRouter()
const route = useRoute()
const theme = useTheme()
const contentPane = ref<HTMLElement>()
watch(() => route.fullPath, async () => { await nextTick(); if (contentPane.value) contentPane.value.scrollTop = 0 })

const { buildInfo } = useBuildInfo()
const handleFeedbackClick = () => {
  gtagRenderer('goto_feedback_clicked')
  electron.ipcRenderer.send('send-feed-back-to-github-issue')
}
const handleGotoProjectPageClick = () => {
  gtagRenderer('goto_project_github_clicked')
  electron.ipcRenderer.send('open-external-link', projectUrl)
}

useUpdateStore()

const taskManagerStore = useTaskManagerStore()
void taskManagerStore
</script>

<style lang="scss" scoped>
.main-layout-shell {
  display: flex;
  height: 100vh;
  width: 100%;
  overflow: hidden;
  background-color: var(--el-bg-color-page);
}

.aside-nav {
  box-sizing: border-box;
  flex: 0 0 206px;
  width: 206px;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 10px 10px 8px;
  background-color: var(--ggr-sidebar-bg);
  border-right: 1px solid var(--ggr-sidebar-border);
  user-select: none;
}

.brand-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 6px 8px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--ggr-sidebar-border);
}

.brand-logo {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background-color: var(--el-color-primary);
  color: #ffffff;
  font-weight: 700;
  font-size: 12.5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.brand-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  letter-spacing: -0.2px;
  line-height: 1.2;
}

.brand-subtitle {
  font-size: 10.5px;
  color: var(--el-text-color-secondary);
  margin-top: 0;
}

.nav-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  padding: 0;

  hr.group-divider {
    width: calc(100% - 14px);
    margin: 4px auto;
    border: 0;
    height: 1px;
    background-color: var(--ggr-sidebar-border);
  }
}

.aside-footer {
  flex-shrink: 0;
  padding-top: 6px;
  border-top: 1px solid var(--ggr-sidebar-border);
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.theme-switcher {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
  padding: 2px;
  border-radius: 6px;
  background-color: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-light);
}

.theme-btn {
  border: 0;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  padding: 3px 2px;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;

  &:hover {
    color: var(--el-text-color-primary);
  }

  &.active {
    background-color: var(--el-bg-color);
    color: var(--el-color-primary);
    font-weight: 600;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  }
}

.footer-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
  font-size: 11px;
}

.version-text {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.footer-links {
  display: flex;
  align-items: center;
  gap: 4px;

  .dot {
    color: var(--el-text-color-placeholder);
    font-size: 10.5px;
  }

  :deep(.el-button) {
    height: auto;
    padding: 0;
    margin: 0;
    font-size: 11px;
  }
}

.router-view-wrap {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  background-color: var(--el-bg-color-page);
}
</style>

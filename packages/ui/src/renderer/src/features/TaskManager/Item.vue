<template>
  <el-card class="task-item">
    <div class="task-preview">
      <div flex flex-items-center justify-between mb-8px>
        <span class="font-size-12px" style="color: var(--el-text-color-secondary)">实时画面</span>
        <el-button type="danger" plain size="small" @click="stopTask(task.workerId)">结束任务</el-button>
      </div>
      <div class="preview-frame">
        <img v-if="task.screenshot" block :src="task.screenshot" height="190" width="340" />
        <div v-else class="preview-empty">暂无画面截图</div>
        <div v-if="task.screenshotAt" class="preview-time">
          {{ dayjs(task.screenshotAt).format('YYYY-MM-DD HH:mm:ss') }}
        </div>
      </div>
    </div>
    <div class="task-meta">
      <dl>
        <dt>任务标识</dt>
        <dd>{{ task.workerId }}</dd>
      </dl>
      <dl>
        <dt>运行状态</dt>
        <dd>{{ task.status }}</dd>
      </dl>
      <dl>
        <dt>重启次数</dt>
        <dd>{{ task.restartCount }}</dd>
      </dl>
      <dl>
        <dt>运行时长</dt>
        <dd>{{ formatUptime(task.uptime) }}</dd>
      </dl>
      <dl>
        <dt>启动参数</dt>
        <dd class="ggr-mono" style="font-size: 12px">{{ task.command }} {{ task.args?.join(' ') }}</dd>
      </dl>
      <dl>
        <dt>进程 PID</dt>
        <dd class="ggr-mono">{{ task.pid }}</dd>
      </dl>
    </div>
  </el-card>
</template>

<script lang="ts" setup>
import dayjs from 'dayjs'
import { PropType } from 'vue'

defineProps({
  task: {
    type: Object as PropType<any>
  }
})

function formatUptime(ms?: number) {
  if (typeof ms !== 'number' || Number.isNaN(ms) || ms < 0) return '—'
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec} 秒`
  const min = Math.floor(sec / 60)
  const remSec = sec % 60
  if (min < 60) return `${min} 分 ${remSec} 秒`
  const hr = Math.floor(min / 60)
  return `${hr} 小时 ${min % 60} 分`
}

const { ipcRenderer } = electron
const stopTask = async (workerId: string) => {
  await ipcRenderer.invoke('stop-task', workerId)
}
</script>

<style lang="scss" scoped>
.task-item {
  width: 100%;
  max-width: 980px;
  margin: 0 auto 14px;
  font-size: 13.5px;
  overflow: hidden;
  :deep(.el-card__body) {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
  }
  .task-preview {
    flex: 0 0 340px;
  }
  .preview-frame {
    position: relative;
    width: 340px;
    height: 190px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--el-border-color-lighter);
    background-color: var(--el-fill-color-lighter);
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }
  .preview-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
  .preview-time {
    position: absolute;
    bottom: 0;
    right: 0;
    font-size: 11.5px;
    background-color: rgba(15, 23, 42, 0.72);
    color: #fff;
    padding: 2px 8px;
    border-radius: 6px 0 0 0;
  }
  .task-meta {
    flex: 1;
    min-width: 260px;
  }
  dl {
    margin: 0;
    display: flex;
    padding: 6px 0;
    border-bottom: 1px solid var(--el-border-color-lighter);
    &:last-child {
      border-bottom: 0;
    }
    dt {
      width: 6.5em;
      flex: 0 0 6.5em;
      color: var(--el-text-color-secondary);
    }
    dd {
      margin: 0;
      word-break: break-all;
      color: var(--el-text-color-primary);
    }
  }
}
</style>

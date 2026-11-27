<template>
  <div class="schedule-settings">
    <div class="schedule-header">
      <div class="schedule-header-left">
        <el-switch v-model="config.enabled" active-text="启用定时开聊" />
        <el-tag size="small" :type="config.enabled ? 'primary' : 'info'" effect="light">
          {{ dirty ? autosave.status.value || '正在保存' : status }}
        </el-tag>
        <span class="tz-text">时区：{{ timezone }}</span>
        <el-tooltip placement="top" :enterable="false">
          <template #content>
            <div style="max-width: 340px; line-height: 1.65">
              按当前电脑时区执行。启用后，仅在选定星期与时段内自动开聊，休息结束后也会再次核对时段。关闭主窗口后后台服务仍会继续按时运行；电脑休眠或关机期间不执行、不补跑。手动停止后，当前时段内不再自动拉起。
            </div>
          </template>
          <button type="button" class="ggr-help-btn" aria-label="定时开聊说明">
            <QuestionFilled />
          </button>
        </el-tooltip>
      </div>
    </div>

    <div class="schedule-body" :class="{ muted: !config.enabled }">
      <el-checkbox-group v-model="config.weekdays" class="weekday-group">
        <el-checkbox v-for="day in days" :key="day.value" :value="day.value" :label="day.value">
          {{ day.label }}
        </el-checkbox>
      </el-checkbox-group>

      <div class="periods-grid">
        <div v-for="period in periods" :key="period.key" class="period-item">
          <el-switch v-model="config[period.key].enabled" :active-text="period.label" size="small" />
          <el-time-picker
            v-model="config[period.key].start"
            format="HH:mm"
            value-format="HH:mm"
            :editable="true"
            :clearable="false"
            style="width: 116px"
            size="small"
            :disabled="!config[period.key].enabled"
            placeholder="开始"
          />
          <span class="sep">至</span>
          <el-time-picker
            v-model="config[period.key].end"
            format="HH:mm"
            value-format="HH:mm"
            :editable="true"
            :clearable="false"
            style="width: 116px"
            size="small"
            :disabled="!config[period.key].enabled"
            placeholder="结束"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { QuestionFilled } from '@element-plus/icons-vue'
import { useAutoSave } from '@renderer/composables/useAutoSave'
import { defaultAutoChatSchedule } from '@geekgeekrun/utils/auto-chat-schedule.mjs'

const config = reactive<any>(JSON.parse(JSON.stringify(defaultAutoChatSchedule)))
const saved = ref('')
const status = ref('已关闭')
const timezone = ref('')
let loaded = false

const autosave = useAutoSave(
  () => config,
  async value => {
    await electron.ipcRenderer.invoke('save-config-file-from-ui', JSON.stringify({ autoChatSchedule: value }))
    saved.value = JSON.stringify(value)
    await refresh()
  },
  () => loaded
)
const dirty = computed(() => saved.value !== JSON.stringify(config))
const days = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 0, label: '周日' }
]
const periods = [
  { key: 'morning', label: '上午时段' },
  { key: 'afternoon', label: '下午时段' }
]
const showError = (error: any) => ElMessage.error(error.message || String(error))

async function refresh(initial = false) {
  try {
    const data = await electron.ipcRenderer.invoke('get-auto-chat-schedule')
    if (initial) {
      Object.assign(config, data.config)
      saved.value = JSON.stringify(config)
      await nextTick()
      loaded = true
    }
    status.value = data.state.status || '已关闭'
    timezone.value = data.timezone
  } catch (error) {
    if (initial) showError(error)
  }
}

defineExpose({
  getConfig() {
    if (!saved.value) throw new Error('定时设置尚未加载，请稍候重试')
    return JSON.parse(JSON.stringify(config))
  },
  markSaved(value: typeof config) {
    saved.value = JSON.stringify(value)
    refresh()
  }
})

let timer: ReturnType<typeof setInterval>
onMounted(() => {
  refresh(true)
  timer = setInterval(() => refresh(), 5000)
})
onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
.schedule-settings {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.schedule-header,
.schedule-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.tz-text {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.schedule-body {
  padding: 12px 14px;
  border-radius: 10px;
  background-color: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: opacity 0.15s ease;
}

.schedule-body.muted {
  opacity: 0.72;
}

.weekday-group {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 18px;
}

.weekday-group :deep(.el-checkbox) {
  margin-right: 0;
}

.periods-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 24px;
}

.period-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.sep {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>

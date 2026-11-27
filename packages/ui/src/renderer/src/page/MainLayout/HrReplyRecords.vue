<template>
  <div class="ggr-table-page reply-records">
    <header class="ggr-page-header">
      <div>
        <h2 class="ggr-page-title">回复记录</h2>
        <p class="ggr-page-desc">查看 HR 消息自动回复的处理状态、发送内容与需人工跟进的原因</p>
      </div>
      <div class="ggr-header-actions">
        <el-button size="small" @click="refreshRecords">刷新记录</el-button>
        <RecordExport scope="replies" label="导出回复记录" />
      </div>
    </header>

    <div class="table-card">
      <el-table
        :data="records.slice((page - 1) * pageSize, page * pageSize)"
        size="small"
        height="100%"
        table-layout="fixed"
        empty-text="暂无自动回复记录"
      >
        <el-table-column prop="at" label="时间" width="165">
          <template #default="{ row }">{{ dayjs(row.at).format('YYYY-MM-DD HH:mm:ss') }}</template>
        </el-table-column>
        <el-table-column prop="company" label="公司" min-width="110" show-overflow-tooltip />
        <el-table-column prop="boss" label="HR" width="90" show-overflow-tooltip />
        <el-table-column label="处理结果" width="135">
          <template #default="{ row }">
            <el-tag size="small" :type="statusTagType(row.status)" effect="light">
              {{ statusLabels[row.status] || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="message" label="收到的消息" min-width="180" show-overflow-tooltip />
        <el-table-column label="回复内容／说明" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">{{ row.reply || row.reason || '发送中断请人工核对，不会自动重发' }}</template>
        </el-table-column>
      </el-table>
    </div>

    <div class="pager-bar">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="records.length"
        :page-sizes="[20, 50, 100]"
        small
        layout="total, sizes, prev, pager, next, jumper"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import { useTaskManagerStore } from '@renderer/store'
import RecordExport from '@renderer/features/RecordExport/index.vue'

const tasks = useTaskManagerStore()
const records = ref<any[]>([])
const page = ref(1)
const pageSize = ref(20)

const statusLabels: Record<string, string> = {
  skipped: '无需回复',
  processing: '处理中',
  replied: '已回复',
  resume_sent: '已同意发简历',
  resume_requested: '已发起简历发送',
  wechat_exchanged: '已同意换微信',
  wechat_requested: '已发起换微信',
  phone_exchanged: '已同意换电话',
  phone_requested: '已发起换电话',
  manual: '待人工处理',
  failed: '处理失败',
  uncertain: '结果待核对',
  superseded: '消息更新未发'
}

function statusTagType(status: string): 'success' | 'warning' | 'danger' | 'info' | 'primary' {
  if (['replied', 'resume_sent', 'resume_requested', 'wechat_exchanged', 'wechat_requested', 'phone_exchanged', 'phone_requested'].includes(status)) {
    return 'success'
  }
  if (['manual', 'uncertain', 'processing'].includes(status)) return 'warning'
  if (status === 'failed') return 'danger'
  return 'info'
}

async function refreshRecords() {
  try {
    records.value = await electron.ipcRenderer.invoke('get-hr-reply-records')
  } catch (error: any) {
    ElMessage.error(error.message || String(error))
  }
}

let timer: ReturnType<typeof setInterval>
onMounted(() => {
  refreshRecords()
  timer = setInterval(() => {
    if (tasks.runningTasks.some((task) => task.workerId === 'hrAutoReplyMain')) refreshRecords()
  }, 30000)
})
onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
.table-card {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border-radius: 10px;
  border: 1px solid var(--el-border-color-light);
  background-color: var(--el-bg-color);
}
.pager-bar {
  display: flex;
  justify-content: center;
  flex-shrink: 0;
}
</style>

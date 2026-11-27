<template>
  <div class="ggr-table-page runtime-record-page">
    <header class="ggr-page-header">
      <div>
        <h2 class="ggr-page-title">开聊记录</h2>
        <p class="ggr-page-desc">已成功发起沟通的职位记录，标记「喜欢／不喜欢」可帮助 AI 更懂你的求职偏好</p>
      </div>
      <div class="ggr-header-actions">
        <span v-if="savingFeedback" class="ggr-status-text">正在保存反馈并更新偏好摘要…</span>
        <el-button
          :loading="isTableLoading"
          size="small"
          @click="
            () => {
              gtagRenderer('start_chat_record_refresh_clicked')
              getAutoStartChatRecord()
            }
          "
        >
          刷新
        </el-button>
        <RecordExport scope="chats" />
      </div>
    </header>

    <div v-loading="isTableLoading" class="table-card">
      <div ref="tableContainerEl" class="h-100% of-hidden">
        <ElTable
          ref="tableRef"
          :max-height="tableMaxHeight"
          :data="tableData"
          :row-key="getRowKey"
          size="small"
          table-layout="fixed"
          highlight-current-row
          empty-text="暂无开聊记录"
        >
          <ElTableColumn prop="companyName" label="公司" min-width="150">
            <template #default="{ row }">{{ row.companyName }} <span v-if="isExpectedCompany(row.companyName)" title="期望公司" aria-label="期望公司" style="color: var(--el-color-warning)">★</span></template>
          </ElTableColumn>
          <ElTableColumn prop="jobName" label="职位名称" min-width="170" show-overflow-tooltip />
          <ElTableColumn prop="positionName" label="职位分类" min-width="90" show-overflow-tooltip />
          <ElTableColumn
            prop="date"
            label="开聊时间"
            :formatter="(_row, _col, val) => transformUtcDateToLocalDate(val).format('YYYY-MM-DD HH:mm:ss')"
            min-width="150"
            show-overflow-tooltip
          />
          <ElTableColumn prop="experienceName" label="工作经验" min-width="95" show-overflow-tooltip />
          <ElTableColumn label="薪资" :formatter="(row) => formatJobSalary(row)" min-width="105" show-overflow-tooltip />
          <ElTableColumn label="偏好反馈" :width="156" fixed="right" align="left" header-align="left" class-name="feedback-column">
            <template #default="{ row }">
              <div class="feedback-actions">
                <ElButton
                  size="small"
                  :type="feedback[String(row.encryptJobId)] === 'like' ? 'success' : 'default'"
                  :plain="feedback[String(row.encryptJobId)] !== 'like'"
                  :disabled="!feedbackAvailable || !!savingFeedback"
                  :loading="savingFeedback === String(row.encryptJobId)"
                  :aria-pressed="feedback[String(row.encryptJobId)] === 'like'"
                  @click="markFeedback(row, 'like')"
                >
                  喜欢
                </ElButton>
                <ElButton
                  size="small"
                  :type="feedback[String(row.encryptJobId)] === 'dislike' ? 'danger' : 'default'"
                  :plain="feedback[String(row.encryptJobId)] !== 'dislike'"
                  :disabled="!feedbackAvailable || !!savingFeedback"
                  :aria-pressed="feedback[String(row.encryptJobId)] === 'dislike'"
                  @click="markFeedback(row, 'dislike')"
                >
                  不喜欢
                </ElButton>
              </div>
            </template>
          </ElTableColumn>
          <ElTableColumn label="操作" fixed="right" :width="105">
            <template #default="{ row }">
              <ElButton link type="primary" size="small" @click="handleViewJobSnapshotButtonClick(row)">快照</ElButton>
              <ElButton link type="primary" size="small" @click="handleViewJobOnlineButtonClick(row.encryptJobId)">网页</ElButton>
            </template>
          </ElTableColumn>
        </ElTable>
      </div>
    </div>

    <div class="pager-bar">
      <ElPagination
        v-model:current-page="pagination.pageNo"
        v-model:page-size="pagination.pageSize"
        :page-sizes="pageSizeList"
        small
        :disabled="isTableLoading"
        layout="total, sizes, prev, pager, next, jumper"
        :total="pagination.totalItemCount"
        @size-change="getAutoStartChatRecord"
        @current-change="getAutoStartChatRecord"
      />
    </div>

    <ElDrawer v-model="drawVisibleModelValue" title="职位详情快照" size="min(520px, 90vw)">
      <JobInfoSnapshot
        v-if="selectedJobInfoForViewSnapshot"
        :job-info="selectedJobInfoForViewSnapshot"
        scene="startChatRecord"
        @closed="
          () => {
            gtagRenderer('start_chat_record_closed')
            selectedJobInfoForViewSnapshot = null
          }
        "
      />
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
import { useRecordAutoRefresh } from '@renderer/hooks/useRecordAutoRefresh'
import { formatJobSalary } from '@geekgeekrun/utils/job-salary.mjs'
import RecordExport from '@renderer/features/RecordExport/index.vue'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElTable, ElTableColumn, ElButton, ElPagination, ElDrawer, ElMessage } from 'element-plus'
import { type VChatStartupLog } from '@geekgeekrun/sqlite-plugin/src/entity/VChatStartupLog'
import { transformUtcDateToLocalDate } from '@geekgeekrun/utils/date.mjs'
import { PageReq, PagedRes } from '../../../../common/types/pagination'
import JobInfoSnapshot from '../../features/JobInfoSnapshot/index.vue'
import { gtagRenderer } from '@renderer/utils/gtag'

const tableData = ref<VChatStartupLog[]>([])
const expectedCompanies = ref<string[]>([])
const isExpectedCompany = (name: string) => Boolean(name && expectedCompanies.value.some(item => item && name.toLowerCase().includes(item.toLowerCase())))
const feedback = ref<Record<string, string>>({})
const feedbackAvailable = ref(false)
const savingFeedback = ref('')

async function markFeedback(row: VChatStartupLog, value: string) {
  if (!feedbackAvailable.value || savingFeedback.value) return
  const jobId = String(row.encryptJobId)
  savingFeedback.value = jobId
  const next = feedback.value[jobId] === value ? 'neutral' : value
  try {
    const result = await electron.ipcRenderer.invoke('save-job-feedback', {
      jobId,
      value: next,
      company: row.companyName,
      jobName: row.jobName,
      description: row.description || ''
    })
    if (next === 'neutral') delete feedback.value[jobId]
    else feedback.value[jobId] = next
    if (result.warning) ElMessage.warning(result.warning)
    else ElMessage.success(next === 'neutral' ? '已取消标记并更新偏好摘要' : '已记录偏好，将在后续匹配中生效')
  } catch (error) {
    ElMessage.error(String(error))
  } finally {
    savingFeedback.value = ''
  }
}

const pageSizeList = ref<number[]>([100, 200, 300, 400])
const pagination = ref<Omit<PageReq & PagedRes<unknown>, 'data'>>({
  pageNo: 1,
  pageSize: pageSizeList.value[0],
  totalItemCount: 0
})
const getRowKey = (row: VChatStartupLog) => {
  return `${row.encryptJobId}@${row.date}`
}
const tableRef = ref<InstanceType<typeof ElTable>>()
const isTableLoading = ref(false)

async function getAutoStartChatRecord() {
  try {
    gtagRenderer('start_chat_record_request_sent', {
      page_no: pagination.value.pageNo,
      page_size: pagination.value.pageSize
    })
    isTableLoading.value = true
    const context = await electron.ipcRenderer.invoke('get-job-ai-context')
    expectedCompanies.value = (context.companies || []).map((item: string) => item.trim()).filter(Boolean)
    const { data: res } = (await electron.ipcRenderer.invoke('get-auto-start-chat-record', {
      pageNo: pagination.value.pageNo,
      pageSize: pagination.value.pageSize
    })) as { data: PagedRes<VChatStartupLog> }
    feedback.value = await electron.ipcRenderer.invoke('get-job-feedback')
    feedbackAvailable.value = await electron.ipcRenderer.invoke('get-job-feedback-availability')
    tableData.value = res.data
    pagination.value = {
      totalItemCount: res.totalItemCount,
      pageNo: res.pageNo,
      pageSize: pagination.value.pageSize
    }
    gtagRenderer('start_chat_record_request_success', {
      page_no: pagination.value.pageNo,
      page_size: pagination.value.pageSize
    })
  } catch (err) {
    gtagRenderer('start_chat_record_request_error', {
      err,
      page_no: pagination.value.pageNo,
      page_size: pagination.value.pageSize
    })
    console.log(err)
    tableData.value = []
  } finally {
    tableRef.value?.setScrollTop(0)
    isTableLoading.value = false
  }
}

useRecordAutoRefresh(async () => {
  if (!isTableLoading.value) await getAutoStartChatRecord()
})

const tableMaxHeight = ref<number | undefined>(undefined)
const tableContainerEl = ref<HTMLElement>()
const setTableMaxHeight = () =>
  (tableMaxHeight.value = tableContainerEl.value?.clientHeight ?? undefined)
onMounted(() => {
  setTableMaxHeight()
  const ro = new ResizeObserver(() => setTableMaxHeight())
  ro.observe(tableContainerEl.value!)
  onBeforeUnmount(() => {
    ro.disconnect()
  })
})

async function handleViewJobOnlineButtonClick(encryptJobId: string) {
  gtagRenderer('view_job_online_button_clicked')
  return await electron.ipcRenderer.invoke('open-site-with-boss-cookie', {
    url: `https://www.zhipin.com/job_detail/${encryptJobId}.html`
  })
}

const drawVisibleModelValue = ref(false)
const selectedJobInfoForViewSnapshot = ref<VChatStartupLog | null>(null)
function handleViewJobSnapshotButtonClick(record: VChatStartupLog) {
  gtagRenderer('view_job_snapshot_button_clicked')
  selectedJobInfoForViewSnapshot.value = record
  drawVisibleModelValue.value = true
}
</script>

<style scoped lang="scss">
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
.feedback-actions {
  display: flex;
  gap: 6px;

  :deep(.el-button + .el-button) {
    margin-left: 0;
  }
}
</style>

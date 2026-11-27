<template>
  <div class="ggr-table-page runtime-record-page">
    <header class="ggr-page-header">
      <div>
        <h2 class="ggr-page-title">不合适记录</h2>
        <p class="ggr-page-desc">被筛选规则、BOSS 活跃度或手动排除的职位记录及具体排除原因</p>
      </div>
      <div class="ggr-header-actions">
        <el-button
          :loading="isTableLoading"
          size="small"
          @click="
            () => {
              gtagRenderer('mansr_refresh_clicked')
              getMarkAsNotSuitRecord()
            }
          "
        >
          刷新
        </el-button>
        <RecordExport scope="unsuitable" />
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
          empty-text="暂无不合适记录"
        >
          <ElTableColumn prop="companyName" label="公司" min-width="110" show-overflow-tooltip />
          <ElTableColumn prop="jobName" label="职位名称" min-width="170" show-overflow-tooltip />
          <ElTableColumn prop="positionName" label="职位分类" min-width="90" show-overflow-tooltip />
          <ElTableColumn
            prop="date"
            label="排除时间"
            :formatter="(_row, _col, val) => transformUtcDateToLocalDate(val).format('YYYY-MM-DD HH:mm:ss')"
            min-width="150"
            show-overflow-tooltip
          />
          <ElTableColumn prop="bossName" label="BOSS" width="76" show-overflow-tooltip />
          <ElTableColumn prop="markReason" label="排除原因" min-width="240">
            <template #default="{ row }">
              <el-tooltip
                :content="(markReasonTopicMap[row.markReason] || '原因未记录') + '\n' + formatMarkReason(row)"
                placement="top"
                :show-after="300"
                popper-class="runtime-record-reason-tooltip"
              >
                <div class="record-reason-preview" tabindex="0">
                  <strong>{{ markReasonTopicMap[row.markReason] || '原因未记录' }}</strong>
                  {{ formatMarkReason(row) }}
                </div>
              </el-tooltip>
            </template>
          </ElTableColumn>
          <ElTableColumn prop="experienceName" label="工作经验" min-width="95" show-overflow-tooltip />
          <ElTableColumn label="薪资" :formatter="(row) => formatJobSalary(row)" min-width="105" show-overflow-tooltip />
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
        @size-change="getMarkAsNotSuitRecord"
        @current-change="getMarkAsNotSuitRecord"
      />
    </div>

    <ElDrawer v-model="drawVisibleModelValue" title="职位详情快照" size="min(520px, 90vw)">
      <JobInfoSnapshot
        v-if="selectedJobInfoForViewSnapshot"
        :job-info="selectedJobInfoForViewSnapshot"
        scene="markAsNotSuitRecord"
        @closed="
          () => {
            gtagRenderer('mansr_closed')
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
import { ElTable, ElTableColumn, ElButton, ElPagination, ElDrawer } from 'element-plus'
import { type VMarkAsNotSuitLog } from '@geekgeekrun/sqlite-plugin/src/entity/VMarkAsNotSuitLog'
import { PageReq, PagedRes } from '../../../../common/types/pagination'
import JobInfoSnapshot from '../../features/JobInfoSnapshot/index.vue'
import { MarkAsNotSuitReason } from '@geekgeekrun/sqlite-plugin/src/enums'
import { transformUtcDateToLocalDate } from '@geekgeekrun/utils/date.mjs'
import { gtagRenderer } from '@renderer/utils/gtag'

const tableData = ref<VMarkAsNotSuitLog[]>([])
const pageSizeList = ref<number[]>([100, 200, 300, 400])
const pagination = ref<Omit<PageReq & PagedRes<unknown>, 'data'>>({
  pageNo: 1,
  pageSize: pageSizeList.value[0],
  totalItemCount: 0
})
const getRowKey = (row: VMarkAsNotSuitLog) => {
  return `${row.encryptJobId}@${row.date}`
}
const tableRef = ref<InstanceType<typeof ElTable>>()
const isTableLoading = ref(false)

async function getMarkAsNotSuitRecord() {
  try {
    gtagRenderer('mansr_request_sent', {
      page_no: pagination.value.pageNo,
      page_size: pagination.value.pageSize
    })
    isTableLoading.value = true
    const { data: res } = (await electron.ipcRenderer.invoke('get-mark-as-not-suit-record', {
      pageNo: pagination.value.pageNo,
      pageSize: pagination.value.pageSize
    })) as { data: PagedRes<VMarkAsNotSuitLog> }
    tableData.value = res.data
    pagination.value = {
      totalItemCount: res.totalItemCount,
      pageNo: res.pageNo,
      pageSize: pagination.value.pageSize
    }
    gtagRenderer('mansr_request_success', {
      page_no: pagination.value.pageNo,
      page_size: pagination.value.pageSize
    })
  } catch (err) {
    gtagRenderer('mansr_request_error', {
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
  if (!isTableLoading.value) await getMarkAsNotSuitRecord()
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
const selectedJobInfoForViewSnapshot = ref<VMarkAsNotSuitLog | null>(null)

function handleViewJobSnapshotButtonClick(record: VMarkAsNotSuitLog) {
  gtagRenderer('view_job_snapshot_button_clicked')
  selectedJobInfoForViewSnapshot.value = record
  drawVisibleModelValue.value = true
}

const markReasonTopicMap = {
  [MarkAsNotSuitReason.BOSS_INACTIVE]: 'BOSS 不活跃',
  [MarkAsNotSuitReason.USER_MANUAL_OPERATION_WITH_UNKNOWN_REASON]: '手动标记不合适',
  [MarkAsNotSuitReason.JOB_NOT_SUIT]: '职位条件不符',
  [MarkAsNotSuitReason.JOB_CITY_NOT_SUIT]: '工作城市不符',
  [MarkAsNotSuitReason.JOB_WORK_EXP_NOT_SUIT]: '经验要求不符',
  [MarkAsNotSuitReason.JOB_SALARY_NOT_SUIT]: '薪资范围不符',
  [MarkAsNotSuitReason.COMPANY_NAME_NOT_SUIT]: '命中屏蔽公司'
}

function formatMarkReason(row: VMarkAsNotSuitLog) {
  let saved: any = null
  try {
    saved = JSON.parse(row.extInfo)
  } catch {}
  if (saved?.reason) return saved.reason
  if (row.markReason === MarkAsNotSuitReason.JOB_NOT_SUIT)
    return '早期记录未保存具体排除原因'
  if (row.markReason === MarkAsNotSuitReason.BOSS_INACTIVE && !saved?.bossActiveTimeDesc)
    return '早期记录未保存 BOSS 活跃时间'

  const extInfo = saved
  switch (row.markReason) {
    case MarkAsNotSuitReason.BOSS_INACTIVE:
      return [
        extInfo?.bossActiveTimeDesc && `BOSS 活跃时间：${extInfo.bossActiveTimeDesc}`,
        extInfo?.chosenReasonInUi?.text && `页面选择的排除原因：${extInfo.chosenReasonInUi.text}`
      ]
        .filter(Boolean)
        .join('\n')
    case MarkAsNotSuitReason.JOB_SALARY_NOT_SUIT:
      return [
        extInfo?.salaryDesc && `薪资：${extInfo.salaryDesc}`,
        extInfo?.chosenReasonInUi?.text && `页面选择的排除原因：${extInfo.chosenReasonInUi.text}`
      ]
        .filter(Boolean)
        .join('\n')
    default:
      return extInfo?.chosenReasonInUi?.text
        ? `页面选择的排除原因：${extInfo.chosenReasonInUi.text}`
        : ''
  }
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
</style>

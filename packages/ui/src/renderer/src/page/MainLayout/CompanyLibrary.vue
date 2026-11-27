<template>
  <div class="ggr-table-page runtime-record-page">
    <header class="ggr-page-header">
      <div>
        <h2 class="ggr-page-title">公司库</h2>
        <p class="ggr-page-desc">查看已采集公司的规模、行业与在招岗位，可快捷加入期望名单或屏蔽名单</p>
      </div>
      <div class="ggr-header-actions">
        <el-popover placement="bottom-end" trigger="click" :width="320">
          <template #reference>
            <ElButton size="small" :type="scaleFilter.length || industryFilter.length ? 'primary' : 'default'" plain>
              筛选公司
            </ElButton>
          </template>
          <el-form label-position="top">
            <el-form-item label="公司规模">
              <el-select
                v-model="scaleFilter"
                :teleported="false"
                multiple
                clearable
                collapse-tags
                collapse-tags-tooltip
                placeholder="不限规模"
                @change="applyFilters"
              >
                <el-option label="不限规模" value="" />
                <el-option
                  v-for="option in filterOptions.scales"
                  :key="JSON.stringify([option.scaleLow, option.scaleHigh])"
                  :label="option.scaleLow == null && option.scaleHigh == null ? '未记录' : formatCompanyScale(option.scaleLow, option.scaleHigh)"
                  :value="JSON.stringify([option.scaleLow, option.scaleHigh])"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="所在行业">
              <el-select
                v-model="industryFilter"
                :teleported="false"
                multiple
                clearable
                collapse-tags
                collapse-tags-tooltip
                placeholder="不限行业"
                filterable
                @change="applyFilters"
              >
                <el-option label="不限行业" value="" />
                <el-option
                  v-for="industry in filterOptions.industries"
                  :key="industry"
                  :label="industry"
                  :value="industry"
                />
              </el-select>
            </el-form-item>
          </el-form>
          <ElButton size="small" :disabled="isTableLoading" @click="resetFilters">重置筛选</ElButton>
        </el-popover>
        <el-button
          :loading="isTableLoading"
          size="small"
          @click="
            () => {
              gtagRenderer('company_library_refresh_clicked')
              getCompanyLibrary()
            }
          "
        >
          刷新
        </el-button>
        <RecordExport scope="companies" />
      </div>
    </header>

    <div v-loading="isTableLoading" class="table-card">
      <div ref="tableContainerEl" class="h-100% of-hidden">
        <ElTable
          ref="tableRef"
          :max-height="tableMaxHeight"
          :data="tableData"
          row-key="encryptCompanyId"
          size="small"
          table-layout="fixed"
          highlight-current-row
          empty-text="暂无公司记录"
        >
          <ElTableColumn type="expand" width="36">
            <template #default="{ row }">
              <CompanyJobsPreview :company-id="row.encryptCompanyId" :company-name="row.name" />
            </template>
          </ElTableColumn>
          <ElTableColumn prop="name" label="公司名称" min-width="130" show-overflow-tooltip />
          <ElTableColumn :formatter="(row) => formatCompanyScale(row.scaleLow, row.scaleHigh)" label="公司规模" min-width="120" show-overflow-tooltip />
          <ElTableColumn prop="industryName" label="所在行业" min-width="140" show-overflow-tooltip />
          <ElTableColumn prop="stageName" label="融资阶段" min-width="120" show-overflow-tooltip />
          <ElTableColumn
            v-for="list in companyLists"
            :key="list.key"
            :label="list.label"
            width="115"
            fixed="right"
            align="center"
            header-align="center"
          >
            <template #default="{ row }">
              <el-tooltip :content="buttonLabel(row, list.key)" placement="top">
                <ElButton
                  size="small"
                  :type="containsCompany(row, list.key) ? (list.key === 'expected' ? 'primary' : 'danger') : 'default'"
                  :plain="!containsCompany(row, list.key)"
                  :aria-label="buttonLabel(row, list.key) + '：' + (row.name || '公司未记录')"
                  :aria-pressed="containsCompany(row, list.key)"
                  :disabled="!row.name || savingCompany || !membershipsReady || !memberships.valid || (!containsCompany(row, list.key) && containsCompany(row, list.key === 'expected' ? 'blocked' : 'expected'))"
                  @click="toggleCompany(row, list.key)"
                >
                  {{ containsCompany(row, list.key) ? (list.key === 'expected' ? '已期望' : '已屏蔽') : (list.key === 'expected' ? '+ 期望' : '+ 屏蔽') }}
                </ElButton>
              </el-tooltip>
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
        @size-change="getCompanyLibrary"
        @current-change="getCompanyLibrary"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRecordAutoRefresh } from '@renderer/hooks/useRecordAutoRefresh'
import CompanyJobsPreview from '@renderer/features/CompanyJobsPreview/index.vue'
import RecordExport from '@renderer/features/RecordExport/index.vue'
import { ref, computed, onMounted, onActivated, onBeforeUnmount } from 'vue'
import { ElTable, ElTableColumn, ElButton, ElPagination, ElMessage } from 'element-plus'
import { type VCompanyLibrary } from '@geekgeekrun/sqlite-plugin/src/entity/VCompanyLibrary'
import { PageReq, PagedRes } from '../../../../common/types/pagination'
import { formatCompanyScale } from '@geekgeekrun/sqlite-plugin/src/utils/parser'
import { gtagRenderer } from '@renderer/utils/gtag'

type CompanyList = 'expected' | 'blocked'
const companyLists: { key: CompanyList; label: string }[] = [
  { key: 'expected', label: '期望名单' },
  { key: 'blocked', label: '屏蔽名单' }
]
const memberships = ref({ expected: [] as string[], blocked: [] as string[], valid: true })
const membershipsReady = ref(false)
const savingCompany = ref(false)
const membershipSets = computed(() => ({
  expected: new Set(memberships.value.expected.map((name) => name.trim().toLowerCase())),
  blocked: new Set(memberships.value.blocked.map((name) => name.trim().toLowerCase()))
}))
const containsCompany = (row: VCompanyLibrary, list: CompanyList) =>
  membershipSets.value[list].has((row.name || '').trim().toLowerCase())
const buttonLabel = (row: VCompanyLibrary, list: CompanyList) =>
  (containsCompany(row, list) ? '移出' : '加入') +
  (list === 'expected' ? '期望公司名单' : '屏蔽公司名单')

async function refreshMemberships() {
  try {
    memberships.value = await electron.ipcRenderer.invoke('get-company-list-memberships')
    membershipsReady.value = true
  } catch (error) {
    membershipsReady.value = false
    ElMessage.error(String(error))
  }
}
onActivated(refreshMemberships)
const stopCompanyUpdates = electron.ipcRenderer.on(
  'common-job-condition-config-updated',
  (_, payload) => {
    if (payload.memberships) {
      memberships.value = payload.memberships
      membershipsReady.value = true
    }
  }
)
onBeforeUnmount(() => stopCompanyUpdates())

async function toggleCompany(row: VCompanyLibrary, list: CompanyList) {
  const enabled = !containsCompany(row, list)
  savingCompany.value = true
  try {
    const result = await electron.ipcRenderer.invoke('set-company-list-membership', {
      company: row.name,
      list,
      enabled
    })
    memberships.value = result.memberships
    if (result.warning) ElMessage.warning(result.warning)
    else
      ElMessage.success(
        enabled
          ? '已加入' + (list === 'expected' ? '期望公司名单' : '屏蔽公司名单')
          : '已移出' + (list === 'expected' ? '期望公司名单' : '屏蔽公司名单')
      )
  } catch (error) {
    await refreshMemberships()
    ElMessage.error(String(error))
  } finally {
    savingCompany.value = false
  }
}

const tableData = ref<VCompanyLibrary[]>([])
const scaleFilter = ref<string[]>([])
const industryFilter = ref<string[]>([])
const filterOptions = ref<{
  scales: { scaleLow: number | null; scaleHigh: number | null }[]
  industries: string[]
}>({ scales: [], industries: [] })

function applyFilters() {
  if (scaleFilter.value.includes('')) scaleFilter.value = []
  if (industryFilter.value.includes('')) industryFilter.value = []
  pagination.value.pageNo = 1
  getCompanyLibrary()
}
function resetFilters() {
  scaleFilter.value = []
  industryFilter.value = []
  applyFilters()
}

const pageSizeList = ref<number[]>([100, 200, 300, 400])
const pagination = ref<Omit<PageReq & PagedRes<unknown>, 'data'>>({
  pageNo: 1,
  pageSize: pageSizeList.value[0],
  totalItemCount: 0
})

const tableRef = ref<InstanceType<typeof ElTable>>()
const isTableLoading = ref(false)
let requestId = 0

async function getCompanyLibrary() {
  const currentRequest = ++requestId
  try {
    gtagRenderer('company_library_request_sent', {
      page_no: pagination.value.pageNo,
      page_size: pagination.value.pageSize
    })
    isTableLoading.value = true
    const { data: res } = (await electron.ipcRenderer.invoke('get-company-library', {
      pageNo: pagination.value.pageNo,
      pageSize: pagination.value.pageSize,
      scale: [...scaleFilter.value],
      industry: [...industryFilter.value]
    })) as { data: PagedRes<VCompanyLibrary> & { filterOptions: typeof filterOptions.value } }
    if (currentRequest !== requestId) return
    tableData.value = res.data
    filterOptions.value = res.filterOptions
    pagination.value = {
      totalItemCount: res.totalItemCount,
      pageNo: res.pageNo,
      pageSize: pagination.value.pageSize
    }
    gtagRenderer('company_library_request_success', {
      page_no: pagination.value.pageNo,
      page_size: pagination.value.pageSize
    })
  } catch (err) {
    if (currentRequest !== requestId) return
    gtagRenderer('company_library_request_error', {
      err,
      page_no: pagination.value.pageNo,
      page_size: pagination.value.pageSize
    })
    console.log(err)
    tableData.value = []
  } finally {
    if (currentRequest === requestId) {
      tableRef.value?.setScrollTop(0)
      isTableLoading.value = false
    }
  }
}

useRecordAutoRefresh(async () => {
  if (!isTableLoading.value) await getCompanyLibrary()
})
refreshMemberships()

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
.ggr-header-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}
</style>

<template>
  <div class="ggr-table-page runtime-record-page">
    <header class="ggr-page-header">
      <div>
        <h2 class="ggr-page-title">BOSS 库</h2>
        <p class="ggr-page-desc">已采集的招聘者姓名、所属公司与职务信息</p>
      </div>
      <div class="ggr-header-actions">
        <el-button
          :loading="isTableLoading"
          size="small"
          @click="
            () => {
              gtagRenderer('boss_library_refresh_clicked')
              getBossLibrary()
            }
          "
        >
          刷新
        </el-button>
      </div>
    </header>

    <div v-loading="isTableLoading" class="table-card">
      <div ref="tableContainerEl" class="h-100% of-hidden">
        <ElTable
          ref="tableRef"
          :max-height="tableMaxHeight"
          :data="tableData"
          row-key="encryptBossId"
          size="small"
          table-layout="fixed"
          highlight-current-row
          empty-text="暂无招聘者记录"
        >
          <ElTableColumn prop="companyName" label="所属公司" min-width="140" show-overflow-tooltip />
          <ElTableColumn prop="name" label="招聘者姓名" min-width="120" show-overflow-tooltip />
          <ElTableColumn prop="title" label="职务／身份" min-width="160" show-overflow-tooltip />
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
        @size-change="getBossLibrary"
        @current-change="getBossLibrary"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRecordAutoRefresh } from '@renderer/hooks/useRecordAutoRefresh'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElTable, ElTableColumn, ElButton, ElPagination } from 'element-plus'
import { type VBossLibrary } from '@geekgeekrun/sqlite-plugin/src/entity/VBossLibrary'
import { PageReq, PagedRes } from '../../../../common/types/pagination'
import { gtagRenderer } from '@renderer/utils/gtag'

const tableData = ref<VBossLibrary[]>([])
const pageSizeList = ref<number[]>([100, 200, 300, 400])
const pagination = ref<Omit<PageReq & PagedRes<unknown>, 'data'>>({
  pageNo: 1,
  pageSize: pageSizeList.value[0],
  totalItemCount: 0
})
const tableRef = ref<InstanceType<typeof ElTable>>()
const isTableLoading = ref(false)

async function getBossLibrary() {
  try {
    gtagRenderer('boss_library_request_sent', {
      page_no: pagination.value.pageNo,
      page_size: pagination.value.pageSize
    })
    isTableLoading.value = true
    const { data: res } = (await electron.ipcRenderer.invoke('get-boss-library', {
      pageNo: pagination.value.pageNo,
      pageSize: pagination.value.pageSize
    })) as { data: PagedRes<VBossLibrary> }
    tableData.value = res.data
    pagination.value = {
      totalItemCount: res.totalItemCount,
      pageNo: res.pageNo,
      pageSize: pagination.value.pageSize
    }
    gtagRenderer('boss_library_request_success', {
      page_no: pagination.value.pageNo,
      page_size: pagination.value.pageSize
    })
  } catch (err) {
    gtagRenderer('boss_library_request_error', {
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
  if (!isTableLoading.value) await getBossLibrary()
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

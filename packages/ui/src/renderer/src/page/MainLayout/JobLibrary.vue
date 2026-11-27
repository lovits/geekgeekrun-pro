<template>
  <div class="ggr-table-page runtime-record-page">
    <header class="ggr-page-header">
      <div>
        <h2 class="ggr-page-title">职位库</h2>
        <p class="ggr-page-desc">已采集岗位的快照存档、排序查看与历史变更对比</p>
      </div>
      <div class="ggr-header-actions">
        <el-button
          :loading="isTableLoading"
          size="small"
          @click="
            () => {
              gtagRenderer('job_library_refresh_clicked')
              getJobLibrary()
            }
          "
          >刷新</el-button
        >
        <RecordExport scope="jobs" />
      </div>
    </header>

    <div v-loading="isTableLoading" class="table-card">
      <div ref="tableContainerEl" class="h-100% of-hidden">
        <ElTable
          ref="tableRef"
          :max-height="tableMaxHeight"
          :data="tableData"
          row-key="encryptJobId"
          size="small"
          table-layout="fixed"
          highlight-current-row
          empty-text="暂无职位记录"
          @sort-change="handleCompanySort"
        >
          <ElTableColumn prop="companyName" label="公司" sortable="custom" min-width="110" show-overflow-tooltip />
          <ElTableColumn prop="jobName" label="职位名称" min-width="170" show-overflow-tooltip />
          <ElTableColumn prop="positionName" label="职位分类" min-width="95" show-overflow-tooltip />
          <ElTableColumn prop="experienceName" label="工作经验" min-width="95" show-overflow-tooltip />
          <ElTableColumn
            label="薪资"
            :formatter="(row) => formatJobSalary(row)"
            min-width="105"
            show-overflow-tooltip
          />
          <ElTableColumn prop="bossName" label="BOSS" min-width="95" show-overflow-tooltip />
          <ElTableColumn prop="bossTitle" label="BOSS 职务" min-width="135" show-overflow-tooltip />
          <ElTableColumn label="操作" fixed="right" :width="190">
            <template #default="{ row }">
              <ElButton
                link
                type="primary"
                size="small"
                @click="handleViewJobSnapshotButtonClick(row)"
                >快照</ElButton
              >
              <ElButton
                link
                type="primary"
                size="small"
                @click="handleViewJobHistoryButtonClick(row)"
                >变更记录</ElButton
              >
              <ElButton
                link
                type="primary"
                size="small"
                @click="handleViewJobOnlineButtonClick(row.encryptJobId)"
                >详情</ElButton
              >
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
        @size-change="getJobLibrary"
        @current-change="getJobLibrary"
      />
    </div>

    <ElDrawer v-model="drawVisibleModelValue" title="职位详情快照" size="min(520px, 90vw)">
      <JobInfoSnapshot
        v-if="selectedJobInfoForViewSnapshot"
        :job-info="selectedJobInfoForViewSnapshot"
        scene="jobLibrary"
        @closed="
          () => {
            gtagRenderer('job_info_snapshot_closed')
            selectedJobInfoForViewSnapshot = null
          }
        "
      />
    </ElDrawer>
    <ElDialog
      v-model="historyDialogVisibleModelValue"
      title="职位历史变更对比"
      width="min(960px, 94vw)"
      append-to-body
    >
      <JobInfoHistoryList
        v-if="selectedJobInfoForViewHistory"
        :job-info="selectedJobInfoForViewHistory"
        :job-info-history-list="selectedJobHistory ?? []"
        @closed="
          () => {
            gtagRenderer('job_library_list_dialog_closed')
            selectedJobInfoForViewHistory = null
            selectedJobHistory = null
          }
        "
      />
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
import { useRecordAutoRefresh } from '@renderer/hooks/useRecordAutoRefresh'
import { formatJobSalary } from '@geekgeekrun/utils/job-salary.mjs'
import RecordExport from '@renderer/features/RecordExport/index.vue'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElTable, ElTableColumn, ElButton, ElPagination, ElDrawer, ElDialog, ElMessage } from 'element-plus'
import { type VChatStartupLog } from '@geekgeekrun/sqlite-plugin/src/entity/VChatStartupLog'
import { type JobInfoChangeLog } from '@geekgeekrun/sqlite-plugin/src/entity/JobInfoChangeLog'
import { PageReq, PagedRes } from '../../../../common/types/pagination'
import JobInfoSnapshot from '../../features/JobInfoSnapshot/index.vue'
import JobInfoHistoryList from '../../features/JobInfoHistoryList/index.vue'
import { gtagRenderer } from '@renderer/utils/gtag'

const companyOrder = ref<'ascending' | 'descending' | null>(null)
function handleCompanySort({ order }: { order: 'ascending' | 'descending' | null }) {
  companyOrder.value = order
  pagination.value.pageNo = 1
  getJobLibrary()
}
let requestId = 0
const tableData = ref<VChatStartupLog[]>([])
const pageSizeList = ref<number[]>([100, 200, 300, 400])
const pagination = ref<Omit<PageReq & PagedRes<unknown>, 'data'>>({
  pageNo: 1,
  pageSize: pageSizeList.value[0],
  totalItemCount: 0
})
const tableRef = ref<InstanceType<typeof ElTable>>()
const isTableLoading = ref(false)
async function getJobLibrary() {
  const currentRequest = ++requestId
  try {
    gtagRenderer('job_library_request_sent', {
      page_no: pagination.value.pageNo,
      page_size: pagination.value.pageSize,
    })
    isTableLoading.value = true
    const { data: res } = (await electron.ipcRenderer.invoke('get-job-library', {
      pageNo: pagination.value.pageNo,
      pageSize: pagination.value.pageSize,
      companyOrder: companyOrder.value
    })) as { data: PagedRes<VChatStartupLog> }
    if (currentRequest !== requestId) return
    tableData.value = res.data
    pagination.value = {
      totalItemCount: res.totalItemCount,
      pageNo: res.pageNo,
      pageSize: pagination.value.pageSize
    }
    gtagRenderer('job_library_request_success', {
      page_no: pagination.value.pageNo,
      page_size: pagination.value.pageSize,
    })
  } catch (err) {
    if (currentRequest !== requestId) return
    gtagRenderer('job_library_request_error', {
      err,
      page_no: pagination.value.pageNo,
      page_size: pagination.value.pageSize,
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

useRecordAutoRefresh(async () => { if (!isTableLoading.value) await getJobLibrary() })

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

const drawVisibleModelValue = ref(false)
const selectedJobInfoForViewSnapshot = ref<VChatStartupLog | null>(null)

function handleViewJobSnapshotButtonClick(record: VChatStartupLog) {
  gtagRenderer('view_job_snapshot_button_clicked')
  selectedJobInfoForViewSnapshot.value = record
  drawVisibleModelValue.value = true
}
async function handleViewJobOnlineButtonClick(encryptJobId: string) {
  gtagRenderer('view_job_online_button_clicked')
  return await electron.ipcRenderer.invoke('open-site-with-boss-cookie', {
    url: `https://www.zhipin.com/job_detail/${encryptJobId}.html`
  })
}

const historyDialogVisibleModelValue = ref(false)
const selectedJobInfoForViewHistory = ref<VChatStartupLog | null>(null)
const selectedJobHistory = ref<null | JobInfoChangeLog[]>(null)
async function handleViewJobHistoryButtonClick(record: VChatStartupLog) {
  gtagRenderer('view_job_history_button_clicked')
  let { data: historyList } = await electron.ipcRenderer.invoke(
    'get-job-history-by-encrypt-id',
    record.encryptJobId
  )

  historyList = historyList.map((it) => ({
    ...it,
    ...(() => {
      try {
        return JSON.parse(it.dataAsJson)
      } catch {
        return {}
      }
    })(),
    __ggr_updateTime: it.updateTime
  }))

  // const { data: historyList } = await Promise.resolve({
  //   data: [
  //     {
  //       id: 569,
  //       encryptJobId: 'f0bf76bbd1d8dcf71Hxz2du8EFFY',
  //       updateTime: '2024-10-04T00:12:20.941Z',
  //       dataAsJson:
  //         '{"encryptId":"f0bf76bbd1d8dcf71Hxz2du8EFFY","encryptUserId":"cf615f0b2a5db54a1Xxz2N26Fls~","invalidStatus":false,"jobName":"前端工程师","position":100901,"positionName":"前端开发工程师","location":101010100,"locationName":"工人体育场","experienceName":"1-3年","degreeName":"本科","jobType":0,"proxyJob":0,"proxyType":0,"salaryDesc":"25-40K","payTypeDesc":null,"postDescription":"熟练使用HTML,CSS，JAVASCRIPT;\\n熟练使用NPM或Yarn包管理工具；\\n掌握Sass，PostCss，Less，Stylus进行CSS预处理；\\n熟练使用VITE或Webpack打包工具；\\n精通使用Vue 3.0 、element-PLUS等主流前端框架，熟练使用Vue状态管理，路由配置，vue-loader预处理，组件自定义；\\n熟练使用axios网络组件，掌握使用Cookies，以及网络请求前端加解密技术；\\n熟练掌握前端组件化开发，前端开发框架搭建；\\n掌握前端缓存技术；\\n了解前端优化技巧，并且根据实际情况进行前端框架优化；\\n了解常见前端攻击方式以及预防方法；\\n熟练掌握echarts图表组件，能够对大数据量多图表页面进行性能优化；","encryptAddressId":"6914d969b01eafe21nd409S7FVFSxIm9Wfqf","address":"北京海淀区中软大厦.","longitude":116.334251,"latitude":39.958087,"staticMapUrl":"https://img.bosszhipin.com/beijin/upload/amap_proxy/20230428/48ba41acc9cef1bf3f3c8ba446b40b7757c453bede60b22f6bb61e3b7bce0931da574d19d1d82c88.jpg","pcStaticMapUrl":"https://img.bosszhipin.com/beijin/upload/amap_proxy/20230608/48ba41acc9cef1bf03ae3ae84352bc0cfa3e4b77ee71ca986bb61e3b7bce0931da574d19d1d82c88.jpg","overseasAddressList":[],"overseasInfo":null,"showSkills":["JavaScript","Vue"],"anonymous":0,"jobStatusDesc":"最新"}'
  //     },
  //     {
  //       id: 570,
  //       encryptJobId: 'f0bf76bbd1d8dcf71Hxz2du8EFFY',
  //       updateTime: '2024-10-04T00:12:21.941Z',
  //       dataAsJson:
  //         '{"encryptId":"f0bf76bbd1d8dcf71Hxz2du8EFFY","encryptUserId":"cf615f0b2a5db54a1Xxz2N26Fls~","invalidStatus":false,"jobName":"前端工程师","position":100901,"positionName":"前端开发工程师","location":101010100,"locationName":"肖家河桥","experienceName":"3-5年","degreeName":"本科","jobType":0,"proxyJob":0,"proxyType":0,"salaryDesc":"25-40K","payTypeDesc":null,"postDescription":"熟练使用VITE或Webpack打包工具；\\n精通使用Vue 3.0 、element-PLUS等主流前端框架，熟练使用Vue状态管理，路由配置，vue-loader预处理，组件自定义；\\n熟练使用axios网络组件，掌握使用Cookies，以及网络请求前端加解密技术；\\n熟练掌握前端组件化开发，前端开发框架搭建；\\n掌握前端缓存技术；\\n了解前端优化技巧，并且根据实际情况进行前端框架优化；\\n了解常见前端攻击方式以及预防方法；\\n熟练掌握echarts图表组件，能够对大数据量多图表页面进行性能优化；","encryptAddressId":"6914d969b01eafe21nd409S7FVFSxIm9Wfqf","address":"北京海淀区中软大厦.","longitude":116.334251,"latitude":39.958087,"staticMapUrl":"https://img.bosszhipin.com/beijin/upload/amap_proxy/20230428/48ba41acc9cef1bf3f3c8ba446b40b7757c453bede60b22f6bb61e3b7bce0931da574d19d1d82c88.jpg","pcStaticMapUrl":"https://img.bosszhipin.com/beijin/upload/amap_proxy/20230608/48ba41acc9cef1bf03ae3ae84352bc0cfa3e4b77ee71ca986bb61e3b7bce0931da574d19d1d82c88.jpg","overseasAddressList":[],"overseasInfo":null,"showSkills":["JavaScript","Vue"],"anonymous":0,"jobStatusDesc":"最新"}'
  //     },
  //     {
  //       id: 571,
  //       encryptJobId: 'f0bf76bbd1d8dcf71Hxz2du8EFFY',
  //       updateTime: '2024-10-04T00:12:22.941Z',
  //       dataAsJson:
  //         '{"encryptId":"f0bf76bbd1d8dcf71Hxz2du8EFFY","encryptUserId":"cf615f0b2a5db54a1Xxz2N26Fls~","invalidStatus":false,"jobName":"前端工程师","position":100901,"positionName":"前端开发工程师","location":101010100,"locationName":"惠新西街南口","experienceName":"3-5年","degreeName":"本科","jobType":0,"proxyJob":0,"proxyType":0,"salaryDesc":"20-30K","payTypeDesc":null,"postDescription":"熟练使用HTML,CSS，JAVASCRIPT;\\n熟练使用NPM或Yarn包管理工具；\\n掌握Sass，PostCss，Less，Stylus进行CSS预处理；\\n熟练使用VITE或Webpack打包工具；\\n精通使用Vue 3.0 、element-PLUS等主流前端框架，熟练使用Vue状态管理，路由配置，vue-loader预处理，组件自定义；\\n熟练使用axios网络组件，掌握使用Cookies，以及网络请求前端加解密技术；\\n熟练掌握前端组件化开发，前端开发框架搭建；\\n掌握前端缓存技术；\\n了解前端优化技巧，并且根据实际情况进行前端框架优化；\\n了解常见前端攻击方式以及预防方法；\\n熟练掌握echarts图表组件，能够对大数据量多图表页面进行性能优化；","encryptAddressId":"6914d969b01eafe21nd409S7FVFSxIm9Wfqf","address":"北京海淀区中软大厦.","longitude":116.334251,"latitude":39.958087,"staticMapUrl":"https://img.bosszhipin.com/beijin/upload/amap_proxy/20230428/48ba41acc9cef1bf3f3c8ba446b40b7757c453bede60b22f6bb61e3b7bce0931da574d19d1d82c88.jpg","pcStaticMapUrl":"https://img.bosszhipin.com/beijin/upload/amap_proxy/20230608/48ba41acc9cef1bf03ae3ae84352bc0cfa3e4b77ee71ca986bb61e3b7bce0931da574d19d1d82c88.jpg","overseasAddressList":[],"overseasInfo":null,"showSkills":["JavaScript","Vue"],"anonymous":0,"jobStatusDesc":"最新"}'
  //     }
  //   ].map((it) => ({
  //     ...it,
  //     ...(() => {
  //       try {
  //         return JSON.parse(it.dataAsJson)
  //       } catch {
  //         return {}
  //       }
  //     })(),
  //     __ggr_updateTime: it.updateTime
  //   }))
  // })

  if (!historyList.length) {
    gtagRenderer('job_history_is_not_found')
    ElMessage.warning({
      message: '该职位暂无历史变更记录'
    })
    return
  }
  gtagRenderer('job_history_is_found')
  historyDialogVisibleModelValue.value = true
  selectedJobInfoForViewHistory.value = record
  selectedJobHistory.value = historyList
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

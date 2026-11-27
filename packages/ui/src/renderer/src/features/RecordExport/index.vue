<template>
  <el-button :size="buttonSize" @click="openDialog">{{ label || (scope === 'all' ? '导出记录' : '导出') }}</el-button>
  <el-dialog v-model="visible" title="导出运行记录" width="min(620px, 94vw)" append-to-body :close-on-click-modal="!exporting" :close-on-press-escape="!exporting" :show-close="!exporting">
    <el-form label-position="top" :disabled="exporting">
      <el-form-item label="导出范围"><el-radio-group v-model="selectedScope" class="scope-options"><el-radio-button v-for="(definition, key) in exportScopes" :key="key" :value="key">{{ definition.label }}</el-radio-button></el-radio-group></el-form-item>
      <template v-if="selectedScope !== 'all'">
        <div class="export-fields"><el-form-item label="公司关键词"><el-input v-model="filters.company" maxlength="200" clearable placeholder="不限" /></el-form-item>
          <el-form-item v-if="selectedScope === 'companies'" label="行业关键词"><el-input v-model="filters.industry" maxlength="200" clearable placeholder="不限" /></el-form-item>
          <el-form-item v-else label="岗位名称关键词"><el-input v-model="filters.job" maxlength="200" clearable placeholder="不限" /></el-form-item>
        </div>
        <template v-if="selectedScope !== 'companies'">
          <div v-if="selectedScope !== 'replies'" class="export-fields"><el-form-item label="城市／工作地关键词"><el-input v-model="filters.city" maxlength="200" clearable placeholder="不限" /></el-form-item>
            <el-form-item label="喜欢／不喜欢标签"><el-select v-model="filters.feedback" style="width: 100%"><el-option label="全部" value="all" /><el-option label="喜欢" value="like" /><el-option label="不喜欢" value="dislike" /><el-option label="未标记" value="unmarked" /></el-select></el-form-item>
          </div>
          <el-form-item :label="`${exportScopes[selectedScope].dateLabel}范围（北京时间）`"><el-date-picker v-model="filters.dateRange" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始日期" end-placeholder="结束日期" range-separator="至" style="width: 100%" clearable /></el-form-item>
          <div v-if="selectedScope === 'simulation'" class="export-fields">
            <el-form-item label="沟通状态"><el-select v-model="filters.outcome" style="width: 100%"><el-option label="全部" value="all" /><el-option label="拟沟通" value="eligible" /><el-option label="未沟通" value="ineligible" /><el-option label="已沟通" value="delivered" /><el-option label="评估失败" value="failed" /></el-select></el-form-item>
            <el-form-item label="AI分数"><el-select v-model="filters.score" style="width: 100%"><el-option label="全部" value="all" /><el-option label="有AI分数" value="scored" /><el-option label="无AI分数" value="unscored" /></el-select></el-form-item>
          </div>
          <el-form-item v-if="selectedScope === 'unsuitable'" label="不合适原因"><el-select v-model="filters.markReason" style="width: 100%"><el-option label="全部原因" value="" /><el-option v-for="(name, index) in reasonNames" :key="index" :label="name" :value="index" /></el-select></el-form-item>
        </template>
        <el-form-item label="文件格式"><el-radio-group v-model="format"><el-radio value="csv">CSV（可用 Excel 打开）</el-radio><el-radio value="json">JSON（完整字段）</el-radio></el-radio-group></el-form-item>
      </template>
    </el-form>
    <p class="export-note">{{ selectedScope === 'all' ? '保留完整历史、反馈和评分，以 JSON 导出。' : '导出所有符合条件的记录，不限当前页；条件留空表示不限。' }}</p>
    <template #footer><el-button :disabled="exporting" @click="visible = false">取消</el-button><el-button type="primary" :loading="exporting" @click="exportData">选择保存位置并导出</el-button></template>
  </el-dialog>
</template>
<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { exportScopes, exportReasonNames } from '@geekgeekrun/utils/runtime-export.mjs'
const props = withDefaults(defineProps<{ scope?: 'all' | 'chats' | 'replies' | 'unsuitable' | 'jobs' | 'companies' | 'simulation'; label?: string; buttonSize?: 'small' | 'default' }>(), { scope: 'all', label: '', buttonSize: 'small' })
const visible = ref(false), exporting = ref(false), selectedScope = ref<string>(props.scope), format = ref('json')
const filters = reactive({ company: '', job: '', city: '', industry: '', feedback: 'all', outcome: 'all', score: 'all', dateRange: [] as string[], markReason: '' as number | string })
const reasonNames = exportReasonNames
watch(selectedScope, value => { format.value = value === 'all' ? 'json' : 'csv'; filters.dateRange = []; filters.feedback = 'all'; filters.outcome = 'all'; filters.score = 'all'; filters.markReason = '' })
function openDialog() {
  selectedScope.value = props.scope
  format.value = props.scope === 'all' ? 'json' : 'csv'
  Object.assign(filters, { company: '', job: '', city: '', industry: '', feedback: 'all', outcome: 'all', score: 'all', dateRange: [], markReason: '' })
  visible.value = true
}
async function exportData() {
  exporting.value = true
  try {
    const options = { scope: selectedScope.value, format: format.value, filters: { ...filters, startDate: filters.dateRange?.[0] || '', endDate: filters.dateRange?.[1] || '' } }
    const result = await window.electron.ipcRenderer.invoke('export-runtime-data', JSON.parse(JSON.stringify(options)))
    if (result) { ElMessage.success(`已导出${result.scope === 'all' ? '全部历史记录' : result.count + ' 条记录'}：${result.path}`); visible.value = false }
  } catch (error) { ElMessage.error(String(error)) }
  finally { exporting.value = false }
}
</script>
<style scoped>
.scope-options { display: flex; flex-wrap: wrap; gap: 4px 0; }
.export-fields { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
.export-note { margin: 0; font-size: 13px; line-height: 1.7; color: var(--el-text-color-regular); }
@media (max-width: 540px) { .export-fields { grid-template-columns: minmax(0, 1fr); gap: 0; } }
</style>

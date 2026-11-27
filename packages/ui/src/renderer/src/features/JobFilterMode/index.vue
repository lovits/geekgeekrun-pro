<template>
  <div class="filter-mode-wrap" :class="{ compact }">
    <div v-if="scope !== 'ai'" class="filter-group">
      <div v-if="!compact" class="group-heading">正则与公司规则</div>
      <div class="checkbox-grid">
        <el-checkbox
          v-for="item in regexItems"
          :key="item.key"
          v-model="settings.regexFilters[item.key]"
          :disabled="settings.loading"
          @change="save"
        >
          {{ item.label }}
        </el-checkbox>
      </div>
    </div>

    <div v-if="scope !== 'regex'" class="filter-group" :class="{ mt12: scope === 'all' }">
      <div v-if="!compact" class="group-heading">AI 模型筛选</div>
      <div class="checkbox-grid ai-grid">
        <el-checkbox data-setting="ai-jobName" v-model="settings.aiFilters.jobName" :disabled="settings.loading" @change="save">
          AI 评估岗位名称
        </el-checkbox>
        <el-checkbox data-setting="ai-postDescription" v-model="settings.aiFilters.postDescription" :disabled="settings.loading" @change="save">
          AI 评估岗位描述
        </el-checkbox>
      </div>
    </div>

    <div v-if="scope === 'all'" class="quick-links">
      <el-button size="small" @click="openRegex">编辑公共筛选规则</el-button>
      <el-button size="small" @click="$router.push('/main-layout/AiJobMatch')">编辑 AI 简历与偏好</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { onMounted, onActivated } from 'vue'
import { ElMessage } from 'element-plus'
import { useJobFilterSettings } from '@renderer/store/job-filter-settings'

const router = useRouter()

const props = withDefaults(defineProps<{ scope?: 'all' | 'regex' | 'ai'; compact?: boolean }>(), { scope: 'all', compact: false })
const settings = useJobFilterSettings()
const regexItems = [
  { key: 'experienceName', label: '正则筛选工作经验' },
  { key: 'jobName', label: '正则筛选职位名称' },
  { key: 'positionName', label: '正则筛选职位类型' },
  { key: 'postDescription', label: '正则筛选职位描述' },
  { key: 'companies', label: '启用期望公司名单' },
  { key: 'blockedCompanies', label: '启用屏蔽公司规则' }
]

async function refresh() {
  try {
    await settings.refresh()
  } catch (error) {
    ElMessage.error(String(error))
  }
}
onMounted(refresh)
onActivated(refresh)
async function save() {
  try {
    await settings.save(props.scope)
    ElMessage.success('筛选开关已保存')
  } catch (error) {
    ElMessage.error(String(error))
  }
}
function openRegex() {
  router.push('/main-layout/CommonJobConditionConfig')
}
</script>

<style scoped lang="scss">
.filter-mode-wrap {
  margin: 12px 0;

  &.compact {
    margin: 0;
  }
}

.group-heading {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 8px;
}

.checkbox-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px 16px;

  &.ai-grid {
    grid-template-columns: repeat(2, minmax(0, 220px));
  }

  :deep(.el-checkbox) {
    margin-right: 0;
    height: auto;
    min-height: 28px;
  }


  :deep(.el-checkbox__label) {
    white-space: normal;
    line-height: 1.5;
    font-size: 13.5px;
  }
}

@media (max-width: 820px) {
  .checkbox-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.mt12 {
  margin-top: 12px;
}

.quick-links {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}
</style>

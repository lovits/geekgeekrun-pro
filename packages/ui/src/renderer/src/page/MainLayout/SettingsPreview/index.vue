<template>
  <div class="ggr-page complete-preview" v-loading="loading">
    <header class="ggr-page-header">
      <div>
        <h2 class="ggr-page-title">设置总览</h2>
        <p class="ggr-page-desc">一页核对当前生效的岗位筛选条件、个人资料与实际发送给大模型的输入结构</p>
      </div>
      <el-button :loading="loading" @click="refresh">刷新总览</el-button>
    </header>

    <template v-if="config">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="岗位筛选规则" name="jobs">
          <section class="ggr-card">
            <div class="ggr-card-header">
              <h3 class="ggr-card-title">岗位与公司筛选条件</h3>
            </div>
            <JobFilterSettingsPreview :context="context" :switches="{ regex: config.regexFilters, ai: config.aiFilters }" />
          </section>
        </el-tab-pane>

        <el-tab-pane label="我的资料与偏好" name="personal">
          <section class="ggr-card">
            <div class="ggr-card-header">
              <h3 class="ggr-card-title">我的简历</h3>
              <el-button v-if="config.resumeFileId" link type="primary" @click="previewResume">预览原始 PDF</el-button>
            </div>
            <p class="muted">{{ config.resumeFileName || '尚未导入简历文件' }}</p>
            <el-collapse class="quiet-collapse">
              <el-collapse-item title="查看已保存的简历文本" name="resume">
                <div class="readable-text">{{ config.resumeText || '尚未填写简历内容' }}</div>
              </el-collapse-item>
            </el-collapse>
          </section>

          <section class="ggr-card">
            <div class="ggr-card-header">
              <h3 class="ggr-card-title">自定义求职偏好</h3>
              <el-button link type="primary" @click="$router.push('/main-layout/AiJobMatch')">前往编辑</el-button>
            </div>
            <div class="readable-text">{{ config.preferences || '尚未填写' }}</div>
          </section>

          <section class="ggr-card">
            <div class="ggr-card-header">
              <h3 class="ggr-card-title">历史反馈总结偏好</h3>
            </div>
            <div class="readable-text">{{ config.learnedPreferences || '暂无反馈学习摘要' }}</div>
          </section>
        </el-tab-pane>

        <el-tab-pane label="模型输入载荷" name="input">
          <p class="muted model-line">
            当前模型：<strong>{{ model.model || '尚未启用' }}</strong> · {{ model.reasoningEffort || '默认推理强度' }}
          </p>
          <JobModelInputPreview v-if="payload" :payload="payload" :saved-context="context" />
        </el-tab-pane>
      </el-tabs>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onActivated } from 'vue'
import { ElMessage } from 'element-plus'
import JobFilterSettingsPreview from '@renderer/features/JobFilterSettingsPreview/index.vue'
import JobModelInputPreview from '@renderer/features/JobModelInputPreview/index.vue'

const loading = ref(false)
const activeTab = ref('jobs')
const config = ref<Record<string, any> | null>(null)
const context = ref<Record<string, any>>({})
const model = ref<Record<string, any>>({})
const payload = ref<Record<string, any> | null>(null)
async function previewResume() {
  try {
    await window.electron.ipcRenderer.invoke('preview-job-ai-resume', config.value?.resumeFileId)
  } catch (error) {
    ElMessage.error(String(error))
  }
}

async function refresh() {
  loading.value = true
  try {
    const [snapshot, currentModel] = await Promise.all([
      window.electron.ipcRenderer.invoke('get-job-matching-preview'),
      window.electron.ipcRenderer.invoke('get-job-ai-model')
    ])
    config.value = snapshot.config
    context.value = snapshot.context
    model.value = currentModel
    payload.value = snapshot.payload
  } catch (error) {
    ElMessage.error(String(error))
  } finally {
    loading.value = false
  }
}
onActivated(refresh)
</script>

<style scoped>
.complete-preview {
  flex: 0 0 auto;
}
.muted {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.7;
  margin: 0 0 8px;
}
.model-line {
  margin-bottom: 14px;
}
.readable-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.8;
  font-size: 13.5px;
  color: var(--el-text-color-regular);
}
.quiet-collapse {
  border: 0;
}
.quiet-collapse :deep(.el-collapse-item__header),
.quiet-collapse :deep(.el-collapse-item__wrap) {
  border: 0;
  background: transparent;
}
</style>

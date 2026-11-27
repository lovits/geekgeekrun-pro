<template>
  <section ref="pageRoot" class="ai-match-page">
    <header class="ggr-page-header">
      <div>
        <h2 class="ggr-page-title">AI 模型筛选</h2>
        <p class="ggr-page-desc">在规则筛选之后，结合个人简历与求职偏好对岗位职责进行精细匹配与打分</p>
      </div>
      <div class="ggr-header-actions">
        <span class="ggr-status-text" role="status">{{ autosave.status.value }}</span>
        <el-button size="small" @click="refreshInfo().catch((error) => ElMessage.error(String(error)))">刷新状态</el-button>
      </div>
    </header>

    <div class="model-strip">
      <span class="model-label">当前启用模型</span>
      <strong>{{ modelInfo.model || '尚未启用' }}</strong>
      <el-tag size="small" type="info" effect="plain">
        {{ modelInfo.reasoningEffort === '模型默认' ? '默认推理强度' : modelInfo.reasoningEffort || '默认推理强度' }}
      </el-tag>
      <el-popover placement="bottom-end" :width="340" trigger="click">
        <template #reference>
          <el-button link type="primary" size="small" style="margin-left: auto">查看模型详情</el-button>
        </template>
        <div class="model-detail">
          <div><strong>接入方式：</strong>{{ modelInfo.provider }}</div>
          <div v-if="modelInfo.account"><strong>当前账号：</strong>{{ modelInfo.account }}</div>
          <div style="margin-top: 6px; opacity: 0.85">简历解析与岗位匹配评分共用此模型配置。</div>
        </div>
      </el-popover>
    </div>

    <el-tabs v-model="activeTab" class="match-tabs">
      <el-tab-pane label="匹配设置" name="settings">
        <section data-setting="scope" tabindex="-1" class="ggr-card">
          <div class="ggr-card-header">
            <h3 class="ggr-card-title">AI 评估字段与参考资料</h3>
            <el-tooltip placement="top" :enterable="false">
              <template #content>
                <div style="max-width: 340px; line-height: 1.75">
                  <p style="margin: 0 0 6px">建议各项资料各有侧重：简历写客观经历与技能，求职偏好写期望方向与取舍，筛选条件负责硬性门槛。</p>
                  <p style="margin: 0">避免在不同资料里重复粘贴整段相同文字，保持提供给模型的信息干净一致。</p>
                </div>
              </template>
              <button type="button" class="ggr-help-btn" aria-label="提供给模型的资料说明">
                <QuestionFilled />
              </button>
            </el-tooltip>
          </div>

          <JobFilterMode scope="ai" compact />

          <div class="field-label">提供给大模型的参考资料</div>
          <div class="input-grid">
            <el-checkbox
              v-for="item in inputOptions"
              :key="item.key"
              :data-setting="'input-' + item.key"
              v-model="settings.inputSources[item.key]"
              :disabled="settings.loading"
                  @change="saveInputSources"
            >
              {{ item.label }}
            </el-checkbox>
          </div>
        </section>

        <div class="settings-grid">
          <section class="ggr-card mb0">
            <div class="ggr-card-header">
              <h3 class="ggr-card-title">我的简历</h3>
              <el-tag size="small" effect="plain">仅保存在本机</el-tag>
            </div>

            <div class="actions">
              <el-button size="small" type="primary" plain :loading="importing" @click="importResume">
                导入简历文件（AI 解析）
              </el-button>
              <el-button size="small" :loading="parsing" @click="parseText">AI 整理下方文本</el-button>
              <el-button
                v-if="config.resumeFileName"
                class="resume-file"
                link
                type="primary"
                size="small"
                :disabled="!config.resumeFileId"
                :loading="previewing"
                @click="previewResume"
              >
                {{ config.resumeFileName }} · 预览 PDF
              </el-button>
            </div>

            <el-form-item data-setting="resume" label="简历正文内容" class="mb0">
              <el-input v-model="config.resumeText" type="textarea" :rows="8" maxlength="80000" placeholder="导入 PDF / Markdown 简历或直接粘贴个人经历文本" />
            </el-form-item>

            <el-collapse class="quiet-collapse mt8">
              <el-collapse-item title="查看原文提取与解析记录" name="resume">
                <p class="muted">{{ config.resumeParseMethod || '尚无解析记录' }} · {{ config.resumeParseModel || '模型未记录' }}</p>
                <p v-if="config.resumeParsingNotes?.length" class="muted">待人工核对：{{ config.resumeParsingNotes.join('；') }}</p>
                <pre>{{ config.resumeSourceText || '暂无原始提取文本' }}</pre>
              </el-collapse-item>
            </el-collapse>
          </section>

          <section class="ggr-card mb0">
            <div class="ggr-card-header">
              <h3 class="ggr-card-title">
                自定义求职偏好
                <el-tooltip placement="top" :enterable="false">
                  <template #content>
                    <div style="max-width: 340px; line-height: 1.75">
                      <p style="margin: 0 0 6px">重点填写期望的业务方向、个人取舍与明确排斥项；套用模板后请按真实情况删改。</p>
                      <p style="margin: 0">已勾选简历或筛选条件时，无需在此重复抄写相同信息。</p>
                    </div>
                  </template>
                  <button type="button" class="ggr-help-btn" aria-label="自定义偏好填写说明">
                    <QuestionFilled />
                  </button>
                </el-tooltip>
              </h3>
              <TemplatePicker kind="job-preferences" :defaults="[{ name: 'AI Agent 开发方向', data: agentPreferenceTemplate }]" :value="config.preferences" @apply="value => config.preferences = value" />

            </div>



            <el-form-item data-setting="preferences" label="偏好说明" class="mb0">
              <el-input
                v-model="config.preferences"
                type="textarea"
                :rows="8"
                maxlength="20000"
                placeholder="填写希望从事的岗位职责、加分方向与不考虑的岗位类型"
              />
            </el-form-item>

            <el-collapse v-model="feedbackSections" class="quiet-collapse mt8">
              <el-collapse-item name="feedback">
                <template #title>
                  <span>历史反馈总结偏好</span>
                  <el-tag size="small" :type="settings.inputSources.feedback ? 'success' : 'info'" effect="light" style="margin-left: 8px">
                    {{ settings.inputSources.feedback ? '已启用' : '已关闭' }}
                  </el-tag>
                  <el-tooltip placement="top" :enterable="false">
                    <template #content>
                      <div style="max-width: 340px; line-height: 1.75">
                        根据你在「开聊记录」中标记的「喜欢／不喜欢」，自动计算职责内容相似度（最多微调 ±10 分）并由大模型总结偏好摘要。关闭后仅保留标记，不参与匹配计算；不会覆盖自定义偏好或硬性限制。
                      </div>
                    </template>
                    <QuestionFilled style="width: 14px; height: 14px; margin-left: 6px" aria-label="反馈学习偏好说明" @click.stop />
                  </el-tooltip>
                </template>
                <el-input data-setting="feedback" :model-value="config.learnedPreferences || '暂无反馈学习摘要'" type="textarea" :rows="4" readonly />
              </el-collapse-item>
            </el-collapse>
          </section>
        </div>

        <section class="ggr-card mt16">
          <el-collapse v-model="advancedSections" class="quiet-collapse">
            <el-collapse-item title="高级设置：自定义评估提示词与查看实际模型输入" name="advanced">
              <el-form-item data-setting="prompt" label="匹配评估提示词">
                <el-input v-model="config.customPrompt" type="textarea" :rows="5" maxlength="20000" />
              </el-form-item>
              <el-button size="small" :loading="previewLoading" @click="previewInput">预览实际发送给模型的完整载荷</el-button>
            </el-collapse-item>
          </el-collapse>
        </section>
      </el-tab-pane>

      <el-tab-pane label="单条岗位测试" name="test">
        <section class="ggr-card">
          <div class="ggr-card-header">
            <h3 class="ggr-card-title">测试单条岗位匹配度</h3>
            <span class="ggr-card-subtitle">仅调用模型评分，不会发起任何真实沟通</span>
          </div>

          <div class="two-fields">
            <el-form-item label="公司名称"><el-input v-model="job.company" placeholder="例如：字节跳动" /></el-form-item>
            <el-form-item label="工作城市"><el-input v-model="job.city" placeholder="例如：北京 / 上海" /></el-form-item>
          </div>
          <el-form-item label="岗位名称"><el-input v-model="job.jobName" placeholder="填写完整岗位名称" /></el-form-item>
          <el-form-item label="岗位职责与要求（JD）">
            <el-input v-model="job.postDescription" type="textarea" :rows="6" maxlength="80000" placeholder="粘贴完整的岗位描述与任职要求" />
          </el-form-item>

          <div class="test-actions">
            <el-button type="primary" :loading="testing" @click="testMatch">开始评估打分</el-button>
          </div>

          <div v-if="lastDecision" class="decision-card">
            <div class="score-num">
              <strong>{{ lastDecision.score ?? '—' }}</strong><small>/100</small>
            </div>
            <div class="decision-body">
              <div class="decision-title">
                <el-tag size="small" :type="lastDecision.match ? 'success' : 'info'" effect="light">
                  {{ lastDecision.match ? '匹配通过' : 'AI 判定不匹配' }}
                </el-tag>
              </div>
              <p>{{ briefReason(lastDecision.reason) }}</p>
            </div>
            <el-button link type="primary" @click="showDetails(lastDecision)">查看详情</el-button>
          </div>
          <p v-else-if="result" class="muted mt8" role="status">{{ result }}</p>
        </section>

        <section class="ggr-card">
          <div class="ggr-card-header">
            <h3 class="ggr-card-title">最近评分记录示例</h3>
          </div>
          <el-table v-if="examples.length" :data="examples" style="width: 100%" table-layout="fixed">
            <el-table-column label="岗位" min-width="200">
              <template #default="scope">
                <b>{{ scope.row.jobName }}</b>
                <div class="muted">{{ scope.row.company }}</div>
              </template>
            </el-table-column>
            <el-table-column prop="score" label="分数" width="75" />
            <el-table-column label="评估结论" width="105">
              <template #default="scope">
                <el-tag size="small" :type="scope.row.match ? 'success' : 'info'" effect="light">
                  {{ scope.row.match ? '匹配通过' : '不匹配' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="简要依据" min-width="180">
              <template #default="scope">{{ briefReason(scope.row.reason) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="70">
              <template #default="scope">
                <el-button link type="primary" @click="showDetails(scope.row)">详情</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无评分记录" :image-size="60" />
        </section>
      </el-tab-pane>
    </el-tabs>

    <el-drawer v-model="detailsVisible" title="岗位匹配评估详情" size="min(720px, 90vw)" append-to-body>
      <div v-if="selectedResult" class="result-details">
        <h3>{{ selectedResult.company }} · {{ selectedResult.jobName }}</h3>
        <p>综合评分：{{ selectedResult.score ?? '未评分' }}/100 · 模型：{{ selectedResult.model || '未记录' }}</p>
        <p v-if="selectedResult.baseScore != null">
          模型基础分 {{ selectedResult.baseScore }} · 历史反馈微调 {{ selectedResult.feedbackAdjustment > 0 ? '+' : '' }}{{ selectedResult.feedbackAdjustment }}
        </p>
        <h4>评估依据</h4>
        <p>{{ selectedResult.reason }}</p>
        <h4>关键条件摘要</h4>
        <p>{{ (selectedResult.criteriaSummary || []).join('\n') || '无' }}</p>
        <h4>差异与待确认项</h4>
        <p>{{ (selectedResult.gaps || []).join('\n') || '无明显差异' }}</p>
        <template v-if="selectedResult.description">
          <h4>岗位描述原文</h4>
          <p>{{ selectedResult.description }}</p>
        </template>
        <p v-if="selectedResult.source" class="muted">{{ selectedResult.source }} · {{ selectedResult.evaluatedAt }}</p>
      </div>
    </el-drawer>

    <el-drawer v-model="inputPreviewVisible" title="实际发送给大模型的输入载荷" size="min(940px, 94vw)" append-to-body>
      <JobModelInputPreview v-if="inputPreview" :payload="inputPreview" :saved-context="filterContext" />
    </el-drawer>
  </section>
</template>

<script setup lang="ts">
import JobFilterMode from '@renderer/features/JobFilterMode/index.vue'
import JobModelInputPreview from '@renderer/features/JobModelInputPreview/index.vue'
import { useJobFilterSettings } from '@renderer/store/job-filter-settings'
import { QuestionFilled } from '@element-plus/icons-vue'
import { agentPreferenceTemplate } from './preference-template'
import TemplatePicker from '@renderer/features/PersonalTemplates/TemplatePicker.vue'
import { ref, onMounted, onActivated, watch, nextTick } from 'vue'
import { useAutoSave } from '@renderer/composables/useAutoSave'
import { ElMessage } from 'element-plus'
import { useRoute } from 'vue-router'

const route = useRoute()
const advancedSections = ref<string[]>([])
const feedbackSections = ref<string[]>([])
const pageRoot = ref<HTMLElement>()

async function revealSetting() {
  const focus = String(route.query.focus || '')
  if (
    ![
      'resume',
      'preferences',
      'prompt',
      'scope',
      'feedback',
      'ai-jobName',
      'ai-postDescription',
      ...inputOptions.map((item) => 'input-' + item.key)
    ].includes(focus)
  )
    return
  inputPreviewVisible.value = false
  activeTab.value = 'settings'
  if (focus === 'prompt') advancedSections.value = ['advanced']
  if (focus === 'feedback') feedbackSections.value = ['feedback']
  await nextTick()
  const section = pageRoot.value?.querySelector<HTMLElement>(`[data-setting="${focus}"]`)
  section?.scrollIntoView({ block: 'center' })
  const input = section?.querySelector<HTMLElement>('textarea, input, button') || section
  input?.focus({ preventScroll: true })
}

const settings = useJobFilterSettings()

const config = ref({
  enabled: false,
  resumeFileName: '',
  resumeFileId: '',
  resumeText: '',
  preferences: '',
  learnedPreferences: '',
  feedbackLearnedAt: '',
  resumeSourceText: '',
  resumeParsingNotes: [] as string[],
  resumeParseMethod: '',
  resumeParseModel: '',
  customPrompt: '',
  inputSources: {
    resume: true,
    preferences: true,
    employmentAndTraversal: true,
    regexRules: false,
    pageFilters: false,
    companyRules: false,
    feedback: true
  } as Record<string, boolean>
})
const job = ref({ jobName: '', postDescription: '', company: '', city: '' })
const importing = ref(false)
const activeTab = ref('settings')
const previewing = ref(false)

async function previewResume() {
  previewing.value = true
  try {
    await window.electron.ipcRenderer.invoke('preview-job-ai-resume', config.value.resumeFileId)
  } catch (error) {
    ElMessage.error(String(error))
  } finally {
    previewing.value = false
  }
}

const parsing = ref(false)
const testing = ref(false)
const result = ref('')
const lastDecision = ref<any>(null)
const detailsVisible = ref(false)
const selectedResult = ref<any>(null)
function briefReason(reason: string) {
  return reason?.length > 65 ? reason.slice(0, 65) + '…' : reason
}
function showDetails(row: any) {
  selectedResult.value = row
  detailsVisible.value = true
}

const modelInfo = ref({ provider: '读取中', model: '', account: '', reasoningEffort: '' })
const inputOptions = [
  { key: 'resume', label: '我的简历正文' },
  { key: 'preferences', label: '自定义求职偏好' },
  { key: 'regexRules', label: '公共正则筛选条件' },
  { key: 'employmentAndTraversal', label: '求职类型与条件组合方式' },
  { key: 'pageFilters', label: '城市、经验、学历等页面条件' },
  { key: 'companyRules', label: '期望公司与屏蔽公司规则' },
  { key: 'feedback', label: '历史反馈学习（喜欢／不喜欢）' }
]
const inputPreview = ref<Record<string, any> | null>(null)
const inputPreviewVisible = ref(false)
const previewLoading = ref(false)

async function previewInput() {
  previewLoading.value = true
  try {
    inputPreview.value = await window.electron.ipcRenderer.invoke(
      'preview-job-ai-input',
      JSON.parse(
        JSON.stringify({ ...config.value, inputSources: settings.inputSources, job: job.value })
      )
    )
    inputPreviewVisible.value = true
  } catch (error) {
    ElMessage.error(String(error))
  } finally {
    previewLoading.value = false
  }
}

const filterContext = ref<Record<string, any>>({})
const examples = ref<any[]>([])
async function refreshInfo() {
  const [model, context, scores, latest] = await Promise.all([
    window.electron.ipcRenderer.invoke('get-job-ai-model'),
    window.electron.ipcRenderer.invoke('get-job-ai-context'),
    window.electron.ipcRenderer.invoke('get-job-ai-score-examples'),
    window.electron.ipcRenderer.invoke('get-job-ai-match')
  ])
  modelInfo.value = model
  filterContext.value = context
  config.value.learnedPreferences = latest.learnedPreferences || ''
  config.value.feedbackLearnedAt = latest.feedbackLearnedAt || ''
  examples.value = scores
  await settings.refresh()
}

let mounted = false
let loaded = false
const autosave = useAutoSave(
  () => ({
    resumeFileId: config.value.resumeFileId,
    resumeFileName: config.value.resumeFileName,
    resumeText: config.value.resumeText,
    resumeSourceText: config.value.resumeSourceText,
    resumeParsingNotes: config.value.resumeParsingNotes,
    resumeParseMethod: config.value.resumeParseMethod,
    resumeParseModel: config.value.resumeParseModel,
    preferences: config.value.preferences,
    customPrompt: config.value.customPrompt
  }),
  (value) =>
    window.electron.ipcRenderer.invoke(
      'save-job-ai-match',
      JSON.parse(JSON.stringify({ ...value, inputSources: settings.inputSources }))
    ),
  () => loaded
)

onActivated(() => {
  if (mounted) refreshInfo().then(revealSetting).catch((error) => ElMessage.error(String(error)))
})
watch(
  () => route.query.focus,
  () => {
    if (mounted) revealSetting()
  }
)
onMounted(async () => {
  try {
    config.value = await window.electron.ipcRenderer.invoke('get-job-ai-match')
    await refreshInfo()
    await revealSetting()
    await nextTick()
    loaded = true
  } catch (error) {
    ElMessage.error(String(error))
  } finally {
    await nextTick()
    mounted = true
  }
})

async function saveInputSources() {
  try {
    await settings.save('inputSources')
    await refreshInfo()
  } catch (error) {
    ElMessage.error(String(error))
  }
}
async function importResume() {
  importing.value = true
  try {
    const resume = await window.electron.ipcRenderer.invoke('import-job-ai-resume')
    if (resume) Object.assign(config.value, resume)
  } catch (error) {
    ElMessage.error(String(error))
  } finally {
    importing.value = false
  }
}
async function parseText() {
  parsing.value = true
  try {
    const parsed = await window.electron.ipcRenderer.invoke(
      'parse-job-ai-resume-text',
      config.value.resumeText
    )
    Object.assign(config.value, parsed)
    ElMessage.success('简历文本整理完成，已自动保存')
  } catch (error) {
    ElMessage.error(String(error))
  } finally {
    parsing.value = false
  }
}
async function persist() {
  await autosave.flush()
  if (autosave.lastError.value) throw new Error(autosave.lastError.value)
}
async function testMatch() {
  testing.value = true
  result.value = ''
  lastDecision.value = null
  try {
    await persist()
    const decision = await window.electron.ipcRenderer.invoke(
      'test-job-ai-match',
      JSON.parse(JSON.stringify(job.value))
    )
    lastDecision.value = {
      ...decision,
      jobName: job.value.jobName,
      company: job.value.company,
      description: job.value.postDescription
    }
    result.value = `评分：${decision.score ?? '未评分'}/100 · 模型：${decision.model || '未运行'}\n${decision.match ? '匹配通过' : 'AI 判定不匹配'}：${decision.reason}`
  } catch (error) {
    result.value = String(error)
  } finally {
    testing.value = false
  }
}
</script>

<style scoped lang="scss">
.ai-match-page {
  color: var(--el-text-color-primary);
  min-width: 0;
}

.model-strip {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 12px 16px;
  background-color: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-8);
  border-radius: 10px;
  font-size: 13px;
}

.model-label {
  color: var(--el-text-color-secondary);
}

.model-detail {
  line-height: 1.75;
  font-size: 13px;
  overflow-wrap: anywhere;
}

.match-tabs {
  margin-top: 14px;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  margin: 14px 0 8px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
  color: var(--el-text-color-primary);
}

.input-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px 14px;

  :deep(.el-checkbox) {
    margin: 0;
    min-width: 0;
    height: auto;
    min-height: 28px;
  }


  :deep(.el-checkbox__label) {
    white-space: normal;
    font-size: 13.5px;
    line-height: 1.5;
  }
}

.settings-grid,
.two-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
}

@media (max-width: 980px) {
  .settings-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .input-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .two-fields,
  .input-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;

  .el-button + .el-button {
    margin-left: 0;
  }
}

.preference-template {
  margin-bottom: 12px;
  padding: 12px;
  border-radius: 8px;
  background-color: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
}

.template-box-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
}

.quiet-collapse {
  border: 0;

  :deep(.el-collapse-item__header) {
    font-size: 12.5px;
    height: 36px;
    line-height: 1.5;
    border: 0;
    background: transparent;
    color: var(--el-text-color-secondary);
  }

  :deep(.el-collapse-item__wrap) {
    border: 0;
    background: transparent;
  }
}

pre {
  max-height: 280px;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  padding: 12px;
  border-radius: 8px;
  background-color: var(--el-fill-color-light);
  font-size: 12px;
  line-height: 1.65;
}

.muted {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.65;
}

.decision-card {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 16px;
  padding: 16px 18px;
  border-radius: 10px;
  background-color: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-light);
}

.score-num {
  white-space: nowrap;

  strong {
    font-size: 28px;
    color: var(--el-color-primary);
  }

  small {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-left: 2px;
  }
}

.decision-body {
  flex: 1;
  min-width: 0;

  p {
    margin: 6px 0 0;
    font-size: 13px;
    color: var(--el-text-color-regular);
  }
}

.result-details {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.75;
  font-size: 13.5px;

  h3 {
    margin-top: 0;
  }

  h4 {
    margin: 14px 0 6px;
  }
}

.mb0 {
  margin-bottom: 0;
}

.mt8 {
  margin-top: 8px;
}

.mt16 {
  margin-top: 16px;
}
</style>

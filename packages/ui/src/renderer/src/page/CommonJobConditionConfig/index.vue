<template>
  <div class="common-job-condition-config" :class="{ embedded }">
    <div class="ggr-page">
      <header class="ggr-page-header">
        <div>
          <h2 class="ggr-page-title">公共筛选规则</h2>
          <p class="ggr-page-desc">统一维护公司白名单、屏蔽名单与职位关键词正则，可在自动开聊和跟进任务中直接复用</p>
        </div>
        <span class="ggr-status-text" role="status">{{ autosave.status.value }}</span>
      </header>

      <el-form
        ref="formRef"
        :model="formContent"
        :rules="formRules"
        inline-message
        label-position="top"
        class="common-config-form"
      >
        <!-- Card 1: 启用开关 -->
        <section class="ggr-card">
          <div class="ggr-card-header">
            <h3 class="ggr-card-title">生效规则开关</h3>
            <span class="ggr-card-subtitle">勾选后将在职位过滤阶段自动执行对应规则</span>
          </div>
          <JobFilterMode scope="regex" compact />
        </section>

        <!-- Card 2: 公司名单与屏蔽规则 -->
        <div class="two-col-cards">
          <section class="ggr-card mb0">
            <div class="ggr-card-header">
              <h3 class="ggr-card-title">
                期望投递公司 <JobFilterHelp kind="expected" />
              </h3>
              <TemplatePicker kind="expected-companies" :defaults="expectCompanyTemplateList.map(item => ({ name: item.name, data: item.value }))" :value="formContent.expectCompanies" @apply="value => formContent.expectCompanies = value" />

            </div>
            <el-form-item data-setting="companies" tabindex="-1" prop="expectCompanies" class="mb0">
              <CompanyTags v-model="formContent.expectCompanies" label="期望公司" />
            </el-form-item>
          </section>

          <section ref="blockCompanyNameRegExpSectionEl" class="ggr-card mb0">
            <div class="ggr-card-header">
              <h3 class="ggr-card-title">
                屏蔽公司（支持正则） <JobFilterHelp kind="blocked" />
              </h3>
              <TemplatePicker kind="blocked-companies" :defaults="blockCompanyNameRegExpTemplateList.map(item => ({ name: item.name, data: item.value }))" :value="formContent.blockCompanyNameRegExpStr" @apply="value => formContent.blockCompanyNameRegExpStr = value" />

            </div>
            <el-form-item prop="blockCompanyNameRegExpStr" class="mb0">
              <CompanyTags v-model="formContent.blockCompanyNameRegExpStr" label="屏蔽公司" regex />
            </el-form-item>
          </section>
        </div>

        <!-- Card 3: 工作经验独立正则 -->
        <section data-setting="experienceName" tabindex="-1" class="ggr-card mt16">
          <div class="ggr-card-header">
            <h3 class="ggr-card-title">
              工作经验要求正则
              <el-tooltip content="岗位标注的经验要求需匹配此正则（独立生效，不受下方“且／或”组合逻辑影响）。" placement="top">
                <button type="button" class="ggr-help-btn" aria-label="工作经验正则说明">
                  <QuestionFilled />
                </button>
              </el-tooltip>
            </h3>
            <span class="ggr-card-subtitle">不区分大小写，留空表示不限</span>
          </div>
          <div class="rule-pair">
            <el-form-item prop="expectWorkExpRegExpStr" label="正则表达式" class="mb0">
              <el-input
                v-model="formContent.expectWorkExpRegExpStr"
                class="ggr-mono"
                type="textarea"
                placeholder="例如：在校|应届|经验不限|1-3年"
                :autosize="{ minRows: 2, maxRows: 4 }"
              />
            </el-form-item>
            <el-form-item label="规则备注（仅供自己查看）" class="mb0">
              <el-input
                v-model="formContent.regexAnnotations.experienceName.note"
                type="textarea"
                placeholder="记录这条规则的用途，方便日后维护"
                :autosize="{ minRows: 2, maxRows: 4 }"
              />
            </el-form-item>
          </div>
        </section>

        <!-- Card 4: 职位名称 / 类型 / 描述 正则组合 -->
        <section data-setting="regex" tabindex="-1" class="ggr-card">
          <div class="ggr-card-header">
            <h3 class="ggr-card-title">
              职位关键词正则匹配 <JobFilterHelp kind="jobs" />
            </h3>
            <TemplatePicker kind="job-regex" :defaults="expectJobFilterTemplateList.map(item => ({ name: item.name, data: item.config }))" :value="jobRegexTemplate" @apply="applyJobRegexTemplate" />

          </div>

          <div class="logic-bar">
            <span class="logic-label">多条件匹配关系：</span>
            <el-select
              v-model="formContent.jobDetailRegExpMatchLogic"
              style="width: 340px; max-width: 100%"
              @change="(value) => gtagRenderer('job_detail_re_ml_change', { value })"
            >
              <el-option
                v-for="op in jobDetailRegExpMatchLogicOptions"
                :key="op.value"
                :label="op.name"
                :value="op.value"
              />
            </el-select>
          </div>

          <div class="regex-stack">
            <!-- Rule 1: 职位名称 -->
            <div class="regex-block">
              <div class="regex-block-head">
                <strong>1. 职位名称正则</strong>
                <span class="muted-tag">不区分大小写</span>
              </div>
              <div class="rule-pair">
                <el-form-item prop="expectJobNameRegExpStr" class="mb0">
                  <el-input
                    data-setting="jobName"
                    v-model="formContent.expectJobNameRegExpStr"
                    class="ggr-mono"
                    type="textarea"
                    :placeholder="getJobDetailRegExpMatchLogicConfig({ formContent }).inputPlaceholderText"
                    :autosize="{ minRows: 2, maxRows: 6 }"
                    @blur="formContent.expectJobNameRegExpStr = formContent.expectJobNameRegExpStr?.trim() ?? ''"
                  />
                </el-form-item>
                <el-form-item class="mb0">
                  <el-input
                    v-model="formContent.regexAnnotations.jobName.note"
                    type="textarea"
                    placeholder="备注规则用途（选填）"
                    :autosize="{ minRows: 2, maxRows: 6 }"
                  />
                </el-form-item>
              </div>
            </div>

            <div class="logic-connector">
              <el-tag size="small" type="primary" effect="light">
                {{ getJobDetailRegExpMatchLogicConfig({ formContent }).logicText }}
              </el-tag>
            </div>

            <!-- Rule 2: 职位类型 -->
            <div ref="jobDetailRegExpSectionEl" class="regex-block">
              <div class="regex-block-head">
                <strong>2. 职位类型正则（推荐填写）</strong>
                <span class="muted-tag">不区分大小写</span>
              </div>
              <div class="rule-pair">
                <el-form-item prop="expectJobTypeRegExpStr" class="mb0">
                  <el-input
                    data-setting="positionName"
                    v-model="formContent.expectJobTypeRegExpStr"
                    class="ggr-mono"
                    type="textarea"
                    :placeholder="getJobDetailRegExpMatchLogicConfig({ formContent }).inputPlaceholderText"
                    :autosize="{ minRows: 2, maxRows: 6 }"
                    @blur="formContent.expectJobTypeRegExpStr = formContent.expectJobTypeRegExpStr?.trim() ?? ''"
                  />
                </el-form-item>
                <el-form-item class="mb0">
                  <el-input
                    v-model="formContent.regexAnnotations.positionName.note"
                    type="textarea"
                    placeholder="备注规则用途（选填）"
                    :autosize="{ minRows: 2, maxRows: 6 }"
                  />
                </el-form-item>
              </div>
            </div>

            <div class="logic-connector">
              <el-tag size="small" type="primary" effect="light">
                {{ getJobDetailRegExpMatchLogicConfig({ formContent }).logicText }}
              </el-tag>
            </div>

            <!-- Rule 3: 职位描述 -->
            <div class="regex-block">
              <div class="regex-block-head">
                <strong>3. 职位描述正则</strong>
                <span class="muted-tag">不区分大小写</span>
              </div>
              <div class="rule-pair">
                <el-form-item prop="expectJobDescRegExpStr" class="mb0">
                  <el-input
                    data-setting="postDescription"
                    v-model="formContent.expectJobDescRegExpStr"
                    class="ggr-mono"
                    type="textarea"
                    :placeholder="getJobDetailRegExpMatchLogicConfig({ formContent }).inputPlaceholderText"
                    :autosize="{ minRows: 2, maxRows: 6 }"
                    @blur="formContent.expectJobDescRegExpStr = formContent.expectJobDescRegExpStr?.trim() ?? ''"
                  />
                </el-form-item>
                <el-form-item class="mb0">
                  <el-input
                    v-model="formContent.regexAnnotations.postDescription.note"
                    type="textarea"
                    placeholder="备注规则用途（选填）"
                    :autosize="{ minRows: 2, maxRows: 6 }"
                  />
                </el-form-item>
              </div>
            </div>
          </div>
        </section>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="tsx">
import JobFilterHelp from '@renderer/features/JobFilterHelp/index.vue'
import CompanyTags from '@renderer/features/CompanyTags/index.vue'
import JobFilterMode from '@renderer/features/JobFilterMode/index.vue'
import { useRoute } from 'vue-router'
const { embedded = false } = defineProps<{ embedded?: boolean }>()
const route = useRoute()
import { gtagRenderer as baseGtagRenderer } from '@renderer/utils/gtag'
import { JobDetailRegExpMatchLogic } from '@geekgeekrun/sqlite-plugin/src/enums'
import { QuestionFilled } from '@element-plus/icons-vue'

import {
  getJobDetailRegExpMatchLogicConfig,
  expectCompanyTemplateList,
  blockCompanyNameRegExpTemplateList,
  getRuleOfExpectJobNameRegExpStr,
  getRuleOfExpectJobDescRegExpStr,
  getRuleOfExpectJobTypeRegExpStr,
  getRuleOfBlockCompanyNameRegExpStr,
  jobDetailRegExpMatchLogicOptions
} from '../MainLayout/GeekAutoStartChatWithBoss/common'
import { computed, ref, onActivated, nextTick, watch } from 'vue'
import TemplatePicker from '@renderer/features/PersonalTemplates/TemplatePicker.vue'
import { useAutoSave } from '@renderer/composables/useAutoSave'
import expectJobFilterTemplateList from '../MainLayout/GeekAutoStartChatWithBoss/expectJobFilterTemplateList'

const { ipcRenderer } = window.electron
const gtagRenderer = (name, params?: object) => {
  return baseGtagRenderer(name, {
    scene: 'cjc_config',
    ...params
  })
}

const emptyAnnotations = () =>
  Object.fromEntries(
    ['experienceName', 'jobName', 'positionName', 'postDescription'].map((key) => [
      key,
      { note: '', examples: '' }
    ])
  )
const formContent = ref({
  regexAnnotations: emptyAnnotations(),
  expectCompanies: '',
  jobDetailRegExpMatchLogic: JobDetailRegExpMatchLogic.EVERY,
  expectJobNameRegExpStr: '',
  expectJobTypeRegExpStr: '',
  expectJobDescRegExpStr: '',
  expectWorkExpRegExpStr: '',
  blockCompanyNameRegExpStr: ''
})

const jobRegexTemplate = computed(() => ({
  expectJobNameRegExpStr: formContent.value.expectJobNameRegExpStr,
  expectJobTypeRegExpStr: formContent.value.expectJobTypeRegExpStr,
  expectJobDescRegExpStr: formContent.value.expectJobDescRegExpStr,
  jobDetailRegExpMatchLogic: formContent.value.jobDetailRegExpMatchLogic,
  regexAnnotations: { jobName: formContent.value.regexAnnotations.jobName, positionName: formContent.value.regexAnnotations.positionName, postDescription: formContent.value.regexAnnotations.postDescription }
}))
function applyJobRegexTemplate(value: any) {
  formContent.value.expectJobNameRegExpStr = value.expectJobNameRegExpStr
  formContent.value.expectJobTypeRegExpStr = value.expectJobTypeRegExpStr
  formContent.value.expectJobDescRegExpStr = value.expectJobDescRegExpStr
  formContent.value.jobDetailRegExpMatchLogic = value.jobDetailRegExpMatchLogic
  Object.assign(formContent.value.regexAnnotations, value.regexAnnotations)
}

const jobDetailRegExpSectionEl = ref<HTMLDivElement>()
const blockCompanyNameRegExpSectionEl = ref<HTMLDivElement>()
const formRules = computed(() => ({
  expectJobNameRegExpStr: {
    trigger: 'blur',
    validator: getRuleOfExpectJobNameRegExpStr({ gtagRenderer, jobDetailRegExpSectionEl })
  },
  expectJobTypeRegExpStr: {
    trigger: 'blur',
    validator: getRuleOfExpectJobTypeRegExpStr({ gtagRenderer, jobDetailRegExpSectionEl })
  },
  expectWorkExpRegExpStr: {
    trigger: 'blur',
    validator: getRuleOfExpectJobDescRegExpStr({ gtagRenderer, jobDetailRegExpSectionEl })
  },
  expectJobDescRegExpStr: {
    trigger: 'blur',
    validator: getRuleOfExpectJobDescRegExpStr({ gtagRenderer, jobDetailRegExpSectionEl })
  },
  blockCompanyNameRegExpStr: {
    trigger: 'blur',
    validator: getRuleOfBlockCompanyNameRegExpStr({ gtagRenderer, blockCompanyNameRegExpSectionEl })
  }
}))

const formRef = ref()
let loaded = false
const autosave = useAutoSave(
  () => formContent.value,
  (value) =>
    ipcRenderer.invoke(
      'save-common-job-condition-config',
      {
        ...value,
        expectCompanies: value.expectCompanies
          ? value.expectCompanies.split(',').map((s) => s.trim())
          : []
      },
      { embedded: true }
    ),
  () => loaded
)

async function revealSetting() {
  const focus = String(route.query.focus || '')
  if (
    ![
      'companies',
      'regex',
      'jobName',
      'positionName',
      'postDescription',
      'experienceName'
    ].includes(focus)
  )
    return
  await nextTick()
  const section: HTMLElement | undefined = formRef.value?.$el?.querySelector(
    `[data-setting="${focus}"]`
  )
  const input = section?.querySelector<HTMLTextAreaElement>('textarea')
  const target = focus !== 'companies' && input ? input : section
  target?.scrollIntoView({ block: 'center' })
  target?.focus({ preventScroll: true })
}
watch(() => route.query.focus, revealSetting)

async function loadSettings() {
  loaded = false
  const res = await ipcRenderer.invoke('fetch-config-file-content')
  const commonJobConditionConfig = res.config?.['common-job-condition-config.json'] ?? {}
  Object.keys(formContent.value).forEach((key) => {
    if (key in commonJobConditionConfig) {
      if (key === 'regexAnnotations') {
        formContent.value.regexAnnotations = {
          ...emptyAnnotations(),
          ...commonJobConditionConfig[key]
        }
      } else if (key === 'expectCompanies') {
        formContent.value[key] = (commonJobConditionConfig[key] ?? []).join(',')
      } else {
        formContent.value[key] = commonJobConditionConfig[key]
      }
    }
  })
  await nextTick()
  loaded = true
  await revealSetting()
}
loadSettings()
onActivated(loadSettings)
</script>

<style scoped lang="scss">
.common-job-condition-config {
  height: 100vh;
  overflow-y: auto;
  background-color: var(--el-bg-color-page);

  &.embedded {
    height: auto;
    flex: 0 0 auto;
    overflow: visible;
  }
}

.two-col-cards {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
}

@media (max-width: 920px) {
  .two-col-cards {
    grid-template-columns: minmax(0, 1fr);
  }
}

.rule-pair {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 0.9fr);
  gap: 14px;
}

@media (max-width: 820px) {
  .rule-pair {
    grid-template-columns: minmax(0, 1fr);
  }
}

.logic-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding-bottom: 14px;
  margin-bottom: 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.logic-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-regular);
}

.regex-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.regex-block {
  padding: 14px 16px;
  border-radius: 10px;
  background-color: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
}

.regex-block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
}

.muted-tag {
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
}

.logic-connector {
  display: flex;
  justify-content: center;
  margin: -2px 0;
}

.mb0 {
  margin-bottom: 0;
}

.mt16 {
  margin-top: 16px;
}
</style>

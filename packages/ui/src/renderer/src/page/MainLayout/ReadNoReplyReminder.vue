<template>
  <div class="ggr-page read-no-reply-reminder__wrap" :class="{ 'is-embedded': embedded }">
    <header v-if="!embedded" class="ggr-page-header">
      <div>
        <h2 class="ggr-page-title">已读不回自动跟进</h2>
        <p class="ggr-page-desc">与自动开聊配合运行，对已读未回的 BOSS 会话按设定频率礼貌跟进</p>
      </div>
    </header>

    <el-form
      ref="formRef"
      :rules="formRules"
      :model="formContent.autoReminder"
      label-position="top"
    >
      <!-- Card 1: 跟进范围与频率 -->
      <section class="ggr-card">
        <div class="ggr-card-header">
          <h3 class="ggr-card-title">跟进范围与频率控制</h3>
          <el-tooltip
            placement="bottom-end"
            @show="gtagRenderer('tooltip_show_about_stop_trace_one_boss')"
          >
            <template #content>
              <div style="max-width: 320px; line-height: 1.65">
                <div><strong>如何停止跟进某个 BOSS？</strong></div>
                <div style="margin: 6px 0">向该 BOSS 发送任意一条消息并立即撤回，系统识别到撤回记录后将不再自动跟进。</div>
                <div style="margin-bottom: 6px; opacity: 0.85">电脑端操作：右键点击刚发出的消息，选择「撤回」。</div>
                <img block w-full style="border-radius: 6px" src="./resources/withdraw-message-guide.png" />
              </div>
            </template>
            <el-button link type="primary" size="small">
              <QuestionFilled style="width: 14px; height: 14px; margin-right: 4px" />
              如何单独停止跟进某个 BOSS？
            </el-button>
          </el-tooltip>
        </div>

        <div class="scope-checks">
          <el-checkbox v-if="!expectJobTypeRegExpStrForRender?.trim()" :model-value="false" disabled>
            仅跟进职位类型符合期望的岗位（尚未设置职位类型正则）
          </el-checkbox>
          <el-checkbox v-else v-model="formContent.autoReminder.onlyRemindBossWithExpectJobType">
            仅跟进职位类型符合期望的岗位
          </el-checkbox>

          <el-checkbox v-if="!blockCompanyNameRegExpStrForRender?.trim()" :model-value="false" disabled>
            跳过屏蔽名单中的公司（尚未设置屏蔽公司规则）
          </el-checkbox>
          <el-checkbox v-else v-model="formContent.autoReminder.onlyRemindBossWithoutBlockCompanyName">
            跳过屏蔽名单中的公司
          </el-checkbox>
        </div>

        <div class="freq-grid">
          <el-form-item label="单会话最小跟进间隔" prop="throttleIntervalMinutes" class="mb0">
            <div class="inline-control">
              <el-input-number
                v-model="formContent.autoReminder.throttleIntervalMinutes"
                controls-position="right"
                style="width: 140px"
                :min="3"
                :precision="1"
                :step="0.5"
                @blur="handleThrottleIntervalMinutesBlur"
              />
              <span class="unit-note">分钟内不重复跟进同一位 BOSS</span>
            </div>
          </el-form-item>

          <el-form-item label="历史会话跟进时限" prop="rechatLimitDay" class="mb0">
            <div class="inline-control">
              <el-checkbox v-model="enableRechatLimit">限制天数</el-checkbox>
              <el-input-number
                v-model="formContent.autoReminder.rechatLimitDay"
                controls-position="right"
                style="width: 130px"
                :min="0"
                :precision="1"
                :step="0.5"
                :disabled="!enableRechatLimit"
              />
              <span class="unit-note">天</span>
            </div>
            <div v-if="enableRechatLimit" class="limit-hint">
              仅跟进 <span class="warn-text">{{ rechatLimitDateString }}</span> 之后仍有动态的会话
            </div>
            <div v-else class="limit-hint">
              将跟进列表中的所有历史会话（<span class="warn-text">不建议，可能触达很久以前的沟通</span>）
            </div>
          </el-form-item>
        </div>
      </section>

      <!-- Card 2: 回复内容方式 -->
      <section class="ggr-card">
        <div class="ggr-card-header">
          <h3 class="ggr-card-title">跟进消息生成方式</h3>
        </div>

        <div class="reply-mode-grid">
          <div class="mode-box">
            <div class="mode-box-title">首次开场话术</div>
            <el-radio-group v-model="formContent.autoReminder.openContentSource" class="mode-radios">
              <el-radio :value="OPEN_CONTENT_SOURCE.CONSTANT_CONTENT" :label="OPEN_CONTENT_SOURCE.CONSTANT_CONTENT">
                发送固定开场白
              </el-radio>
              <el-radio :value="OPEN_CONTENT_SOURCE.GEMINI_WITH_CHAT_CONTEXT" :label="OPEN_CONTENT_SOURCE.GEMINI_WITH_CHAT_CONTEXT">
                由大模型结合简历生成
              </el-radio>
            </el-radio-group>

            <el-input
              v-if="formContent.autoReminder.openContentSource === OPEN_CONTENT_SOURCE.CONSTANT_CONTENT"
              v-model="formContent.autoReminder.constantOpenContent"
              :autosize="{ minRows: 3, maxRows: 6 }"
              type="textarea"
              :placeholder="defaultConstantOpenContent"
              class="mt10"
            />
            <div v-else class="prompt-actions mt10">
              <el-button size="small" @click="handleClickEditPrompt({ type: 'open' })">编辑开场白提示词</el-button>
              <el-button size="small" @click="restoreDefaultTemplate({ type: 'open', gaEvName: 'reset_template_clicked_in_main_form' })">
                恢复默认提示词
              </el-button>
            </div>
          </div>

          <div class="mode-box">
            <div class="mode-box-title">后续跟进方式</div>
            <el-radio-group v-model="formContent.autoReminder.rechatContentSource" class="mode-radios">
              <el-tooltip
                placement="top"
                :enterable="false"
                @show="gtagRenderer('tooltip_show_about_lfr_emotion_figure')"
              >
                <template #content>
                  <img block h-100px src="./resources/look-forward-reply-emotion.gif" />
                </template>
                <el-radio :value="RECHAT_CONTENT_SOURCE.LOOK_FORWARD_EMOTION" :label="RECHAT_CONTENT_SOURCE.LOOK_FORWARD_EMOTION">
                  发送「盼回复」表情包（推荐）
                </el-radio>
              </el-tooltip>

              <el-radio :value="RECHAT_CONTENT_SOURCE.GEMINI_WITH_CHAT_CONTEXT" :label="RECHAT_CONTENT_SOURCE.GEMINI_WITH_CHAT_CONTEXT">
                由大模型结合上下文生成
              </el-radio>
            </el-radio-group>

            <div
              v-if="formContent.autoReminder.rechatContentSource === RECHAT_CONTENT_SOURCE.GEMINI_WITH_CHAT_CONTEXT"
              class="prompt-actions mt10"
            >
              <el-button size="small" @click="handleClickEditPrompt({ type: 'rechat' })">编辑跟进提示词</el-button>
              <el-button size="small" @click="restoreDefaultTemplate({ type: 'rechat', gaEvName: 'reset_template_clicked_in_main_form' })">
                恢复默认提示词
              </el-button>
            </div>
          </div>
        </div>
      </section>

      <!-- Card 3: 模型上下文与效果预览 -->
      <section class="ggr-card">
        <div class="ggr-card-header">
          <h3 class="ggr-card-title">模型上下文与效果测试</h3>
          <el-button size="small" type="primary" plain @click="handleTestEffectClicked">
            模拟生成效果
          </el-button>
        </div>

        <template
          v-if="
            [
              formContent.autoReminder.rechatContentSource,
              formContent.autoReminder.openContentSource
            ].includes(RECHAT_CONTENT_SOURCE.GEMINI_WITH_CHAT_CONTEXT)
          "
        >
          <div class="llm-extra-grid">
            <div>
              <div class="sub-label">跟进专用结构化简历</div>
              <div class="inline-control">
                <el-button size="small" @click="handleClickEditResume">编辑跟进简历</el-button>
                <span class="unit-note">模型将结合此简历提炼亮点（不会向对方发送期望薪资）</span>
              </div>
            </div>

            <el-form-item prop="recentMessageQuantityForLlm" label="携带历史消息条数" class="mb0">
              <div class="inline-control">
                <span>参考最近</span>
                <el-input-number
                  v-model="formContent.autoReminder.recentMessageQuantityForLlm"
                  controls-position="right"
                  style="width: 115px"
                  :min="8"
                  :max="20"
                  :precision="0"
                  :step="1"
                />
                <span>条聊天记录避免重复话术</span>
              </div>
            </el-form-item>

            <el-form-item label="所有大模型均调用失败时的兜底处理" class="mb0">
              <el-select v-model="formContent.autoReminder.rechatLlmFallback" style="max-width: 280px">
                <el-option
                  v-for="option in rechatLlmFallbackOptions"
                  :key="option.value"
                  :value="option.value"
                  :label="option.name"
                />
              </el-select>
            </el-form-item>
          </div>
        </template>
        <p v-else class="quiet-note">
          当前开场白与后续跟进均使用固定文案／表情包，无需调用大语言模型；点击右上角「模拟生成效果」可预览对话流程。
        </p>
      </section>

      <!-- Bottom Bar -->
      <div class="ggr-footer-bar">
        <div class="inline-control">
          <el-switch v-model="formContent.autoReminder.enabled" active-text="开启已读不回自动跟进" />
          <span class="unit-note">（需在「自动开聊」运行期间协同生效）</span>
        </div>
        <span class="ggr-status-text" role="status">{{ autosave.status.value }}</span>
      </div>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useAutoSave } from '@renderer/composables/useAutoSave'
import { dayjs, ElForm, ElMessage, ElMessageBox, ElSelect, ElOption } from 'element-plus'
import { useRouter } from 'vue-router'
import {
  OPEN_CONTENT_SOURCE,
  RECHAT_CONTENT_SOURCE,
  RECHAT_LLM_FALLBACK
} from '../../../../common/enums/auto-start-chat'
import { gtagRenderer as baseGtagRenderer } from '@renderer/utils/gtag'
import mittBus from '../../utils/mitt'
import { QuestionFilled } from '@element-plus/icons-vue'
import { DEFAULT_CONSTANT_OPEN_CONTENT_SEGS } from '../../../../common/constant'

defineProps<{ embedded?: boolean }>()
const gtagRenderer = (name, params?: object) => {
  return baseGtagRenderer(name, {
    scene: 'rnrr-config',
    ...params
  })
}
const router = useRouter()
const formContent = ref({
  autoReminder: {
    enabled: false,
    throttleIntervalMinutes: 10,
    rechatLimitDay: 21,
    rechatContentSource: 1,
    recentMessageQuantityForLlm: 8,
    rechatLlmFallback: RECHAT_LLM_FALLBACK.SEND_LOOK_FORWARD_EMOTION,
    onlyRemindBossWithExpectJobType: true,
    onlyRemindBossWithoutBlockCompanyName: true,
    openContentSource: OPEN_CONTENT_SOURCE.CONSTANT_CONTENT,
    constantOpenContent: ''
  }
})

const enableRechatLimit = computed({
  get() {
    return Boolean(formContent.value.autoReminder?.rechatLimitDay)
  },
  set(val) {
    if (!val) {
      gtagRenderer('rechat_limit_disabled')
      formContent.value.autoReminder.rechatLimitDay = 0
    } else {
      gtagRenderer('rechat_limit_enabled')
      formContent.value.autoReminder.rechatLimitDay = 21
    }
  }
})

let loaded = false
electron.ipcRenderer.invoke('fetch-config-file-content').then(async (res) => {
  const conf = res.config['boss.json']?.autoReminder || {}
  conf.enabled = conf.enabled === true
  conf.throttleIntervalMinutes = conf.throttleIntervalMinutes ?? 10
  conf.rechatLimitDay = conf.rechatLimitDay ?? 21
  conf.rechatContentSource = conf.rechatContentSource ?? 1
  conf.recentMessageQuantityForLlm =
    typeof conf.recentMessageQuantityForLlm === 'number'
      ? conf.recentMessageQuantityForLlm > 20
        ? 20
        : conf.recentMessageQuantityForLlm < 8
          ? 8
          : parseInt(String(conf.recentMessageQuantityForLlm))
      : 8
  conf.onlyRemindBossWithExpectJobType = conf.onlyRemindBossWithExpectJobType ?? true
  conf.onlyRemindBossWithoutBlockCompanyName = conf.onlyRemindBossWithoutBlockCompanyName ?? true
  conf.rechatLlmFallback = conf.rechatLlmFallback ?? RECHAT_LLM_FALLBACK.SEND_LOOK_FORWARD_EMOTION
  conf.openContentSource = conf.openContentSource ?? OPEN_CONTENT_SOURCE.CONSTANT_CONTENT
  conf.constantOpenContent = conf.constantOpenContent ?? ''
  formContent.value.autoReminder = conf
  await nextTick()
  loaded = true
})

const expectJobTypeRegExpStr = ref('')
const blockCompanyNameRegExpStr = ref('')
const fieldsForUseCommonConfig = ref<Record<string, boolean>>({})
async function fetchAutoStartChatConfig() {
  await electron.ipcRenderer.invoke('fetch-config-file-content').then((res) => {
    expectJobTypeRegExpStr.value = res.config['boss.json']?.expectJobTypeRegExpStr
    blockCompanyNameRegExpStr.value = res.config['boss.json']?.blockCompanyNameRegExpStr
    fieldsForUseCommonConfig.value = res.config['boss.json']?.fieldsForUseCommonConfig ?? {}
    commonJobConditionConfig.value = res.config['common-job-condition-config.json']
  })
}
fetchAutoStartChatConfig()
mittBus.on('auto-start-chat-with-boss-config-saved', fetchAutoStartChatConfig)
onUnmounted(() => {
  mittBus.off('auto-start-chat-with-boss-config-saved', fetchAutoStartChatConfig)
})
const commonJobConditionConfig = ref<Record<string, any>>({})
const unListenCommonJobConditionConfig = electron.ipcRenderer.on(
  'common-job-condition-config-updated',
  (_, { config }) => {
    commonJobConditionConfig.value = {
      ...config,
      expectCompanies: config?.expectCompanies?.map((it) => it.trim())?.join(',') ?? ''
    }
  }
)
onUnmounted(() => {
  unListenCommonJobConditionConfig()
})

const expectJobTypeRegExpStrForRender = computed(() => {
  return !fieldsForUseCommonConfig.value.jobDetail
    ? expectJobTypeRegExpStr.value
    : commonJobConditionConfig.value.expectJobTypeRegExpStr
})
const blockCompanyNameRegExpStrForRender = computed(() => {
  return !fieldsForUseCommonConfig.value.blockCompanyNameRegExpStr
    ? blockCompanyNameRegExpStr.value
    : commonJobConditionConfig.value.blockCompanyNameRegExpStr
})

const resumeContent = ref<string | null>(null)
async function fetchResumeContent() {
  await electron.ipcRenderer.invoke('fetch-resume-content').then((res) => {
    resumeContent.value = res
  })
}
fetchResumeContent()

const formRules = {
  throttleIntervalMinutes: {
    validator(_, value, cb) {
      if (/[^0-9.]/.test(String(value)) || isNaN(parseFloat(value)) || isNaN(Number(value))) {
        cb(new Error(`请输入有效数字`))
      } else {
        cb()
      }
    }
  },
  rechatLimitDay: {
    validator(_, value, cb) {
      if (/[^0-9.]/.test(String(value)) || isNaN(parseFloat(value)) || isNaN(Number(value))) {
        cb(new Error(`请输入有效数字`))
      } else {
        cb()
      }
    }
  }
}

const formRef = ref<InstanceType<typeof ElForm>>()
watch(
  () => formContent.value.autoReminder,
  () => {
    nextTick(() => {
      formRef.value?.validate?.()
    })
  },
  { immediate: true }
)

async function checkIsCanRun() {
  const needOpenLlm =
    formContent.value.autoReminder.openContentSource === OPEN_CONTENT_SOURCE.GEMINI_WITH_CHAT_CONTEXT
  const needRechatLlm =
    formContent.value.autoReminder.rechatContentSource === RECHAT_CONTENT_SOURCE.GEMINI_WITH_CHAT_CONTEXT
  if (!needOpenLlm && !needRechatLlm) {
    return true
  }
  if (!(await electron.ipcRenderer.invoke('check-is-resume-content-valid'))) {
    gtagRenderer('cannot_launch_for_invalid_rc_dialog_show')
    try {
      await ElMessageBox.confirm(`请先完善跟进专用简历内容后再试`, '简历尚未完善', {
        cancelButtonText: '取消',
        confirmButtonText: '去编辑简历'
      })
      gtagRenderer('invalid_rc_dialog_click_confirm')
      try {
        await electron.ipcRenderer.invoke('resume-edit')
        await fetchResumeContent()
      } catch (err) {
        console.log(err)
      }
    } catch {
      gtagRenderer('invalid_rc_dialog_click_cancel')
    }
    return false
  }
  try {
    await electron.ipcRenderer.invoke('check-if-llm-config-list-valid')
  } catch (err) {
    if ((err instanceof Error ? err.message : undefined)?.includes(`CANNOT_FIND_VALID_CONFIG`)) {
      gtagRenderer('cannot_launch_for_invalid_llm_config')
      ElMessageBox.confirm(
        '尚未配置可用的大语言模型，是否前往「大模型设置」进行配置？',
        '模型未就绪',
        {
          confirmButtonText: '前往设置',
          cancelButtonText: '取消',
          type: 'warning',
          closeOnClickModal: false
        }
      )
        .then(async () => {
          gtagRenderer('invalid_llm_config_tip_dialog_confirm')
          try {
            await router.push('/main-layout/LlmConfig')
          } catch (err) {
            console.log(err)
          }
        })
        .catch(() => {
          gtagRenderer('invalid_llm_config_tip_dialog_cancel')
        })
    } else {
      gtagRenderer('cannot_launch_for_check_llm_config_error', { err })
      ElMessage({
        type: 'error',
        message: '大模型配置检查未通过，请稍后重试'
      })
    }
    return false
  }
  for (const promptType of [
    ...(needOpenLlm ? (['open'] as const) : []),
    ...(needRechatLlm ? (['rechat'] as const) : [])
  ]) {
    try {
      await electron.ipcRenderer.invoke('check-if-auto-remind-prompt-valid', { type: promptType })
    } catch (err) {
      if ((err instanceof Error ? err.message : undefined)?.includes(`RESUME_PLACEHOLDER_NOT_EXIST`)) {
        gtagRenderer('cannot_launch_for_no_resume_placehold')
        ElMessageBox.confirm(
          `${promptType === 'open' ? '开场白' : '跟进'}提示词模板缺少简历占位符 <b>__REPLACE_REAL_RESUME_HERE__</b>。<br /><br />是否恢复为默认提示词模板？`,
          '提示词模板缺少占位符',
          {
            confirmButtonText: '恢复默认模板',
            cancelButtonText: '取消',
            type: 'warning',
            closeOnClickModal: false,
            dangerouslyUseHTMLString: true
          }
        )
          .then(async () => {
            await restoreDefaultTemplate({
              type: promptType,
              gaEvName: 'confirm_invalid_rt_tip_dialog'
            })
          })
          .catch(() => {
            gtagRenderer('close_invalid_rt_tip_dialog')
          })
      } else {
        gtagRenderer('cannot_launch_for_check_prompt_error', { err })
        ElMessage({
          type: 'error',
          message: '提示词检查未通过，请重试'
        })
      }
      return false
    }
  }

  return true
}

const autosave = useAutoSave(
  () => formContent.value,
  value => electron.ipcRenderer.invoke('save-config-file-from-ui', JSON.stringify(value)),
  () => loaded
)

function handleThrottleIntervalMinutesBlur() {
  if (formContent.value.autoReminder.throttleIntervalMinutes < 3) {
    formContent.value.autoReminder.throttleIntervalMinutes = 3
  }
  formContent.value.autoReminder.throttleIntervalMinutes = Number(
    formContent.value.autoReminder.throttleIntervalMinutes
  )
}

const restoreDefaultTemplate = async ({ type, gaEvName }) => {
  gtagRenderer(gaEvName)
  await electron.ipcRenderer.invoke('overwrite-auto-remind-prompt-with-default', { type })
  ElMessage({
    type: 'success',
    message: '已恢复默认提示词模板'
  })
}

const currentStamp = ref(new Date())
let timer = 0
function updateCurrentStamp() {
  currentStamp.value = new Date()
  timer = window.setTimeout(updateCurrentStamp, 1000)
}
updateCurrentStamp()
onUnmounted(() => {
  window.clearTimeout(timer)
})

const rechatLimitDateString = computed(() => {
  return dayjs(
    +currentStamp.value - formContent.value.autoReminder.rechatLimitDay * 24 * 60 * 60 * 1000
  ).format('YYYY-MM-DD HH:mm')
})

const handleClickEditResume = async () => {
  gtagRenderer('edit_resume_clicked')
  try {
    await electron.ipcRenderer.invoke('resume-edit')
    await fetchResumeContent()
  } catch (err) {
    console.log(err)
  }
}

const handleClickEditPrompt = async ({ type }) => {
  gtagRenderer('edit_prompt_clicked', { type })
  await electron.ipcRenderer.send('no-reply-reminder-prompt-edit', { type })
}

const rechatLlmFallbackOptions = [
  {
    name: '改发「盼回复」表情包',
    value: RECHAT_LLM_FALLBACK.SEND_LOOK_FORWARD_EMOTION
  },
  {
    name: '停止自动跟进任务',
    value: RECHAT_LLM_FALLBACK.EXIT_REMINDER_PROGRAM
  }
]

async function handleTestEffectClicked() {
  gtagRenderer('goto_mock_chat_clicked')
  if (!(await checkIsCanRun())) {
    return
  }
  electron.ipcRenderer.send('test-llm-config-effect', {
    autoReminderConfig: JSON.parse(JSON.stringify(formContent.value.autoReminder))
  })
}

const needToCheckRuntimeDependenciesHandler = () => {
  router.replace('/')
}
electron.ipcRenderer.on('need-to-check-runtime-dependencies', needToCheckRuntimeDependenciesHandler)
onUnmounted(() => {
  electron.ipcRenderer.removeListener(
    'need-to-check-runtime-dependencies',
    needToCheckRuntimeDependenciesHandler
  )
})

const defaultConstantOpenContent = computed(() => {
  if (
    formContent.value.autoReminder.rechatContentSource ===
    RECHAT_CONTENT_SOURCE.GEMINI_WITH_CHAT_CONTEXT
  ) {
    return DEFAULT_CONSTANT_OPEN_CONTENT_SEGS.join('；')
  }
  return DEFAULT_CONSTANT_OPEN_CONTENT_SEGS[0]
})
</script>

<style scoped lang="scss">
.scope-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 28px;
  padding-bottom: 14px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.freq-grid,
.reply-mode-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
}

@media (max-width: 880px) {
  .freq-grid,
  .reply-mode-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.mode-box {
  padding: 14px 16px;
  border-radius: 10px;
  background-color: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
}

.mode-box-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 8px;
}

.mode-radios {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
}

.mt10 {
  margin-top: 10px;
}

.mb0 {
  margin-bottom: 0;
}

.prompt-actions,
.inline-control {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;

  .el-button + .el-button {
    margin-left: 0;
  }
}

.unit-note,
.limit-hint,
.quiet-note {
  font-size: 12.5px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.limit-hint {
  margin-top: 6px;
}

.quiet-note {
  margin: 0;
}

.warn-text {
  color: var(--el-color-warning);
  font-weight: 500;
}

.llm-extra-grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.sub-label {
  font-size: 13px;
  color: var(--el-text-color-regular);
  margin-bottom: 6px;
}
</style>

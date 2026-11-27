<template>
  <div class="ggr-page hr-auto-reply" :class="{ 'is-embedded': embedded }">
    <header v-if="!embedded" class="ggr-page-header">
      <div>
        <h2 class="ggr-page-title">HR 消息自动回复</h2>
        <p class="ggr-page-desc">独立运行，只在 HR 发来消息后响应，不主动打扰已读不回会话</p>
      </div>
    </header>

    <!-- Card 1: 扫描范围与等待策略 -->
    <section class="ggr-card">
      <div class="ggr-card-header">
        <h3 class="ggr-card-title">
          扫描范围与等待策略
          <el-tooltip placement="top">
            <template #content>
              <div class="help-pop">收到消息后延迟回复：同一会话有新消息时重新计时，等待结束后合并处理。<br>每次扫描最近会话数：从列表顶部开始处理，最多 200 条。<br>空闲巡检间隔：没有新通知时定期补查。<br>回复后持续观察时长：回复或发现新消息后按观察期巡检间隔检查；新消息仍需等待回复延迟。设为 0 则不进入观察期。<br>观察期巡检间隔：控制观察期间多久检查一次，实际间隔可能受页面加载和处理时间影响。</div>
            </template>
            <button type="button" class="ggr-help-btn" aria-label="扫描与等待时间说明">
              <QuestionFilled />
            </button>
          </el-tooltip>
        </h3>
      </div>

      <div class="param-tiles">
        <div class="param-tile">
          <label class="param-label">收到消息后延迟回复</label>
          <div class="param-control">
            <el-input-number v-model="config.replyDelaySeconds" :min="0" :max="86400" :precision="0" controls-position="right" />
            <span class="param-unit">秒</span>
          </div>
        </div>

        <div class="param-tile">
          <label class="param-label">每次扫描最近会话数</label>
          <div class="param-control">
            <el-input-number v-model="config.scanLimit" :min="1" :max="200" :precision="0" controls-position="right" />
            <span class="param-unit">条</span>
          </div>
        </div>

        <div class="param-tile">
          <label class="param-label">空闲巡检间隔</label>
          <div class="param-control">
            <el-input-number v-model="config.idleScanMinutes" :min="1" :max="1440" :precision="0" controls-position="right" />
            <span class="param-unit">分钟</span>
          </div>
        </div>

        <div class="param-tile">
          <label class="param-label">回复后持续观察时长</label>
          <div class="param-control">
            <el-input-number v-model="config.observeMinutes" :min="0" :max="1440" :precision="0" controls-position="right" />
            <span class="param-unit">分钟</span>
          </div>
        </div>
        <div class="param-tile">
          <label class="param-label">观察期巡检间隔</label>
          <div class="param-control">
            <el-input-number v-model="config.observeIntervalSeconds" :min="1" :max="3600" :precision="0" controls-position="right" />
            <span class="param-unit">秒</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Card 2: 回复资料与提示词 -->
    <section class="ggr-card">
      <div class="ggr-card-header">
        <h3 class="ggr-card-title">
          回复资料与提示词
          <el-tooltip placement="top" :enterable="false">
            <template #content>
              <div class="help-pop">
                每个 HR 与岗位独立保存会话上下文：首次回复时带入已勾选资料，后续仅补充新增聊天。切换下方资料开关会为该岗位建立新上下文。离职原因与具体面试时间一律转人工确认。
              </div>
            </template>
            <button class="ggr-help-btn" type="button" aria-label="HR自动回复资料说明">
              <QuestionFilled />
            </button>
          </el-tooltip>
        </h3>
        <div class="toolbar-meta">
          <el-tag size="small" :type="modelName ? 'primary' : 'info'" effect="light">
            {{ modelName ? `当前模型：${modelName}` : '尚未启用模型' }}
          </el-tag>
          <el-button size="small" @click="importProfile">导入已有求职资料</el-button>
        </div>
      </div>

      <el-form label-position="top">
        <div class="input-grid">
          <el-form-item>
            <template #label>
              <div class="template-label">
                <span>个人背景补充资料</span>
                <TemplatePicker kind="hr-profile" :defaults="[{ name: '通用个人资料模板', data: hrPersonalProfileTemplate }]" :value="config.personalProfile" @apply="value => config.personalProfile = value" />

              </div>
            </template>
            <el-input
              v-model="config.personalProfile"
              type="textarea"
              :autosize="{ minRows: 7, maxRows: 13 }"
              maxlength="30000"
              placeholder="填写真实的教育背景、核心技能、项目经历、最快到岗时间和可实习时长等事实信息"
            />
          </el-form-item>

          <el-form-item>
            <template #label>
              <div class="template-label">
                <span>回复语气与规则要求</span>
                <TemplatePicker kind="hr-prompt" :defaults="[{ name: '求职沟通标准模板', data: hrSystemPromptTemplate }]" :value="config.systemPrompt" @apply="value => config.systemPrompt = value" />

              </div>
            </template>
            <el-input
              v-model="config.systemPrompt"
              type="textarea"
              :autosize="{ minRows: 7, maxRows: 13 }"
              maxlength="6000"
              placeholder="填写回复语气、回答侧重点与转人工条件"
            />
          </el-form-item>
        </div>

        <div class="source-settings">
          <div class="source-header">提供给模型的上下文资料</div>
          <div class="source-groups">
            <div v-for="group in hrInputGroups" :key="group.title" class="source-group">
              <div class="source-group-title">{{ group.title }}</div>
              <div class="source-switches">
                <label v-for="item in group.items" :key="item.key" class="switch-item">
                  <span>{{ item.label }}</span>
                  <el-switch v-model="config.inputSources[item.key]" size="small" />
                </label>
              </div>
            </div>
          </div>
        </div>
      </el-form>
    </section>

    <!-- Card 3: 允许自动执行的沟通动作 -->
    <section class="ggr-card">
      <div class="ggr-card-header">
        <h3 class="ggr-card-title">
          允许自动执行的沟通动作
          <el-tooltip placement="top" :enterable="false">
            <template #content>
              <div class="help-pop">
                三项动作可独立开关，仅在识别到 HR 明确索要或发来对应邀请卡片时触发。简历默认匹配「AI 模型筛选」中 PDF 的同名 BOSS 附件（重名、缺失或变更时转人工）；微信与电话使用你在 BOSS 平台已配置的联系方式，绝不编造号码或修改隐私开关。
              </div>
            </template>
            <button class="ggr-help-btn" type="button" aria-label="沟通动作说明">
              <QuestionFilled />
            </button>
          </el-tooltip>
        </h3>
        <span class="ggr-card-subtitle">仅响应 HR 明确请求，结果不确定时不重复发送</span>
      </div>

      <div class="tool-grid">
        <div
          v-for="tool in hrToolOptions"
          :key="tool.action"
          class="tool-card"
          :class="{ active: config[tool.configKey] }"
          @click="config[tool.configKey] = !config[tool.configKey]"
        >
          <div class="tool-card-top">
            <strong>{{ tool.label }}</strong>
            <el-switch v-model="config[tool.configKey]" size="small" @click.stop />
          </div>
          <div class="tool-card-desc">{{ toolDescriptions[tool.action] }}</div>
        </div>
      </div>

      <div class="resume-bar">
        <div class="resume-bar-left">
          <el-tag :type="config.resumeBinding ? 'success' : 'info'" effect="light">
            {{ config.resumeBinding ? '已绑定附件：' + config.resumeBinding.bossResumeName : '发简历时自动匹配同名 BOSS 附件' }}
          </el-tag>
          <el-button v-if="config.resumeFileId" link type="primary" @click="previewResume">
            {{ config.resumeFileName }} · 预览本地 PDF
          </el-button>
        </div>
        <div class="resume-bar-right">
          <el-button v-if="config.resumeBinding" link type="danger" @click="unbindResume">解除简历绑定</el-button>
          <el-button size="small" @click="router.push('./AiJobMatch')">查看筛选简历</el-button>
        </div>
      </div>

      <el-collapse class="manual-collapse">
        <el-collapse-item title="手动指定 BOSS 附件简历（存在多个同名附件时使用）" name="manual-resume">
          <div class="actions binding-controls">
            <el-button size="small" :loading="readingResumes" :disabled="!config.resumeFileId" @click="readBossResumes">
              读取 BOSS 已有附件
            </el-button>
            <el-button size="small" @click="openBossResumes">打开 BOSS 简历管理页</el-button>
            <el-select v-if="bossResumes.length" v-model="selectedResume" placeholder="选择对应的 BOSS 附件简历" class="resume-select">
              <el-option
                v-for="resume in bossResumes"
                :key="resume.resumeId"
                :label="resume.showName + ' · ' + resume.uploadTime"
                :value="resume.resumeId"
                :disabled="resume.annexType === 1 || resume.restricted"
              />
            </el-select>
          </div>
          <div v-if="selectedResume" class="actions binding-controls">
            <el-checkbox v-model="sameResumeConfirmed">已确认本地 PDF 与所选 BOSS 附件为同一份简历</el-checkbox>
            <el-button size="small" type="primary" :loading="binding" :disabled="!sameResumeConfirmed" @click="bindResume">
              确认绑定
            </el-button>
          </div>
        </el-collapse-item>
      </el-collapse>
    </section>

    <!-- Bottom Action & Status Bar -->
    <div class="ggr-footer-bar">
      <div class="footer-switch-group">
        <el-switch v-model="config.enabled" active-text="开启 HR 消息自动回复" @change="handleEnableChange" />
        <el-tag
          size="small"
          :type="running ? 'success' : !config.enabled ? 'info' : workerFailedReason ? 'danger' : 'warning'"
          effect="light"
        >
          {{ running ? '运行中' : !config.enabled ? '已关闭' : workerFailedReason ? `已异常停止：${workerFailedReason}` : '正在启动' }}
        </el-tag>
        <el-button link type="primary" size="small" @click="router.push('./HrReplyRecords')">查看回复记录</el-button>
      </div>
      <span class="ggr-status-text" role="status">{{ autosave.status.value }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onMounted, onUnmounted, reactive, ref, watch, nextTick } from 'vue'
import { useAutoSave } from '@renderer/composables/useAutoSave'
import TemplatePicker from '@renderer/features/PersonalTemplates/TemplatePicker.vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { QuestionFilled } from '@element-plus/icons-vue'
import { useTaskManagerStore } from '@renderer/store'
import { defaultHrSystemPrompt, hrInputSources, hrInputGroups, hrToolOptions, findCurrentRunHrFailure } from '@geekgeekrun/utils/hr-auto-reply.mjs'
import { hrPersonalProfileTemplate, hrSystemPromptTemplate } from '@renderer/features/AiJobMatch/hr-reply-template'

defineProps<{ embedded?: boolean }>()
const router = useRouter()
const tasks = useTaskManagerStore()
const toolDescriptions: Record<string, string> = {
  resume: 'HR 索要简历或发来请求卡时，自动发送已核对的 BOSS 附件简历',
  wechat: 'HR 请求加微信或发来交换卡时，使用 BOSS 已配置的微信号发起／同意',
  phone: 'HR 请求留电话或发来交换卡时，按 BOSS 现有隐私设置发起／同意'
}

const config = reactive({
  enabled: false,
  enabledAt: 0,
  personalProfile: '',
  replyDelaySeconds: 60,
  scanLimit: 100,
  idleScanMinutes: 5,
  observeMinutes: 5,
  observeIntervalSeconds: 5,
  inputSources: { ...hrInputSources } as Record<string, boolean>,
  autoSendResume: true,
  autoExchangeWechat: false,
  autoExchangePhone: false,
  systemPrompt: defaultHrSystemPrompt,
  resumeFileId: '',
  resumeFileName: '',
  resumeText: '',
  resumeSha256: '',
  resumeBinding: null as any
})
const modelName = ref('')
const readingResumes = ref(false)
const binding = ref(false)
const bossResumes = ref<any[]>([])
const selectedResume = ref('')
const sameResumeConfirmed = ref(false)
watch(selectedResume, () => { sameResumeConfirmed.value = false })
const running = computed(() => tasks.runningTasks.some(task => task.workerId === 'hrAutoReplyMain'))
const workerFailedReason = ref('')
watch(running, (isRun) => {
  if (isRun) workerFailedReason.value = ''
})
function handleEnableChange(val: boolean | string | number) {
  if (val) {
    config.enabledAt = Date.now()
    workerFailedReason.value = ''
  } else {
    config.enabledAt = 0
    workerFailedReason.value = ''
  }
}
const unListenWorkerExited = electron.ipcRenderer.on('worker-exited', async (_ev, payload) => {
  if (payload?.workerId === 'hrAutoReplyMain' && payload?.code !== 0) {
    const exitThreshold = config.enabledAt || (Date.now() - 5000)
    try {
      const records = await electron.ipcRenderer.invoke('get-hr-reply-records')
      const currentFail = findCurrentRunHrFailure(records, exitThreshold)
      workerFailedReason.value = currentFail?.reason || '本次运行异常中止，请查看回复记录'
    } catch {
      workerFailedReason.value = '本次运行异常中止，请查看回复记录'
    }
  }
})
onUnmounted(() => {
  unListenWorkerExited?.()
})
const errorMessage = (error: any) => ElMessage.error(error.message || String(error))
let textsLoaded = false

const autosave = useAutoSave(
  () => ({
    enabled: config.enabled,
    personalProfile: config.personalProfile,
    systemPrompt: config.systemPrompt,
    replyDelaySeconds: config.replyDelaySeconds,
    scanLimit: config.scanLimit,
    idleScanMinutes: config.idleScanMinutes,
    observeMinutes: config.observeMinutes,
    observeIntervalSeconds: config.observeIntervalSeconds,
    inputSources: config.inputSources,
    autoSendResume: config.autoSendResume,
    autoExchangeWechat: config.autoExchangeWechat,
    autoExchangePhone: config.autoExchangePhone
  }),
  value => electron.ipcRenderer.invoke('save-hr-auto-reply', value),
  () => textsLoaded
)

async function saveConfig() {
  await autosave.flush()
  if (autosave.lastError.value) throw new Error(autosave.lastError.value)
}
async function importProfile() {
  if (config.personalProfile.trim()) {
    try {
      await ElMessageBox.confirm('确定用「AI 模型筛选」中的简历与求职偏好替换当前补充资料吗？', '导入求职资料')
    } catch {
      return
    }
  }
  try {
    config.personalProfile = await electron.ipcRenderer.invoke('import-hr-personal-profile')
  } catch (error) {
    errorMessage(error)
  }
}
async function previewResume() {
  try {
    await electron.ipcRenderer.invoke('preview-job-ai-resume', config.resumeFileId)
  } catch (error) {
    errorMessage(error)
  }
}
async function readBossResumes() {
  readingResumes.value = true
  try {
    bossResumes.value = await electron.ipcRenderer.invoke('list-hr-boss-resumes')
    selectedResume.value = ''
    sameResumeConfirmed.value = false
    if (!bossResumes.value.length) ElMessage.info('BOSS 账号中暂无附件简历')
  } catch (error) {
    errorMessage(error)
  } finally {
    readingResumes.value = false
  }
}
async function openBossResumes() {
  try {
    await electron.ipcRenderer.invoke('open-site-with-boss-cookie', { url: 'https://www.zhipin.com/web/geek/resume' })
  } catch (error) {
    errorMessage(error)
  }
}
async function bindResume() {
  binding.value = true
  try {
    const resumeFileId = config.resumeFileId
    const resumeSha256 = config.resumeSha256
    await saveConfig()
    if (config.resumeFileId !== resumeFileId || config.resumeSha256 !== resumeSha256) {
      sameResumeConfirmed.value = false
      throw new Error('筛选简历已发生变化，请重新核对 BOSS 附件')
    }
    config.resumeBinding = await electron.ipcRenderer.invoke('bind-hr-boss-resume', {
      resumeId: selectedResume.value,
      confirmed: sameResumeConfirmed.value,
      resumeFileId,
      resumeSha256
    })
    ElMessage.success('附件简历已绑定')
  } catch (error) {
    errorMessage(error)
  } finally {
    binding.value = false
  }
}
async function unbindResume() {
  try {
    await electron.ipcRenderer.invoke('unbind-hr-resume')
    config.resumeBinding = null
    sameResumeConfirmed.value = false
  } catch (error) {
    errorMessage(error)
  }
}
async function refreshHrPage() {
  try {
    if (textsLoaded) await autosave.flush()
    textsLoaded = false
    const data = await electron.ipcRenderer.invoke('get-hr-auto-reply')
    Object.assign(config, data.config)
    if (config.enabled && !running.value) {
      const currentFail = findCurrentRunHrFailure(data.records, config.enabledAt)
      workerFailedReason.value = currentFail?.reason || ''
    } else if (!config.enabled || running.value) {
      workerFailedReason.value = ''
    }
    await nextTick()
    textsLoaded = true
    modelName.value = (await electron.ipcRenderer.invoke('get-job-ai-model')).model || ''
  } catch (error) {
    textsLoaded = true
    errorMessage(error)
  }
}
onMounted(refreshHrPage)
onActivated(refreshHrPage)
</script>

<style scoped lang="scss">
.param-tiles {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

@media (max-width: 760px) {
  .param-tiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.param-tile {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  padding: 10px;
  border-radius: 10px;
  background-color: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
}

.param-label {
  font-size: 12.5px;
  font-weight: 600;
  min-height: 18px;
  line-height: 1.4;
  color: var(--el-text-color-regular);
}

.param-control {
  display: flex;
  align-items: center;
  gap: 4px;

  :deep(.el-input-number) {
    flex: 1;
    min-width: 0;
    width: 100%;
  }
}

.param-unit {
  font-size: 12.5px;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

.param-hint {
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}

.toolbar-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;

  .el-button + .el-button {
    margin-left: 0;
  }
}

.input-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 18px;
}

@media (max-width: 960px) {
  .input-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 4px;
  }
}

.input-grid :deep(.el-form-item__label) {
  width: 100%;
  padding-right: 0;
}

.template-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
  width: 100%;
}

.source-settings {
  margin-top: 6px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  overflow: hidden;
  background-color: var(--el-fill-color-lighter);
}

.source-header {
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  border-bottom: 1px solid var(--el-border-color-lighter);
  background-color: var(--el-fill-color-light);
}

.source-group {
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);

  &:last-child {
    border-bottom: 0;
  }
}

.source-group-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}

.source-switches {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 24px;
}

.switch-item {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 175px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  cursor: pointer;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

@media (max-width: 860px) {
  .tool-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.tool-card {
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--el-border-color-light);
  background-color: var(--el-fill-color-lighter);
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;

  &.active {
    border-color: var(--el-color-primary-light-5);
    background-color: var(--el-color-primary-light-9);
  }
}

.tool-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 13.5px;
}

.tool-card-desc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.resume-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 10px 14px;
  border-radius: 8px;
  background-color: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
}

.resume-bar-left,
.resume-bar-right,
.actions,
.footer-switch-group {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.manual-collapse {
  margin-top: 10px;
  border: 0;

  :deep(.el-collapse-item__header) {
    height: 38px;
    font-size: 13px;
    color: var(--el-text-color-secondary);
    background: transparent;
    border: 0;
  }

  :deep(.el-collapse-item__wrap) {
    background: transparent;
    border: 0;
  }
}

.binding-controls {
  margin-top: 10px;
}

.resume-select {
  min-width: 300px;
  max-width: 100%;
}

.help-pop {
  max-width: 360px;
  line-height: 1.65;
}
</style>

<template>
  <div class="llm-config-page" :class="{ embedded }">
    <div class="ggr-page">
      <header class="ggr-page-header">
        <div>
          <h2 class="ggr-page-title">
            大模型设置
            <el-tooltip placement="bottom-start" :enterable="false">
              <template #content>
                <div style="max-width: 360px; line-height: 1.75">
                  <p style="margin: 0 0 6px; font-weight: 600">如何选择模型与推理强度？</p>
                  <p style="margin: 0 0 6px">程序先执行规则过滤，再由大模型评估岗位职责与简历契合度。建议先从响应快的模型与较低推理强度（如 low / medium）起步。</p>
                  <p style="margin: 0">可用同一批岗位在「AI 模型筛选 → 岗位测试」中对比输出稳定性与判断准确度；「测试连接」仅验证接口连通性。</p>
                </div>
              </template>
              <button type="button" class="ggr-help-btn" aria-label="模型选择与测试说明">
                <QuestionFilled />
              </button>
            </el-tooltip>
          </h2>
          <p class="ggr-page-desc">配置用于简历整理、岗位匹配评分与自动回复的大语言模型服务</p>
        </div>
        <span class="ggr-status-text" role="status">{{ autosave.status.value }}</span>
      </header>

      <section class="ggr-card">
        <el-form label-position="top">
          <el-form-item label="模型接入方式" class="mb0">
            <div class="provider-select-row">
              <el-select
                :model-value="activeProvider"
                style="max-width: 430px; width: 100%"
                @update:model-value="switchProvider"
              >
                <el-option
                  label="本机 Pi CLI（支持 Codex、Antigravity 等多模型 · 推荐）"
                  value="pi-cli"
                >
                  <div class="provider-option-item">
                    <span>本机 Pi CLI（支持 Codex、Antigravity 等多模型）</span>
                    <el-tag size="small" type="success" effect="light">推荐</el-tag>
                  </div>
                </el-option>
                <el-option
                  label="在线 API 接入（兼容 OpenAI 接口 · 推荐）"
                  value="openai"
                >
                  <div class="provider-option-item">
                    <span>在线 API 接入（兼容 OpenAI 接口）</span>
                    <el-tag size="small" type="success" effect="light">推荐</el-tag>
                  </div>
                </el-option>
                <el-option label="本机 Codex CLI" value="codex-cli" />
              </el-select>
              <el-tag
                v-if="activeProvider === 'pi-cli' || activeProvider === 'openai'"
                size="small"
                type="success"
                effect="light"
              >
                推荐
              </el-tag>
            </div>
          </el-form-item>
        </el-form>
      </section>

      <el-form
        ref="formRef"
        :model="formContentForElForm"
        :rules="formRulesForElForm"
        label-position="top"
        class="llm-config-form"
        :validate-on-rule-change="false"
      >
        <section v-for="{ conf, index } in visibleConfigEntries" :key="conf.id" class="ggr-card model-card">
          <div v-if="visibleConfigEntries.length > 1" class="model-card-heading">
            <strong>模型配置 {{ visibleConfigEntries.findIndex((item) => item.index === index) + 1 }}</strong>
            <div class="model-order">
              <el-button
                circle
                size="small"
                :icon="ArrowUp"
                aria-label="模型上移"
                :disabled="index <= visibleConfigEntries[0].index"
                @click="moveConfigUp(index)"
              />
              <el-button
                circle
                size="small"
                :icon="ArrowDown"
                aria-label="模型下移"
                :disabled="index >= visibleConfigEntries[visibleConfigEntries.length - 1].index"
                @click="moveConfigDown(index)"
              />
              <el-button
                circle
                size="small"
                :icon="Delete"
                aria-label="删除备用模型"
                @click="removeConfig(index)"
              />
            </div>
          </div>

          <div v-if="isLocalCli(conf.provider)" class="account-panel">
            <div class="cli-top-row">
              <el-form-item :label="`${cliName(conf)} 程序识别方式`" class="mb0">
                <el-radio-group v-model="conf[detectionKey(conf)]" @change="refreshCodex(conf)">
                  <el-radio value="auto">自动识别</el-radio>
                  <el-radio value="manual">手动指定路径</el-radio>
                </el-radio-group>
              </el-form-item>

              <div class="account-actions">
                <el-button size="small" @click="refreshCodex(conf)">刷新账号与模型</el-button>
                <el-button size="small" type="primary" plain :loading="testingCodex" @click="testCodex(conf)">
                  测试连接
                </el-button>
              </div>
            </div>

            <el-form-item
              v-if="conf[detectionKey(conf)] === 'manual'"
              :label="`${cliName(conf)} 可执行文件路径`"
              class="mt12 mb0"
            >
              <el-input
                v-model="conf[binaryKey(conf)]"
                class="ggr-mono"
                :placeholder="conf.provider === 'pi-cli' ? '选择 pi、pi.exe 或 dist/cli.js' : '选择 codex 或 codex.exe'"
              >
                <template #append>
                  <el-button @click="chooseCodex(conf)">选择文件</el-button>
                </template>
              </el-input>
              <p class="helper">本机自动识别路径：{{ codexAccount.binary || '尚未识别，请点击上方刷新' }}</p>
            </el-form-item>

            <div class="account-summary mt12">
              <el-tag size="small" :type="codexAccount.loggedIn ? 'success' : 'info'" effect="light">
                {{ codexAccount.loggedIn ? (conf.provider === 'pi-cli' ? '凭证已就绪' : '账号已登录') : '未登录／未配置' }}
              </el-tag>
              <span>{{ codexAccount.email || `使用本机 ${cliName(conf)} 配置` }}</span>
            </div>

            <p v-if="codexTestResult" class="connection-result" role="status">{{ codexTestResult }}</p>

            <el-collapse class="quiet-collapse">
              <el-collapse-item title="查看 CLI 路径与登录说明" name="cli">
                <p class="path-text ggr-mono">{{ codexAccount.binary || '未检测到可执行文件' }}</p>
                <p class="helper">{{ codexAccount.loginMethod }}</p>
              </el-collapse-item>
            </el-collapse>
          </div>

          <template v-else>
            <div class="api-header-row">
              <span class="sub-heading">API 服务端点</span>
              <div class="api-tools">
                <el-dropdown @command="(item) => handlePresetClick(item, index)">
                  <el-button size="small" text bg>
                    快速填入服务商模板 <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item v-for="item in llmPresetList" :key="item.name" :command="item">
                        {{ item.name }}
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
                <el-dropdown @command="(item) => openExternalLink(item.url)">
                  <el-button size="small" text bg>
                    前往获取 API Key <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item v-for="item in providerList" :key="item.name" :command="item">
                        {{ item.name }}
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
                <el-button
                  size="small"
                  type="primary"
                  plain
                  :loading="Boolean(testingOpenAiMap[conf.id])"
                  @click="testOpenAi(conf)"
                >
                  测试连接
                </el-button>
              </div>
            </div>

            <el-form-item :prop="`${index}_providerCompleteApiUrl`" label="服务地址（Base URL）">
              <el-input
                ref="firstInputRefList"
                v-model="conf.providerCompleteApiUrl"
                class="ggr-mono"
                placeholder="https://api.openai.com/v1"
                @input="handleEndpointUrlChange(conf)"
              />
            </el-form-item>
          </template>

          <el-form-item label="模型名称">
            <el-select
              v-if="isLocalCli(conf.provider)"
              v-model="conf.model"
              placeholder="自动选择默认模型"
              filterable
              @change="handleModelChange(conf)"
            >
              <el-option :label="`自动选择（${cliName(conf)} 默认模型）`" value="" />
              <el-option v-for="item in codexModels" :key="item.id" :label="item.displayName || item.id" :value="item.id" />
            </el-select>
            <el-input
              v-else
              v-model="conf.model"
              class="ggr-mono"
              placeholder="例如 gpt-6-luna、deepseek-chat"
              @input="snapshotCurrentEndpoints"
            />
          </el-form-item>

          <template v-if="isLocalCli(conf.provider)">
            <div class="parameter-grid">
              <el-form-item>
                <template #label>
                  推理强度
                  <el-tooltip
                    content="推理强度越高耗时越长；日常岗位匹配建议优先选用 low 或 medium 档位，以实际测试速度和效果为准。"
                    placement="top"
                  >
                    <button type="button" class="ggr-help-btn" aria-label="推理强度说明">
                      <QuestionFilled />
                    </button>
                  </el-tooltip>
                </template>
                <el-select v-model="conf.reasoningEffort" placeholder="跟随模型默认">
                  <el-option label="跟随模型默认" value="" />
                  <el-option
                    v-for="item in reasoningOptions(conf.model)"
                    :key="item.reasoningEffort"
                    :label="item.reasoningEffort"
                    :value="item.reasoningEffort"
                  />
                </el-select>
              </el-form-item>

              <el-form-item label="上下文窗口长度（Tokens）">
                <el-input-number
                  v-if="contextLimits(conf.model)"
                  :disabled="conf.provider === 'pi-cli'"
                  :model-value="conf.contextWindowTokens || contextLimits(conf.model).defaultTokens"
                  :min="contextLimits(conf.model).minTokens"
                  :max="contextLimits(conf.model).maxTokens"
                  :step="1000"
                  :precision="0"
                  controls-position="right"
                  @update:model-value="(value) => { conf.contextWindowTokens = value || 0 }"
                />
                <span v-else class="helper">跟随模型默认上限</span>
              </el-form-item>
            </div>

            <div v-if="contextLimits(conf.model)" class="context-info">
              <span>
                默认 {{ contextLimits(conf.model).defaultTokens.toLocaleString() }} · 支持范围 {{ contextLimits(conf.model).minTokens.toLocaleString() }}–{{ contextLimits(conf.model).maxTokens.toLocaleString() }}
              </span>
              <el-button v-if="conf.provider !== 'pi-cli'" link type="primary" @click="conf.contextWindowTokens = 0">
                恢复默认
              </el-button>
            </div>

            <p v-if="modelListError" class="error-text">{{ modelListError }}</p>
          </template>

          <template v-else>
            <el-form-item label="API Key（密钥）">
              <el-input
                v-model="conf.providerApiSecret"
                type="password"
                show-password
                autocomplete="off"
                placeholder="填入对应服务商的 API Key（切换其他接入方式或模板时会自动保存）"
                @input="snapshotCurrentEndpoints"
              />
            </el-form-item>
            <p
              v-if="apiTestResultMap[conf.id]"
              class="connection-result mb12"
              :class="{ 'is-error': apiTestErrorMap[conf.id] }"
              role="status"
            >
              {{ apiTestResultMap[conf.id] }}
            </p>
          </template>

          <div class="enable-row">
            <el-checkbox
              v-if="visibleConfigEntries.length > 1"
              :model-value="conf.providerEnabled !== false"
              @update:model-value="(val) => { conf.providerEnabled = Boolean(val); conf.enabled = Boolean(val) }"
            >
              启用此模型
            </el-checkbox>
            <el-checkbox v-else :model-value="true" disabled>当前默认启用</el-checkbox>

            <label class="weight-control">
              <span>调用权重</span>
              <el-input-number
                v-if="visibleConfigEntries.length > 1"
                v-model="conf.serveWeight"
                :min="1"
                :max="100"
                :precision="0"
                size="small"
                controls-position="right"
              />
              <el-input-number v-else :model-value="SINGLE_ITEM_DEFAULT_SERVE_WEIGHT" disabled size="small" controls-position="right" />
            </label>
          </div>

          <el-collapse v-if="conf.provider === 'openai'" class="quiet-collapse mt8">
            <el-collapse-item title="接口协议与隐私说明" name="api">
              <p class="helper">接口需兼容 OpenAI Chat Completions 规范。启用后，已勾选的简历与岗位文本将发送至该服务商接口进行推理，请确认服务商可信。</p>
            </el-collapse-item>
          </el-collapse>
        </section>
      </el-form>

      <div class="ggr-footer-bar">
        <el-button type="primary" plain size="small" @click="addConfig">+ 添加备用模型</el-button>
        <span class="ggr-status-text" role="status">{{ autosave.status.value }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
const { embedded = false } = defineProps<{ embedded?: boolean }>()
import {
  ElForm,
  ElDropdown,
  ElDropdownMenu,
  ElDropdownItem,
  ElIcon,
  ElButton,
  ElInput
} from 'element-plus'
import { ArrowUp, ArrowDown, Delete, QuestionFilled } from '@element-plus/icons-vue'
import { ref, onMounted, onActivated, nextTick, computed } from 'vue'
import { useAutoSave } from '@renderer/composables/useAutoSave'
import {
  normalizeEndpointUrl,
  recordEndpointEntry,
  applyEndpointUrlEdit,
  applyPresetWithEndpointCache
} from '@geekgeekrun/utils/llm-endpoint-cache.mjs'
import { gtagRenderer as baseGtagRenderer } from '@renderer/utils/gtag'
import { SINGLE_ITEM_DEFAULT_SERVE_WEIGHT } from '../../../../common/constant'
import { v4 as uuid } from 'uuid'

interface LlmConfigItem {
  id: string
  provider?: string
  codexDetectionMode?: string
  codexBinaryPath?: string
  piDetectionMode?: string
  piBinaryPath?: string
  providerCompleteApiUrl: string
  providerApiSecret: string
  model: string
  reasoningEffort?: string
  contextWindowTokens?: number
  serveWeight: number
  enabled: boolean
  providerEnabled?: boolean
}

const gtagRenderer = (name, params?: object) => {
  return baseGtagRenderer(name, {
    scene: 'llm-config',
    ...params
  })
}

function getNewConfigItem(): LlmConfigItem {
  return {
    id: uuid(),
    codexDetectionMode: 'auto',
    codexBinaryPath: '',
    piDetectionMode: 'auto',
    piBinaryPath: '',
    provider: 'openai',
    providerCompleteApiUrl: '',
    providerApiSecret: '',
    model: '',
    reasoningEffort: '',
    contextWindowTokens: 0,
    serveWeight: 10,
    enabled: true,
    providerEnabled: true
  }
}

const codexAccount = ref({ loggedIn: false, email: '', binary: '', loginMethod: '' })
const testingCodex = ref(false)
const codexTestResult = ref('')
const testingOpenAiMap = ref<Record<string, boolean>>({})
const apiTestResultMap = ref<Record<string, string>>({})
const apiTestErrorMap = ref<Record<string, boolean>>({})
const endpointCache = ref<Record<string, { providerCompleteApiUrl: string; model: string; providerApiSecret: string }>>({})
const boundEndpointUrlMap = ref<Record<string, string>>({})
const codexModels = ref<any[]>([])
const modelListError = ref('')
let cliRefreshId = 0

function snapshotCurrentEndpoints() {
  for (const conf of formContent.value) {
    if ((conf.provider || 'openai') !== 'openai') continue
    recordEndpointEntry(endpointCache.value, conf, boundEndpointUrlMap.value[conf.id])
  }
}

function handleEndpointUrlChange(conf: LlmConfigItem) {
  boundEndpointUrlMap.value[conf.id] = applyEndpointUrlEdit(
    conf,
    endpointCache.value,
    boundEndpointUrlMap.value[conf.id] || ''
  )
  apiTestResultMap.value[conf.id] = ''
  apiTestErrorMap.value[conf.id] = false
}

async function testOpenAi(conf: LlmConfigItem) {
  testingOpenAiMap.value[conf.id] = true
  apiTestResultMap.value[conf.id] = ''
  apiTestErrorMap.value[conf.id] = false
  try {
    snapshotCurrentEndpoints()
    await autosave.flush()
    const res = await electron.ipcRenderer.invoke(
      'test-openai-connection',
      JSON.parse(JSON.stringify(conf))
    )
    apiTestResultMap.value[conf.id] = res
  } catch (error: any) {
    apiTestErrorMap.value[conf.id] = true
    apiTestResultMap.value[conf.id] = `连接失败：${error?.message || String(error)}`
  } finally {
    testingOpenAiMap.value[conf.id] = false
  }
}

function isLocalCli(provider?: string) {
  return provider === 'codex-cli' || provider === 'pi-cli'
}
function cliName(conf: LlmConfigItem) {
  return conf.provider === 'pi-cli' ? 'Pi' : 'Codex'
}
function detectionKey(conf: LlmConfigItem): 'piDetectionMode' | 'codexDetectionMode' {
  return conf.provider === 'pi-cli' ? 'piDetectionMode' : 'codexDetectionMode'
}
function binaryKey(conf: LlmConfigItem): 'piBinaryPath' | 'codexBinaryPath' {
  return conf.provider === 'pi-cli' ? 'piBinaryPath' : 'codexBinaryPath'
}
function contextLimits(model: string) {
  return codexModels.value.find((it) => (model ? it.id === model : it.isDefault))?.contextLimits
}
function reasoningOptions(model: string) {
  return (
    codexModels.value.find((it) => (model ? it.id === model : it.isDefault))
      ?.supportedReasoningEfforts || []
  ).filter((item) => ['off', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].includes(item.reasoningEffort))
}
function handleModelChange(config: LlmConfigItem) {
  config.reasoningEffort = ''
  config.contextWindowTokens = 0
}

async function refreshCodex(settings?: any) {
  const config =
    settings?.provider
      ? settings
      : formContent.value.find((it) => it.provider === activeProvider.value) || {}
  if (!isLocalCli(config.provider)) return
  const refreshId = ++cliRefreshId
  const current = () => refreshId === cliRefreshId && activeProvider.value === config.provider
  const prefix = config.provider === 'pi-cli' ? 'pi' : 'codex'
  if (config[detectionKey(config)] === 'manual' && !config[binaryKey(config)])
    config[binaryKey(config)] = codexAccount.value.binary || ''
  codexTestResult.value = ''
  codexModels.value = []
  modelListError.value = ''
  try {
    const status = await electron.ipcRenderer.invoke(
      `${prefix}-status`,
      JSON.parse(JSON.stringify(config))
    )
    if (!current()) return
    codexAccount.value = status
  } catch (error) {
    if (!current()) return
    codexAccount.value = {
      loggedIn: false,
      email: '',
      binary: config[binaryKey(config)] || '',
      loginMethod: '识别失败'
    }
    modelListError.value = String(error)
    return
  }
  try {
    const models = await electron.ipcRenderer.invoke(
      `${prefix}-models`,
      JSON.parse(JSON.stringify(config))
    )
    if (current()) codexModels.value = models
  } catch (error) {
    if (current()) modelListError.value = String(error)
  }
}

async function chooseCodex(config: LlmConfigItem) {
  const result = await electron.ipcRenderer.invoke('choose-file', {
    fileChooserConfig: { title: `选择 ${cliName(config)} CLI 文件`, properties: ['openFile'] }
  })
  if (result?.filePaths?.[0]) {
    config[binaryKey(config)] = result.filePaths[0]
    await refreshCodex(config)
  }
}

async function testCodex(config: LlmConfigItem) {
  testingCodex.value = true
  try {
    const prefix = config.provider === 'pi-cli' ? 'pi' : 'codex'
    codexTestResult.value = await electron.ipcRenderer.invoke(
      `test-${prefix}-connection`,
      JSON.parse(JSON.stringify(config))
    )
  } catch (error) {
    codexTestResult.value = String(error)
  } finally {
    testingCodex.value = false
  }
}

const formRef = ref<InstanceType<typeof ElForm>>()
const formContent = ref<LlmConfigItem[]>([getNewConfigItem()])
const activeProvider = ref('openai')
const visibleConfigEntries = computed(() =>
  formContent.value
    .map((conf, index) => ({ conf, index }))
    .filter(({ conf }) => (conf.provider || 'openai') === activeProvider.value)
)

async function switchProvider(nextProvider: string) {
  if (!nextProvider || nextProvider === activeProvider.value) return
  snapshotCurrentEndpoints()
  await autosave.flush()
  activeProvider.value = nextProvider
  await ensureProviderConfig()
  await nextTick()
  await autosave.flush()
}

async function ensureProviderConfig() {
  ++cliRefreshId
  codexAccount.value = { loggedIn: false, email: '', binary: '', loginMethod: '' }
  codexModels.value = []
  codexTestResult.value = ''
  modelListError.value = ''
  if (!visibleConfigEntries.value.length) {
    const newItem = {
      ...getNewConfigItem(),
      provider: activeProvider.value,
      providerCompleteApiUrl: isLocalCli(activeProvider.value)
        ? activeProvider.value === 'pi-cli'
          ? 'pi://local'
          : 'codex://local'
        : ''
    }
    boundEndpointUrlMap.value[newItem.id] = normalizeEndpointUrl(newItem.providerCompleteApiUrl)
    formContent.value.push(newItem)
  } else if (visibleConfigEntries.value.every(({ conf }) => conf.providerEnabled === false)) {
    visibleConfigEntries.value[0].conf.providerEnabled = true
    visibleConfigEntries.value[0].conf.enabled = true
  }
  await refreshCodex()
}

const formContentForElForm = computed(() => {
  const valueMap = {}
  formContent.value.forEach((configItem, i) => {
    valueMap[`${i}_providerCompleteApiUrl`] = configItem.providerCompleteApiUrl
  })
  return valueMap
})

const formRulesForElForm = computed(() => {
  const valueMap = {}
  formContent.value.forEach((conf, i) => {
    if ((conf.provider || 'openai') !== activeProvider.value || isLocalCli(conf.provider)) return
    valueMap[`${i}_providerCompleteApiUrl`] = [
      {
        required: true,
        message: '请输入服务地址（Base URL）'
      },
      {
        trigger: 'blur',
        validator(_, value, cb) {
          try {
            new URL(value?.trim())
          } catch {
            cb(`服务地址格式无效，请检查后重新输入`)
            return
          }
          if (/^http(s)?:\/\//.test(value)) {
            cb()
            return
          }
          cb(`服务地址需以 http:// 或 https:// 开头`)
        }
      }
    ]
  })
  return valueMap
})

let loaded = false
const autosave = useAutoSave(
  () => {
    const selected = visibleConfigEntries.value
    return formContent.value.map((conf) => ({
      ...conf,
      providerEnabled: conf.providerEnabled ?? true,
      enabled:
        (conf.provider || 'openai') === activeProvider.value &&
        (selected.length === 1 || conf.providerEnabled !== false)
    }))
  },
  async (value) => {
    snapshotCurrentEndpoints()
    return electron.ipcRenderer.invoke('save-llm-config', value, { embedded: true })
  },
  () => loaded
)

async function loadSettings() {
  if (loaded) await autosave.flush()
  loaded = false
  try {
    endpointCache.value = (await electron.ipcRenderer.invoke('get-llm-endpoint-cache')) || {}
  } catch {
    endpointCache.value = {}
  }
  const savedFileContent = (await electron.ipcRenderer.invoke('fetch-config-file-content'))
    ?.config?.['llm.json']
  if (!savedFileContent?.length) {
    await nextTick()
    loaded = true
    return
  }
  const keyOfItem = Object.keys(getNewConfigItem())
  formContent.value = savedFileContent.map((it) => {
    const conf: any = {}
    for (const k of keyOfItem) {
      conf[k] = it[k]
    }
    if (!it.id) {
      conf.id = uuid()
    }
    conf.provider = conf.provider || 'openai'
    conf.codexDetectionMode ||= 'auto'
    conf.codexBinaryPath ||= ''
    conf.piDetectionMode ||= 'auto'
    conf.piBinaryPath ||= ''
    conf.providerEnabled = typeof it.providerEnabled === 'boolean' ? it.providerEnabled : Boolean(it.enabled ?? true)
    if (conf.provider === 'openai') {
      const urlKey = normalizeEndpointUrl(conf.providerCompleteApiUrl)
      boundEndpointUrlMap.value[conf.id] = urlKey
      const cached = endpointCache.value[urlKey]
      if (cached && !conf.providerApiSecret?.trim() && cached.providerApiSecret) {
        conf.providerApiSecret = cached.providerApiSecret
      }
    }
    return conf
  })
  const providers = Array.from(new Set(formContent.value.map((it) => it.provider || 'openai')))
  for (const p of providers) {
    const group = formContent.value.filter((it) => (it.provider || 'openai') === p)
    if (group.every((it) => !it.providerEnabled)) group[0].providerEnabled = true
  }
  snapshotCurrentEndpoints()
  activeProvider.value =
    formContent.value.find((it) => it.enabled)?.provider ||
    formContent.value[0]?.provider ||
    'openai'
  await refreshCodex()
  await nextTick()
  loaded = true
}

onMounted(() => {
  loadSettings()
})
onActivated(() => {
  loadSettings()
})

const llmPresetList: {
  name: string
  config: Omit<LlmConfigItem, 'id'>
}[] = [
  {
    name: 'OpenAI 官方 · GPT 系列',
    config: {
      model: 'gpt-6-luna',
      providerApiSecret: '',
      providerCompleteApiUrl: 'https://api.openai.com/v1',
      serveWeight: 100,
      enabled: true
    }
  },
  {
    name: 'DeepSeek 官方 · DeepSeek-V3',
    config: {
      model: 'deepseek-chat',
      providerApiSecret: '',
      providerCompleteApiUrl: 'https://api.deepseek.com/v1',
      serveWeight: 100,
      enabled: true
    }
  },
  {
    name: '火山方舟 · DeepSeek-V3',
    config: {
      model: 'deepseek-v3-250324',
      providerApiSecret: '',
      providerCompleteApiUrl: 'https://ark.cn-beijing.volces.com/api/v3',
      serveWeight: 100,
      enabled: true
    }
  },
  {
    name: '阿里云百炼 · DeepSeek-V3',
    config: {
      model: 'deepseek-v3',
      providerApiSecret: '',
      providerCompleteApiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      serveWeight: 100,
      enabled: true
    }
  },
  {
    name: 'free.v36.cm · GPT-4o mini（体验）',
    config: {
      model: 'gpt-4o-mini',
      providerApiSecret: 'YOUR_API_KEY',
      providerCompleteApiUrl: 'https://free.v36.cm/v1',
      serveWeight: 20,
      enabled: true
    }
  },
  {
    name: '本机 Ollama · Qwen2.5 (7B)',
    config: {
      model: 'qwen2.5:7b',
      providerApiSecret: 'ollama',
      providerCompleteApiUrl: 'http://127.0.0.1:11434/v1',
      serveWeight: 10,
      enabled: true
    }
  }
]

const providerList: Array<{ name: string; url: string }> = [
  {
    name: 'DeepSeek 开放平台',
    url: 'https://platform.deepseek.com/'
  },
  {
    name: '火山引擎 · 火山方舟',
    url: 'https://console.volcengine.com/ark'
  },
  {
    name: '阿里云百炼控制台',
    url: 'https://bailian.console.aliyun.com/?tab=model#/api-key'
  },
  {
    name: 'OpenAI Platform',
    url: 'https://platform.openai.com/api-keys'
  },
  {
    name: 'FREE-CHATGPT-API',
    url: 'https://github.com/popjane/free_chatgpt_api'
  }
]

async function handlePresetClick(selected: (typeof llmPresetList)[number], index) {
  gtagRenderer('model_preset_clicked', {
    name: selected.name
  })
  snapshotCurrentEndpoints()
  await autosave.flush()
  const existingId = formContent.value[index].id || uuid()
  const prevBoundKey =
    boundEndpointUrlMap.value[existingId] ??
    normalizeEndpointUrl(formContent.value[index].providerCompleteApiUrl)
  const nextBoundKey = applyPresetWithEndpointCache(
    formContent.value[index],
    selected.config,
    endpointCache.value,
    prevBoundKey
  )
  formContent.value[index].id = existingId
  formContent.value[index].provider = activeProvider.value
  formContent.value[index].providerEnabled = true
  boundEndpointUrlMap.value[existingId] = nextBoundKey
  apiTestResultMap.value[existingId] = ''
  apiTestErrorMap.value[existingId] = false
  await nextTick()
  await autosave.flush()
}

const firstInputRefList = ref<InstanceType<typeof ElInput>[]>([])
function addConfig() {
  gtagRenderer('new_config_item_added', { config_list_length_before_add: formContent.value.length })
  const newItem = {
    ...getNewConfigItem(),
    provider: activeProvider.value,
    providerCompleteApiUrl: isLocalCli(activeProvider.value)
      ? activeProvider.value === 'pi-cli'
        ? 'pi://local'
        : 'codex://local'
      : ''
  }
  boundEndpointUrlMap.value[newItem.id] = normalizeEndpointUrl(newItem.providerCompleteApiUrl)
  formContent.value.push(newItem)
  nextTick(() => {
    firstInputRefList.value[firstInputRefList.value.length - 1]?.focus()
  })
}
function moveConfigUp(index) {
  ;[formContent.value[index], formContent.value[index - 1]] = [
    formContent.value[index - 1],
    formContent.value[index]
  ]
  gtagRenderer('config_item_moved_up')
}

function moveConfigDown(index) {
  ;[formContent.value[index], formContent.value[index + 1]] = [
    formContent.value[index + 1],
    formContent.value[index]
  ]
  gtagRenderer('config_item_moved_down')
}

function removeConfig(index) {
  formContent.value.splice(index, 1)
  gtagRenderer('config_item_removed')
}

const openExternalLink = (url) => {
  electron.ipcRenderer.send('open-external-link', url)
}
</script>

<style lang="scss" scoped>
.llm-config-page {
  height: 100vh;
  overflow-y: auto;
  background-color: var(--el-bg-color-page);

  &.embedded {
    height: auto;
    flex: 0 0 auto;
    overflow: visible;
  }
}

.model-card-heading,
.cli-top-row,
.api-header-row,
.account-summary,
.account-actions,
.api-tools,
.context-info,
.enable-row,
.model-order {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.model-card-heading,
.cli-top-row,
.api-header-row,
.enable-row {
  justify-content: space-between;
}

.model-card-heading {
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.api-header-row {
  margin-bottom: 12px;
}

.sub-heading {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.model-order {
  gap: 6px;

  .el-button + .el-button {
    margin-left: 0;
  }
}

.account-panel {
  padding: 14px 16px;
  margin-bottom: 16px;
  background-color: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-8);
  border-radius: 10px;
  min-width: 0;
}

.account-summary span {
  overflow-wrap: anywhere;
  font-size: 13px;
}

.account-actions .el-button + .el-button,
.api-tools .el-button + .el-button {
  margin-left: 0;
}

.provider-select-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.provider-option-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
}

.connection-result {
  margin: 10px 0 0;
  padding: 8px 12px;
  border-radius: 8px;
  background-color: var(--el-color-success-light-9);
  color: var(--el-color-success);
  font-size: 12.5px;
  line-height: 1.6;
  overflow-wrap: anywhere;

  &.is-error {
    background-color: var(--el-color-danger-light-9);
    color: var(--el-color-danger);
  }

  &.mb12 {
    margin-top: -4px;
    margin-bottom: 12px;
  }
}

.helper,
.path-text,
.context-info {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.65;
  overflow-wrap: anywhere;
  white-space: normal;
}

.helper {
  margin: 4px 0 0;
}

.path-text {
  margin: 0 0 4px;
}

.parameter-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
}

@media (max-width: 680px) {
  .parameter-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }
}

.context-info {
  justify-content: space-between;
  margin-top: -6px;
  margin-bottom: 10px;
}

.weight-control {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--el-text-color-regular);

  .el-input-number {
    width: 115px;
  }
}

.enable-row {
  padding-top: 10px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.error-text {
  color: var(--el-color-danger);
  font-size: 12.5px;
  overflow-wrap: anywhere;
}

.quiet-collapse {
  border: 0;
  margin-top: 8px;

  :deep(.el-collapse-item__header) {
    height: 32px;
    background: transparent;
    border: 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  :deep(.el-collapse-item__wrap) {
    background: transparent;
    border: 0;
  }

  :deep(.el-collapse-item__content) {
    padding-bottom: 6px;
  }
}

.llm-config-form :deep(.el-select),
.parameter-grid :deep(.el-input-number) {
  width: 100%;
}

.mb0 {
  margin-bottom: 0;
}

.mt8 {
  margin-top: 8px;
}

.mt12 {
  margin-top: 12px;
}
</style>

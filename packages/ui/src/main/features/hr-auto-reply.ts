import fs from 'node:fs/promises'
import path from 'node:path'
import { ipcMain } from 'electron'
import { configSaveHandler, waitForConfigSaves } from './config-save'
import { createHash } from 'node:crypto'
import { atomicWriteFile } from '@geekgeekrun/utils/atomic-file-write.mjs'
import { defaultHrSystemPrompt, createHrResumeBinding, hrInputSources, withMatchingHrResume, bindSameNamedBossResume, hrToolOptions } from '@geekgeekrun/utils/hr-auto-reply.mjs'
import { resumeDocumentPath } from '@geekgeekrun/utils/resume-document.mjs'
import { readConfigFile, configFolderPath, storageFilePath } from '@geekgeekrun/geek-auto-start-chat-with-boss/runtime-file-utils.mjs'
import { formatResumeJsonToMarkdown } from '../../common/utils/resume'
import { listBossResumeAttachments } from './hr-boss-resumes'

export const hrAutoReplyWorkerId = 'hrAutoReplyMain'
const configPath = path.join(configFolderPath, 'hr-auto-reply.json')
const recordsPath = path.join(storageFilePath, 'hr-auto-reply.jsonl')
const defaults = { enabled: false, enabledAt: 0, personalProfile: '', replyDelaySeconds: 60, scanLimit: 100, idleScanMinutes: 5, observeMinutes: 5, observeIntervalSeconds: 5, autoSendResume: true, autoExchangeWechat: false, autoExchangePhone: false, inputSources: hrInputSources, systemPrompt: defaultHrSystemPrompt, resumeFileId: '', resumeFileName: '', resumeText: '', resumeSha256: '', resumeBinding: null }
let bossResumeList: any[] = [], bossResumesReadAt = 0

async function localResumeHash(id: string) {
  return createHash('sha256').update(await fs.readFile(resumeDocumentPath(id))).digest('hex')
}

export async function verifyLocalHrResume(config) {
  const current = await readHrAutoReplyConfig()
  if (current.resumeFileId !== config.resumeFileId || JSON.stringify(current.resumeBinding) !== JSON.stringify(config.resumeBinding)) throw new Error('简历绑定已变化，本条未发送，请重新处理')
  if (!config.resumeBinding || config.resumeBinding.localFileId !== config.resumeFileId || config.resumeBinding.localSha256 !== await localResumeHash(config.resumeFileId)) throw new Error('本地简历已变化或尚未绑定，请重新核对')
}

export function currentPersonalProfile() {
  const matching = readConfigFile('job-ai-match.json') || {}
  const storedResume = readConfigFile('resumes.json')?.[0]
  const resume = matching.resumeText?.trim() || (storedResume?.content ? formatResumeJsonToMarkdown(storedResume) : '')
  return [resume, matching.preferences?.trim()].filter(Boolean).join('\n\n')
}

export async function readHrAutoReplyConfig() {
  let saved
  try { saved = JSON.parse(await fs.readFile(configPath, 'utf8')) }
  catch (error: any) {
    if (error.code !== 'ENOENT') throw error
    saved = { personalProfile: currentPersonalProfile() }
  }
  const matching = readConfigFile('job-ai-match.json') || {}
  let hash = ''
  if (matching.resumeFileId) {
    try { hash = await localResumeHash(matching.resumeFileId) }
    catch (error: any) { if (error.code !== 'ENOENT') throw error }
  }
  return { ...withMatchingHrResume({ ...defaults, ...saved, inputSources: { ...hrInputSources, ...saved.inputSources } }, matching, hash), preferences: matching.preferences || '', learnedPreferences: matching.learnedPreferences || '' }
}

async function saveHrConfig(config) {
  const { resumeFileId, resumeFileName, resumeText, resumeSha256, preferences, learnedPreferences, ...settings } = config
  await atomicWriteFile(configPath, JSON.stringify(settings))
}

export async function ensureHrResumeBinding(config, resumes) {
  const current = await readHrAutoReplyConfig()
  if (current.resumeFileId !== config.resumeFileId || current.resumeSha256 !== config.resumeSha256) throw new Error('AI模型筛选中的简历已变化，本条未发送')
  const resumeBinding = bindSameNamedBossResume(current, resumes)
  if (!current.resumeBinding) await saveHrConfig({ ...current, resumeBinding })
  return resumeBinding
}

export async function readHrAutoReplyRecords() {
  let lines: string
  try { lines = await fs.readFile(recordsPath, 'utf8') }
  catch (error: any) { if (error.code === 'ENOENT') return []; throw error }
  const records = new Map<string, any>()
  for (const line of lines.split('\n').filter(Boolean)) {
    try { const record = JSON.parse(line); records.set(record.key, record) }
    catch { throw new Error('HR自动回复记录不完整，请先人工核对，已停止自动发送') }
  }
  return [...records.values()]
}

export async function saveHrAutoReplyRecord(record) {
  await fs.appendFile(recordsPath, `${JSON.stringify(record)}\n`, { mode: 0o600 })
  return record
}

export function registerHrAutoReply() {
  ipcMain.handle('get-hr-reply-records', async () => (await readHrAutoReplyRecords()).reverse())
  ipcMain.handle('get-hr-auto-reply', async () => { await waitForConfigSaves(); return { config: await readHrAutoReplyConfig(), records: (await readHrAutoReplyRecords()).reverse() } })
  ipcMain.handle('import-hr-personal-profile', () => currentPersonalProfile())
  configSaveHandler('save-hr-auto-reply', async (_, config) => {
    for (const [key, max] of [['personalProfile', 30000], ['systemPrompt', 6000]] as const) {
      if (typeof config[key] !== 'string' || config[key].length > max) throw new Error('请检查个人资料、提示词和简历内容')
    }
    if (!Number.isInteger(config.replyDelaySeconds) || config.replyDelaySeconds < 0 || config.replyDelaySeconds > 86400) throw new Error('收到消息后延迟回复时间应为 0–86400 秒')
    for (const [key, min, max, message] of [
      ['scanLimit', 1, 200, '每次扫描会话数需在 1–200 条之间'],
      ['idleScanMinutes', 1, 1440, '空闲巡检间隔需在 1–1440 分钟之间'],
      ['observeIntervalSeconds', 1, 3600, '观察期巡检间隔需在 1–3600 秒之间'],
      ['observeMinutes', 0, 1440, '回复后观察时长需在 0–1440 分钟之间']
    ] as const) {
      if (!Number.isInteger(config[key]) || config[key] < min || config[key] > max) throw new Error(message)
    }
    if (typeof config.enabled !== 'boolean') throw new Error('自动回复开关无效')
    if (typeof config.autoSendResume !== 'boolean') throw new Error('自动发送简历设置无效')
    const inputSources = { ...hrInputSources, ...config.inputSources }
    if (Object.values(inputSources).some(value => typeof value !== 'boolean') || Object.keys(inputSources).some(key => !(key in hrInputSources))) throw new Error('提供给Agent的资料设置无效')
    const existing = await readHrAutoReplyConfig()
    const toolFlags = Object.fromEntries(hrToolOptions.map(tool => [tool.configKey, config[tool.configKey] ?? existing[tool.configKey]]))
    if (Object.values(toolFlags).some(value => typeof value !== 'boolean')) throw new Error('Agent工具开关设置无效')
    const enabledAt = config.enabled ? (existing.enabled && existing.enabledAt ? existing.enabledAt : Date.now()) : 0
    const saved = { ...existing, ...toolFlags, enabled: config.enabled, enabledAt, replyDelaySeconds: config.replyDelaySeconds, scanLimit: config.scanLimit, idleScanMinutes: config.idleScanMinutes, observeMinutes: config.observeMinutes, observeIntervalSeconds: config.observeIntervalSeconds, personalProfile: config.personalProfile, inputSources, systemPrompt: config.systemPrompt }
    await saveHrConfig(saved)
    return saved
  })
  ipcMain.handle('list-hr-boss-resumes', async () => {
    bossResumeList = await listBossResumeAttachments()
    bossResumesReadAt = Date.now()
    return bossResumeList
  })
  ipcMain.handle('bind-hr-boss-resume', async (_, { resumeId, confirmed, resumeFileId, resumeSha256 }) => {
    if (confirmed !== true) throw new Error('请先核对本地PDF与BOSS附件是同一份简历')
    if (Date.now() - bossResumesReadAt > 5 * 60 * 1000) throw new Error('请重新读取BOSS附件列表')
    const matches = bossResumeList.filter(resume => String(resume.resumeId) === resumeId)
    if (matches.length !== 1) throw new Error('请选择唯一的BOSS附件简历')
    const config = await readHrAutoReplyConfig()
    if (config.resumeFileId !== resumeFileId || config.resumeSha256 !== resumeSha256) throw new Error('AI模型筛选中的简历已变化，请重新核对BOSS附件')
    config.resumeSha256 = await localResumeHash(config.resumeFileId)
    config.resumeBinding = createHrResumeBinding(config, matches[0])
    await saveHrConfig(config)
    return config.resumeBinding
  })
  ipcMain.handle('unbind-hr-resume', async () => {
    const config = await readHrAutoReplyConfig()
    config.resumeBinding = null
    await saveHrConfig(config)
  })
}

export const portableFiles = ['boss.json', 'common-job-condition-config.json', 'target-company-list.json', 'job-ai-match.json', 'llm.json', 'resumes.json', 'hr-auto-reply.json', 'auto-chat-schedule.json']
const arrayFiles = new Set(['target-company-list.json', 'llm.json', 'resumes.json'])
const privateKey = /^(providerApiSecret|apiKey|geminiApiKey|accessToken|refreshToken|groupRobotAccessToken|password|cookie|cookies|codexBinaryPath|piBinaryPath|resumeFileId|resumeBinding|resumeSha256)$/i
const forbiddenKey = /^(?:__proto__|prototype|constructor)$/

function clean(value) {
  if (Array.isArray(value)) return value.map(clean)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).filter(([key]) => !privateKey.test(key) && !forbiddenKey.test(key)).map(([key, item]) => [key, clean(item)]))
}

export function exportPortableConfig(config) {
  const files = {}
  for (const name of portableFiles) {
    if (config[name] == null) continue
    files[name] = clean(config[name])
  }
  for (const model of files['llm.json'] || []) {
    model.codexDetectionMode = 'auto'
    model.piDetectionMode = 'auto'
    if (model.providerCompleteApiUrl) {
      try {
        const url = new URL(model.providerCompleteApiUrl)
        if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) model.providerCompleteApiUrl = ''
        else { url.username = ''; url.password = ''; url.search = ''; url.hash = ''; model.providerCompleteApiUrl = url.toString() }
      } catch { model.providerCompleteApiUrl = '' }
    }
  }
  return { format: 'geekgeekrun-config', version: 1, exportedAt: new Date().toISOString(), files }
}

export function preparePortableImport(bundle, current) {
  if (!bundle || bundle.format !== 'geekgeekrun-config' || bundle.version !== 1 || !bundle.files || typeof bundle.files !== 'object' || Array.isArray(bundle.files)) throw new Error('配置文件格式或版本不受支持')
  const result = {}
  for (const name of portableFiles) {
    if (!(name in bundle.files)) continue
    const value = bundle.files[name]
    if (!value || typeof value !== 'object' || Array.isArray(value) !== arrayFiles.has(name)) throw new Error(`配置内容无效：${name}`)
    if (name === 'llm.json' && value.some(model => !model || typeof model !== 'object' || Array.isArray(model))) throw new Error('模型配置内容无效')
    result[name] = clean(value)
  }
  if (!Object.keys(result).length) throw new Error('配置文件中没有可导入的设置')
  if (result['job-ai-match.json']) result['job-ai-match.json'].resumeFileId = ''
  if (result['hr-auto-reply.json']) {
    Object.assign(result['hr-auto-reply.json'], { resumeFileId: '', resumeSha256: '', resumeBinding: null })
    if (result['hr-auto-reply.json'].enabled === true) result['hr-auto-reply.json'].enabled = false
  }
  if (result['auto-chat-schedule.json']?.enabled === true) result['auto-chat-schedule.json'].enabled = false
  if (result['boss.json']?.autoReminder && current['boss.json']?.autoReminder?.geminiApiKey) result['boss.json'].autoReminder.geminiApiKey = current['boss.json'].autoReminder.geminiApiKey
  for (const model of result['llm.json'] || []) {
    const old = (current['llm.json'] || []).find(item => item.id === model.id && item.provider === model.provider) || (current['llm.json'] || []).find(item => item.provider === model.provider && item.model === model.model)
    for (const key of ['codexDetectionMode', 'codexBinaryPath', 'piDetectionMode', 'piBinaryPath']) {
      if (old?.[key] !== undefined) model[key] = old[key]
    }
    if (!old) { model.codexDetectionMode = 'auto'; model.piDetectionMode = 'auto' }
    if (old && old.providerCompleteApiUrl === model.providerCompleteApiUrl && old.providerApiSecret) model.providerApiSecret = old.providerApiSecret
    else model.providerApiSecret = ''
  }
  return result
}

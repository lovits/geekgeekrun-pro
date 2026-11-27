export function normalizeEndpointUrl(url = '') {
  return String(url || '').trim().replace(/\/+$/, '')
}

export function recordEndpointEntry(cache, conf, boundUrlKey) {
  if (!cache || !conf || (conf.provider || 'openai') !== 'openai') return cache
  const key = normalizeEndpointUrl(conf.providerCompleteApiUrl)
  if (!key || !/^https?:\/\//i.test(key)) return cache
  if (boundUrlKey !== undefined && key !== boundUrlKey) return cache
  const prev = cache[key]
  const rawSecret = String(conf.providerApiSecret || '').trim()
  const nextSecret =
    rawSecret && rawSecret !== 'YOUR_API_KEY'
      ? rawSecret
      : prev?.providerApiSecret || ''
  const nextModel = String(conf.model || '').trim() || prev?.model || ''
  cache[key] = {
    providerCompleteApiUrl: String(conf.providerCompleteApiUrl || '').trim(),
    model: nextModel,
    providerApiSecret: nextSecret
  }
  return cache
}

export function applyEndpointUrlEdit(conf, cache = {}, prevBoundUrlKey = '') {
  const nextKey = normalizeEndpointUrl(conf?.providerCompleteApiUrl)
  if (nextKey !== prevBoundUrlKey) {
    const cached = nextKey ? cache[nextKey] : null
    conf.providerApiSecret = cached?.providerApiSecret || ''
    if (cached?.model) {
      conf.model = cached.model
    }
  }
  return nextKey
}

export function applyPresetWithEndpointCache(conf, presetConfig, cache = {}, prevBoundUrlKey = '') {
  recordEndpointEntry(cache, conf, prevBoundUrlKey)
  const targetKey = normalizeEndpointUrl(presetConfig?.providerCompleteApiUrl)
  const cached = targetKey ? cache[targetKey] : null
  for (const k of Object.keys(conf)) {
    if (k in presetConfig) {
      conf[k] = presetConfig[k]
    }
  }
  if (cached?.providerApiSecret) {
    conf.providerApiSecret = cached.providerApiSecret
  }
  if (prevBoundUrlKey !== targetKey && cached?.model) {
    conf.model = cached.model
  }
  recordEndpointEntry(cache, conf, targetKey)
  return targetKey
}

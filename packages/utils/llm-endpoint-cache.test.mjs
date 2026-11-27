import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeEndpointUrl,
  recordEndpointEntry,
  applyEndpointUrlEdit,
  applyPresetWithEndpointCache
} from './llm-endpoint-cache.mjs'
import { findCurrentRunHrFailure } from './hr-auto-reply.mjs'

test('switching from OpenAI custom model to another preset and back restores both API key and custom model', () => {
  const cache = {}
  const conf = {
    id: '1',
    provider: 'openai',
    providerCompleteApiUrl: 'https://api.openai.com/v1',
    providerApiSecret: 'sk-openai-secret',
    model: 'gpt-6-astra',
    serveWeight: 100,
    enabled: true
  }
  let boundKey = normalizeEndpointUrl(conf.providerCompleteApiUrl)
  recordEndpointEntry(cache, conf, boundKey)

  const deepseekPreset = {
    model: 'deepseek-chat',
    providerApiSecret: '',
    providerCompleteApiUrl: 'https://api.deepseek.com/v1',
    serveWeight: 100,
    enabled: true
  }
  const openaiPreset = {
    model: 'gpt-6-luna',
    providerApiSecret: '',
    providerCompleteApiUrl: 'https://api.openai.com/v1',
    serveWeight: 100,
    enabled: true
  }

  boundKey = applyPresetWithEndpointCache(conf, deepseekPreset, cache, boundKey)
  assert.equal(conf.providerCompleteApiUrl, 'https://api.deepseek.com/v1')
  assert.equal(conf.providerApiSecret, '')
  assert.equal(conf.model, 'deepseek-chat')

  boundKey = applyPresetWithEndpointCache(conf, openaiPreset, cache, boundKey)
  assert.equal(conf.providerCompleteApiUrl, 'https://api.openai.com/v1')
  assert.equal(conf.providerApiSecret, 'sk-openai-secret')
  assert.equal(conf.model, 'gpt-6-astra')

  // Clicking the same preset again while already on that endpoint resets to preset default model while keeping key
  boundKey = applyPresetWithEndpointCache(conf, openaiPreset, cache, boundKey)
  assert.equal(conf.providerApiSecret, 'sk-openai-secret')
  assert.equal(conf.model, 'gpt-6-luna')

  // Presets with built-in non-empty default secret (like Ollama 'ollama') also preserve user-customized secret
  const ollamaPreset = {
    model: 'qwen2.5:7b',
    providerApiSecret: 'ollama',
    providerCompleteApiUrl: 'http://127.0.0.1:11434/v1',
    serveWeight: 10,
    enabled: true
  }
  boundKey = applyPresetWithEndpointCache(conf, ollamaPreset, cache, boundKey)
  assert.equal(conf.providerApiSecret, 'ollama')
  conf.providerApiSecret = 'custom-ollama-token'
  conf.model = 'qwen2.5:14b'
  boundKey = applyPresetWithEndpointCache(conf, openaiPreset, cache, boundKey)
  boundKey = applyPresetWithEndpointCache(conf, ollamaPreset, cache, boundKey)
  assert.equal(conf.providerApiSecret, 'custom-ollama-token')
  assert.equal(conf.model, 'qwen2.5:14b')
  assert.equal(cache['http://127.0.0.1:11434/v1'].providerApiSecret, 'custom-ollama-token')
})

test('manually editing Base URL clears previous endpoint secret immediately and never leaks it to new URL cache', () => {
  const cache = {}
  const conf = {
    id: '1',
    provider: 'openai',
    providerCompleteApiUrl: 'https://api.openai.com/v1',
    providerApiSecret: 'sk-openai-secret',
    model: 'gpt-6-luna'
  }
  let boundKey = normalizeEndpointUrl(conf.providerCompleteApiUrl)
  recordEndpointEntry(cache, conf, boundKey)

  // Simulate user typing a new URL before boundKey updates: recordEndpointEntry refuses mismatched boundKey
  conf.providerCompleteApiUrl = 'https://evil.example.com/v1'
  recordEndpointEntry(cache, conf, boundKey)
  assert.equal(cache['https://evil.example.com/v1'], undefined)

  // Input handler runs: clears secret for unknown URL and binds new key
  boundKey = applyEndpointUrlEdit(conf, cache, boundKey)
  assert.equal(boundKey, 'https://evil.example.com/v1')
  assert.equal(conf.providerApiSecret, '')

  // Typing original URL back restores cached secret and model
  conf.providerCompleteApiUrl = 'https://api.openai.com/v1/'
  boundKey = applyEndpointUrlEdit(conf, cache, boundKey)
  assert.equal(boundKey, 'https://api.openai.com/v1')
  assert.equal(conf.providerApiSecret, 'sk-openai-secret')
  assert.equal(conf.model, 'gpt-6-luna')
})

test('findCurrentRunHrFailure ignores historical task failures before enabledAt and matches current generation failure', () => {
  const records = [
    { key: 'task:200', runStartedAt: 2000, at: new Date(2500).toISOString(), status: 'failed', reason: '本次浏览器启动失败' },
    { key: 'task:100', runStartedAt: 1000, at: new Date(1200).toISOString(), status: 'failed', reason: '昨天的旧错误' }
  ]
  assert.equal(findCurrentRunHrFailure(records, 0), null)
  assert.equal(findCurrentRunHrFailure(records, 2001), null)
  assert.equal(findCurrentRunHrFailure(records, 3000), null)
  assert.equal(findCurrentRunHrFailure(records, 2000)?.reason, '本次浏览器启动失败')
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exportPortableConfig, preparePortableImport } from './portable-config.mjs'

test('portable settings keep preferences while excluding secrets and device paths', () => {
  const current = {
    'boss.json': { expectEmploymentType: 1902, autoReminder: { geminiApiKey: 'secret' } },
    'job-ai-match.json': { preferences: 'Agent', resumeText: 'resume', resumeFileId: 'local-file' },
    'llm.json': [{ id: 'a', provider: 'pi-cli', model: 'model', providerApiSecret: 'key', piBinaryPath: '/Users/a/pi', piDetectionMode: 'manual', providerCompleteApiUrl: 'https://example.com/v1' }],
    'target-company-list.json': ['company'],
    'hr-auto-reply.json': { personalProfile: '真实背景', autoSendResume: true, resumeName: '简历.pdf' },
    'auto-chat-schedule.json': { enabled: true, weekdays: [1, 2], morning: { enabled: true, start: '09:00', end: '12:00' }, afternoon: { enabled: false, start: '14:00', end: '18:00' } }
  }
  const bundle = exportPortableConfig(current)
  assert.equal(bundle.files['boss.json'].autoReminder.geminiApiKey, undefined)
  assert.equal(bundle.files['llm.json'][0].providerApiSecret, undefined)
  assert.equal(bundle.files['llm.json'][0].piBinaryPath, undefined)
  assert.equal(bundle.files['llm.json'][0].piDetectionMode, 'auto')
  assert.equal(bundle.files['job-ai-match.json'].resumeFileId, undefined)
  const destination = { 'boss.json': { autoReminder: { geminiApiKey: 'local-secret' } }, 'llm.json': [{ id: 'a', provider: 'pi-cli', model: 'model', piBinaryPath: '/other/pi', piDetectionMode: 'manual', providerCompleteApiUrl: 'https://example.com/v1', providerApiSecret: 'local-key' }] }
  const imported = preparePortableImport(bundle, destination)
  assert.equal(imported['boss.json'].autoReminder.geminiApiKey, 'local-secret')
  assert.equal(imported['llm.json'][0].piBinaryPath, '/other/pi')
  assert.equal(imported['llm.json'][0].providerApiSecret, 'local-key')
  assert.equal(imported['job-ai-match.json'].resumeFileId, '')
  assert.equal(imported['job-ai-match.json'].preferences, 'Agent')
  assert.deepEqual(imported['target-company-list.json'], ['company'])
  assert.deepEqual(imported['hr-auto-reply.json'], { ...current['hr-auto-reply.json'], resumeFileId: '', resumeSha256: '', resumeBinding: null })
  assert.equal(imported['auto-chat-schedule.json'].enabled, false)
  assert.deepEqual(imported['auto-chat-schedule.json'].weekdays, [1, 2])
  assert.equal(preparePortableImport(bundle, {})['llm.json'][0].providerApiSecret, '')
})

test('unsupported and malformed imports are rejected', () => {
  assert.throws(() => preparePortableImport({ format: 'geekgeekrun-config', version: 2, files: {} }, {}))
  assert.throws(() => preparePortableImport({ format: 'geekgeekrun-config', version: 1, files: { 'llm.json': {} } }, {}))
  assert.throws(() => preparePortableImport({ format: 'geekgeekrun-config', version: 1, files: { 'llm.json': [null] } }, {}))
})

test('local endpoints and credentials in URLs are not exported', () => {
  const bundle = exportPortableConfig({ 'llm.json': [{ providerCompleteApiUrl: 'http://127.0.0.1:1234/v1' }, { providerCompleteApiUrl: 'https://user:secret@example.com/v1?token=secret' }] })
  assert.equal(bundle.files['llm.json'][0].providerCompleteApiUrl, '')
  assert.equal(bundle.files['llm.json'][1].providerCompleteApiUrl, 'https://example.com/v1')
})

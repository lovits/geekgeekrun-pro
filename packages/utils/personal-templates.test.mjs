import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { readPersonalTemplates, savePersonalTemplate, deletePersonalTemplate, initializePersonalTemplates } from './personal-templates.mjs'

test('templates persist independently and deletion does not affect other categories', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ggr-templates-')), file = path.join(dir, 'templates.json')
  try {
    await savePersonalTemplate(file, { kind: 'expected-companies', name: '实习', data: '甲,乙' })
    await savePersonalTemplate(file, { kind: 'job-preferences', name: '实习', data: 'Agent' })
    await savePersonalTemplate(file, { kind: 'job-regex', name: '研发', data: { expectJobNameRegExpStr: 'Agent|后端' } })
    assert.equal(readPersonalTemplates(file).length, 3)
    await assert.rejects(savePersonalTemplate(file, { kind: 'job-preferences', name: '实习', data: '重复' }))
    await deletePersonalTemplate(file, { kind: 'job-preferences', name: '实习' })
    assert.deepEqual(readPersonalTemplates(file).map(item => item.kind), ['expected-companies', 'job-regex'])
    assert.equal((await fs.stat(file)).mode & 0o777, 0o600)
  } finally { await fs.rm(dir, { recursive: true, force: true }) }
})

test('built-in and personal templates share a list and deleted defaults stay deleted', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ggr-templates-')), file = path.join(dir, 'templates.json')
  try {
    const defaults = [{ name: '默认', data: '原始内容' }]
    await savePersonalTemplate(file, { kind: 'hr-profile', name: '自定义', data: '我的内容' })
    assert.deepEqual((await initializePersonalTemplates(file, 'hr-profile', defaults)).map(item => item.name), ['自定义', '默认'])
    await assert.rejects(savePersonalTemplate(file, { kind: 'hr-profile', name: '默认', data: '重复' }))
    await deletePersonalTemplate(file, { kind: 'hr-profile', name: '默认' })
    assert.deepEqual((await initializePersonalTemplates(file, 'hr-profile', defaults)).map(item => item.name), ['自定义'])
    await savePersonalTemplate(file, { kind: 'hr-profile', name: '默认', data: '新内容' })
    assert.equal((await initializePersonalTemplates(file, 'hr-profile', defaults)).find(item => item.name === '默认').data, '新内容')
  } finally { await fs.rm(dir, { recursive: true, force: true }) }
})

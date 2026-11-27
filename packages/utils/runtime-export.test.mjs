import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeExportOptions, selectExportRecords, recordsToCsv } from './runtime-export.mjs'
const rows = [
  { encryptJobId: 'one', companyName: '甲公司', jobName: 'Python后端实习', address: '北京', date: '2026-11-17 16:00:00.000', publishDate: null, markReason: 3 },
  { encryptJobId: 'two', companyName: '甲公司', jobName: 'Java后端实习', address: '上海', date: '2026-11-18 15:59:59.999', publishDate: '2026-11-18', markReason: 4 },
  { encryptJobId: 'three', companyName: '乙公司', jobName: 'Python后端', address: '北京', date: '2026-11-18 16:00:00.000', publishDate: '2026-11-19', markReason: 3 }
]
const database = { v_chat_startup_log: rows, v_mark_as_not_suit_log: rows, v_job_library: rows, v_company_library: [{ name: '甲科技', brandName: '甲', industryName: '互联网' }, { name: '乙制造', industryName: '制造业' }] }
const feedback = [{ jobId: 'one', value: 'like' }, { jobId: 'two', value: 'dislike' }]
test('reply export filters company, job and Beijing date and keeps original fields', () => {
  const replies = [{ company: '甲公司', job: 'Agent实习', boss: '李', message: '你好', reply: '您好', status: 'replied', at: '2026-11-17T16:00:00Z' }, { company: '乙公司', job: 'Java', at: '2026-11-18T16:00:00Z' }]
  const selected = selectExportRecords({ replies }, { scope: 'replies', filters: { company: '甲', job: 'agent', startDate: '2026-11-18', endDate: '2026-11-18' } })
  assert.deepEqual(selected, [replies[0]])
  const csv = recordsToCsv(selected, 'replies')
  assert.match(csv, /收到的消息/); assert.match(csv, /回复内容/); assert.match(csv, /已回复/); assert.match(csv, /2026-11-18 00:00:00/)
})
test('export filters combine company, role, city and explicit preference without changing source rows', () => {
  const result = selectExportRecords(database, { scope: 'chats', filters: { company: '甲', job: 'python', city: '北京', feedback: 'like' } }, feedback)
  assert.equal(result.length, 1); assert.equal(result[0].encryptJobId, 'one'); assert.equal(result[0].preferenceFeedback, 'like')
  assert.equal(rows[0].preferenceFeedback, undefined)
  assert.equal(selectExportRecords(database, { scope: 'jobs', filters: { feedback: 'unmarked' } }, feedback)[0].encryptJobId, 'three')
})
test('date ranges are inclusive Beijing calendar days, independent of host timezone', () => {
  const filters = { startDate: '2026-11-18', endDate: '2026-11-18' }
  assert.deepEqual(selectExportRecords(database, { scope: 'chats', filters }).map(row => row.encryptJobId), ['one', 'two'])
  assert.deepEqual(selectExportRecords(database, { scope: 'jobs', filters }).map(row => row.encryptJobId), ['two'])
  assert.equal(selectExportRecords(database, { scope: 'jobs', filters: { startDate: '2030-01-01' } }).length, 0)
})
test('not-suitable reasons and company-industry export use the correct records', () => {
  const selected = selectExportRecords(database, { scope: 'unsuitable', filters: { markReason: 3 } })
  assert.equal(selected.length, 2); assert.equal(selected[0].markReasonLabel, '职位不合适')
  assert.deepEqual(selectExportRecords(database, { scope: 'companies', filters: { company: '甲', industry: '互联网', feedback: 'dislike', startDate: '2030-01-01' } }), [database.v_company_library[0]])
})
test('invalid scopes, unsupported formats and invalid dates are rejected; full export remains the default', () => {
  assert.deepEqual(normalizeExportOptions(), { scope: 'all', format: 'json', filters: {} })
  for (const options of [{ scope: 'bosses' }, { scope: '__proto__' }, { scope: 'jobs', format: 'xlsx' }, { scope: 'jobs', filters: { startDate: '2026-02-30' } }, { scope: 'jobs', filters: { startDate: '2026-11-19', endDate: '2026-11-18' } }, { scope: 'jobs', filters: { feedback: 'fake' } }, { scope: 'unsuitable', filters: { markReason: 999 } }]) assert.throws(() => normalizeExportOptions(options))
})
test('CSV preserves quoted multiline content, renders Beijing dates and neutralizes formulas', () => {
  const csv = recordsToCsv([{ jobName: '=HYPERLINK("bad")', description: '第一行,"引号"\n第二行', date: rows[0].date, preferenceFeedback: 'like' }], 'chats')
  assert.ok(csv.startsWith('\uFEFF')); assert.ok(csv.includes("'=HYPERLINK")); assert.ok(csv.includes('"第一行,""引号""\n第二行"')); assert.ok(csv.includes('2026-11-18 00:00:00')); assert.ok(csv.includes('喜欢'))
})

test('simulation export includes displayed local and online records with filters and labels', () => {
  const simulation = [
    { jobId: 'one', company: '甲公司', city: '北京', jobName: 'Agent实习', status: 'recommend', score: 85, reason: '匹配', recordedAt: '2026-11-18T08:00:00Z', url: 'https://www.zhipin.com/job_detail/one.html' },
    { jobId: 'two', company: '乙公司', city: '上海', jobName: 'Java后端', status: 'reject', score: null, reason: '非实习', evaluatedAt: '2026-11-19T08:00:00Z' }
  ]
  const data = { simulation }
  const selected = selectExportRecords(data, { scope: 'simulation', filters: { company: '甲', job: 'agent', city: '北京', feedback: 'like', startDate: '2026-11-18', endDate: '2026-11-18' } }, feedback)
  assert.equal(selected.length, 1); assert.equal(selected[0].communicationStatus, '拟沟通'); assert.equal(selected[0].score, 85)
  assert.equal(selected[0].url, simulation[0].url); assert.equal(simulation[0].communicationStatus, undefined)
  const csv = recordsToCsv(selectExportRecords(data, { scope: 'simulation' }, feedback), 'simulation')
  assert.match(csv, /沟通状态/); assert.match(csv, /拟沟通/); assert.match(csv, /未沟通/); assert.match(csv, /职位链接/)
  assert.deepEqual(selectExportRecords({ simulation: [] }, { scope: 'simulation' }), [])
})

test('simulation export filters by communication outcome and whether AI scored', () => {
  const simulation = [{jobId:'a', status:'recommend', score:87}, {jobId:'b', status:'reject', score:null}, {jobId:'c', status:'chatted', score:0}]
  assert.deepEqual(selectExportRecords({simulation}, {scope:'simulation', filters:{outcome:'ineligible', score:'unscored'}}).map(r=>r.jobId), ['b'])
  assert.deepEqual(selectExportRecords({simulation}, {scope:'simulation', filters:{outcome:'delivered', score:'scored'}}).map(r=>r.jobId), ['c'])
  assert.throws(()=>normalizeExportOptions({scope:'simulation', filters:{outcome:'bad'}}))
  assert.throws(()=>normalizeExportOptions({scope:'simulation', filters:{score:'bad'}}))
})

test('failed evaluations export separately from rejected jobs and keep an empty score', () => {
  const simulation = [{ jobId: 'failed', status: 'error', score: null, reason: '模型调用失败' }, { jobId: 'rejected', status: 'reject', score: 30 }]
  const selected = selectExportRecords({ simulation }, { scope: 'simulation', filters: { outcome: 'failed', score: 'unscored' } })
  assert.deepEqual(selected.map(row => row.jobId), ['failed'])
  assert.equal(selected[0].communicationStatus, '评估失败')
  assert.equal(selected[0].score, null)
  assert.match(recordsToCsv(selected, 'simulation'), /评估失败/)
})

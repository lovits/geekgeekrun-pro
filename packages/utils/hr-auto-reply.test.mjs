import test from 'node:test'
import assert from 'node:assert/strict'
import { buildHrReplyMessages, createHrResumeBinding, boundBossResume, hrReplyPlan, parseHrReply, processHrMessage, requestsResume, withMatchingHrResume, hrReplyIsDue } from './hr-auto-reply.mjs'

test('reply delay resets on new HR messages and does not block other conversations', () => {
  const pending = new Map(), a = { encryptBossId: 'a', encryptJobId: 'j', lastMessageId: 'm1', lastIsSelf: false }, b = { ...a, encryptBossId: 'b' }
  assert.equal(hrReplyIsDue(a, pending, 30, 0), false)
  assert.equal(hrReplyIsDue(b, pending, 30, 1000), false)
  assert.equal(hrReplyIsDue(a, pending, 30, 29999), false)
  assert.equal(hrReplyIsDue(a, pending, 30, 30000), true)
  assert.equal(hrReplyIsDue({ ...a, lastMessageId: 'm2' }, pending, 30, 30000), false)
  assert.equal(hrReplyIsDue(b, pending, 30, 31000), true)
  assert.equal(hrReplyIsDue({ ...a, lastIsSelf: true }, pending, 30, 60000), false)
  assert.equal(hrReplyIsDue(a, pending, 0, 61000), true)
})

const message = (text, extra = {}) => ({ mid: 'hr-1', text, isSelf: false, status: 0, templateId: 1, messageType: 'text', ...extra })
const friend = { encryptBossId: 'boss', encryptJobId: 'job', brandName: '示例公司', name: 'HR' }
const config = { personalProfile: '熟悉Python和Agent评测；可每周4天实习3个月。', autoSendResume: true, resumeBinding: { bossResumeId: 'r' } }

test('HR reply always uses the AI matching resume; stale independent copies cannot override it', () => {
  const binding = { localFileId: 'shared.pdf', localSha256: 'hash', bossResumeId: 'boss-resume' }
  const old = { ...config, resumeFileId: 'old.pdf', resumeText: '旧的独立简历', resumeBinding: binding }
  const matching = { resumeFileId: 'shared.pdf', resumeFileName: '统一简历.pdf', resumeText: 'AI模型筛选中的完整简历' }
  const current = withMatchingHrResume(old, matching, 'hash')
  assert.equal(current.resumeText, matching.resumeText)
  assert.equal(current.resumeFileId, matching.resumeFileId)
  assert.equal(current.resumeFileName, matching.resumeFileName)
  assert.deepEqual(current.resumeBinding, binding)
  assert.equal(withMatchingHrResume(current, { ...matching, resumeFileId: 'new.pdf' }, 'new-hash').resumeBinding, null)
  assert.equal(withMatchingHrResume(current, matching, 'changed-file-hash').resumeBinding, null)
  const removed = withMatchingHrResume(current, {}, '')
  assert.equal(removed.resumeFileId, '')
  assert.equal(removed.resumeText, '')
  assert.equal(removed.resumeBinding, null)
})

test('explicit resume text requests use native delivery; negative and external requests do not', () => {
  for (const text of ['请发一下简历', '方便提供一份简历吗', '简历可以发我一下吗', '给个简历吧']) assert.equal(requestsResume(text), true, text)
  for (const text of ['暂时不用发简历', '不要发简历', '简历不用再发了', '请发简历到hr@example.com', '请微信发简历', '我看过你的简历', '感谢您的投递，但很遗憾您的简历和该职位的需求不完全一致', '对方已同意，您的附件简历已发送给对方', '您的附件简历已发送给Boss点击查看附件', '示例-个人简历.pdf', '感谢提供简历']) assert.equal(requestsResume(text), false, text)
  assert.equal(hrReplyPlan([message('请发一下简历')], config).action, 'resume')
  assert.equal(hrReplyPlan([message('简历发到邮箱里')], config).action, 'manual')
})

test('native inbound resume card is accepted; interview and contact cards are never accepted', () => {
  assert.deepEqual(hrReplyPlan([message('', { messageType: 'dialog', dialog: { type: 2, operated: false } })], config), { action: 'resume', invitation: true })
  for (const type of [0, 1, 17, 33]) assert.equal(hrReplyPlan([message('', { messageType: 'dialog', dialog: { type } })], config).action, 'manual')
  assert.equal(hrReplyPlan([message('请发简历')], { ...config, autoSendResume: false }).action, 'manual')
})

test('self-last, system messages, revoked and mixed histories never cause proactive follow-up', () => {
  assert.equal(hrReplyPlan([message('你好', { isSelf: true })], config).action, 'skip')
  assert.equal(hrReplyPlan([message('你好'), message('系统消息', { templateId: 3 })], config).action, 'skip')
  assert.equal(hrReplyPlan([message('已撤回', { status: 3 })], config).action, 'skip')
  assert.equal(hrReplyPlan([message('你好'), message('', { messageType: 'image' })], config).action, 'manual')
})

test('model gets the latest eight messages from both participants and the latest saved profile', () => {
  const history = Array.from({ length: 12 }, (_, index) => message(`消息${index}`, { mid: `m${index}`, isSelf: index % 2 === 0 }))
  history.splice(7, 0, message('系统提示', { templateId: 3 }))
  const input = buildHrReplyMessages(config.personalProfile, history)
  assert.equal(input.length, 9)
  assert.equal(input[1].content, '消息4')
  assert.equal(input[1].role, 'assistant')
  assert.equal(input.at(-1).content, '消息11')
  assert.equal(input.at(-1).role, 'user')
  assert.ok(input[0].content.includes(config.personalProfile))
  assert.ok(buildHrReplyMessages('新资料', history)[0].content.includes('新资料'))
})

test('editable prompt and imported resume are included without changing the latest-eight boundary', () => {
  const history = Array.from({ length: 10 }, (_, index) => message(`消息${index}`, { mid: index + 1, isSelf: index % 2 === 0 }))
  const input = buildHrReplyMessages('我的个人资料', history, { systemPrompt: '重点回答后端实践，用两句话。', resumeText: '模拟简历：Go/Gin网关项目。' })
  assert.equal(input.length, 9)
  assert.ok(input[0].content.includes('重点回答后端实践，用两句话。'))
  assert.ok(input[0].content.includes('模拟简历：Go/Gin网关项目。'))
  assert.ok(input[0].content.includes('我的个人资料'))
  assert.ok(input[0].content.includes('固定处理要求'))
  assert.equal(input[1].content, '消息2')
  const updated = buildHrReplyMessages('新资料', history, { systemPrompt: '改为一句话。', resumeText: '新简历' })
  assert.ok(updated[0].content.includes('改为一句话。'))
  assert.ok(!updated[0].content.includes('重点回答后端实践'))
})

test('model output is validated; file-delivery claims and unknown facts cannot bypass the action boundary', () => {
  assert.deepEqual(parseHrReply('{"action":"reply","text":"我熟悉Python和Agent评测。"}'), { action: 'reply', text: '我熟悉Python和Agent评测。' })
  assert.equal(parseHrReply('```json\n{"action":"manual","reason":"未提供到岗日期"}\n```').action, 'manual')
  assert.equal(parseHrReply('{"action":"reply","text":"简历已发送，请查收。"}').action, 'manual')
  for (const value of ['非JSON', '{"action":"resume"}', '{"action":"reply","text":""}', JSON.stringify({ action: 'reply', text: '长'.repeat(301) })]) assert.throws(() => parseHrReply(value))
})

test('binding uses IDs and version metadata, excludes portfolios and rejects changed files', () => {
  const local = { resumeFileId: 'file.pdf', resumeSha256: 'a'.repeat(64) }
  const resume = { resumeId: '1', showName: '我的简历.pdf', uploadTime: '2026-11-22', annexType: 0 }
  const binding = createHrResumeBinding(local, resume)
  assert.equal(boundBossResume([resume, { ...resume, resumeId: '2' }], binding).resumeId, '1')
  assert.throws(() => boundBossResume([{ ...resume, uploadTime: '2026-11-23' }], binding), /已更新/)
  assert.throws(() => boundBossResume([{ ...resume, resumeId: '2' }], binding), /不可用/)
  assert.throws(() => boundBossResume([{ ...resume, restricted: true }], binding), /不可用/)
  assert.throws(() => createHrResumeBinding(local, { ...resume, annexType: 1 }), /不能绑定/)
  assert.throws(() => createHrResumeBinding({ ...local, resumeSha256: '' }, resume), /先导入/)
  assert.equal(hrReplyPlan([message('请发简历')], { ...config, resumeBinding: null }).action, 'manual')
})

function harness(history, overrides = {}) {
  const saved = [], records = new Set()
  let generations = 0, sends = 0
  const args = {
    friend, history, config, records,
    save: async record => { saved.push(record); return record },
    generate: async () => { generations++; return { action: 'reply', text: '我熟悉Python。' } },
    isCurrent: async () => true,
    send: async plan => { sends++; return { status: plan.action === 'resume' ? 'resume_sent' : 'replied' } },
    ...overrides
  }
  return { args, saved, counts: () => ({ generations, sends }) }
}

test('HR question is replied once and the durable reservation precedes sending', async () => {
  const h = harness([message('你会什么技术？')])
  await processHrMessage(h.args)
  await processHrMessage(h.args)
  assert.deepEqual(h.counts(), { generations: 1, sends: 1 })
  assert.deepEqual(h.saved.map(record => record.status), ['processing', 'replied'])
  const restarted = harness(h.args.history, { records: new Set(h.saved.map(record => record.key)) })
  await processHrMessage(restarted.args)
  assert.equal(restarted.counts().sends, 0)
})

test('resume requests bypass the model entirely', async () => {
  const h = harness([message('请发一下简历')])
  await processHrMessage(h.args)
  assert.deepEqual(h.counts(), { generations: 0, sends: 1 })
  assert.equal(h.saved.at(-1).status, 'resume_sent')
})

test('new HR message or switched conversation invalidates a generated answer', async () => {
  const h = harness([message('你会什么技术？')], { isCurrent: async () => false })
  await processHrMessage(h.args)
  assert.equal(h.saved.at(-1).status, 'superseded')
  assert.equal(h.counts().sends, 0)
})

test('model failure, missing information and unacknowledged website send are recorded without fallback messages', async () => {
  for (const [override, expected] of [
    [{ generate: async () => { throw new Error('模型不可用') } }, 'failed'],
    [{ generate: async () => ({ action: 'manual', reason: '资料未提供到岗日期' }) }, 'manual'],
    [{ send: async () => { throw new Error('网站未确认') } }, 'uncertain']
  ]) {
    const h = harness([message('什么时候到岗？')], override)
    await processHrMessage(h.args)
    await processHrMessage(h.args)
    assert.equal(h.saved.at(-1).status, expected)
    assert.equal(h.saved.length, 2)
  }
})

test('failed persistence blocks sending and separate jobs do not share an action key', async () => {
  const h = harness([message('你好')], { save: async () => { throw new Error('磁盘不可写') } })
  await assert.rejects(processHrMessage(h.args), /磁盘不可写/)
  assert.deepEqual(h.counts(), { generations: 0, sends: 0 })
  const a = harness([message('你好')])
  await processHrMessage(a.args)
  await processHrMessage({ ...a.args, friend: { ...friend, encryptJobId: 'job2' } })
  assert.equal(a.counts().sends, 2)
})

test('polite words do not mask an actual resume request; completed delivery remains non-actionable', () => {
 for(const text of ['您好，麻烦您发送一份简历，谢谢～','谢谢，方便发份简历吗？','好的，请提供一下简历'])assert.equal(requestsResume(text),true,text)
 for(const text of ['谢谢，简历已收到','感谢你提供简历','感谢投递简历','不需要发简历，谢谢'])assert.equal(requestsResume(text),false,text)
})

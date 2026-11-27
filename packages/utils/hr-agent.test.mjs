import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { runHrAgent } from './hr-agent.mjs'
import { saveHrScreeningSnapshot, saveHrJobSnapshot } from './hr-context-store.mjs'
import { processHrMessage } from './hr-auto-reply.mjs'
import { fakePage, fakeBinding } from './fixtures/hr-chat-page.mjs'
import { readHrConversation, sendHrText, sendBossResume, isCurrentHrConversation } from './hr-auto-reply-browser.mjs'

const friend = { encryptBossId: 'boss', encryptJobId: 'job' }
const message = (mid, text, isSelf = false) => ({ mid, text, isSelf, messageType: 'text' })
const response = (tool, text = '测试回复') => ({ choices: [{ message: { content: JSON.stringify({ tool, text }) } }] })
async function setup(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ggr-pi-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  return { directory, friend, history: [message('m1', '介绍一下你的经验')], config: { personalProfile: 'FAKE_PROFILE Python后端', resumeText: 'FAKE_RESUME Agent评测', autoSendResume: true, resumeBinding: fakeBinding() }, isCurrent: async () => true, send: async () => ({ status: 'replied' }), complete: async () => response('reply') }
}

test('granular sources keep user data, JD, basic facts and scoring separate', async t => {
  const args = await setup(t)
  await saveHrScreeningSnapshot(args.directory, 'job', { resume: 'OLD_RESUME', preferences: 'OLD_PREFS', job: { postDescription: 'OLD_SELECTED_JD' } }, { score: 88, reason: 'MATCH_REASON' })
  await saveHrJobSnapshot(args.directory, 'job', { jobName: 'FULL_JOB_NAME', postDescription: 'FULL_DETAIL_JD', salaryDesc: '300元/天', degreeName: '本科' })
  args.config.preferences = 'CURRENT_PREFS'
  args.config.learnedPreferences = 'FEEDBACK_PREFS'
  args.config.inputSources = { personalProfile: false, resumeText: false, preferences: true, learnedPreferences: true, jobName: true, postDescription: false, jobBasics: true, matchingResult: true, screening: false }
  args.complete = async messages => {
    const text = JSON.stringify(messages)
    for (const wanted of ['CURRENT_PREFS', 'FEEDBACK_PREFS', 'FULL_JOB_NAME', '300元/天', 'MATCH_REASON']) assert.ok(text.includes(wanted), wanted)
    for (const unwanted of ['FAKE_PROFILE', 'FAKE_RESUME', 'OLD_RESUME', 'OLD_PREFS', 'FULL_DETAIL_JD', 'OLD_SELECTED_JD']) assert.ok(!text.includes(unwanted), unwanted)
    return response('manual', '测试')
  }
  await runHrAgent(args)
})

test('history can be disabled without dropping initial data or leaking old chat; source changes reset context', async t => {
  const args = await setup(t)
  args.config.inputSources = { history: false }
  args.history = [message('old', 'OLD_CHAT'), message('m1', 'QUESTION_1')]
  let last
  args.complete = async messages => { last = JSON.stringify(messages); return response('manual', '测试') }
  await runHrAgent(args)
  assert.ok(!last.includes('OLD_CHAT'))
  args.history.push(message('m2', 'QUESTION_2'))
  await runHrAgent(args)
  assert.ok(last.includes('FAKE_PROFILE'))
  assert.ok(last.includes('QUESTION_2'))
  assert.ok(!last.includes('QUESTION_1'))
  args.config.inputSources = { history: false, personalProfile: false, resumeText: false }
  args.history.push(message('m3', 'QUESTION_3'))
  await runHrAgent(args)
  assert.ok(!last.includes('FAKE_PROFILE') && !last.includes('FAKE_RESUME'))
  assert.ok((await fs.readdir(path.join(args.directory, 'hr-agent-sessions'))).some(name => name.endsWith('.archive')))
})

test('real Pi Agent persists first selected inputs and restores context without injecting them again', async t => {
  const args = await setup(t), inputs = []
  await saveHrScreeningSnapshot(args.directory, 'job', { preferences: 'FAKE_ORIGINAL', job: { postDescription: 'FAKE_JD' } }, { match: true, score: 85 })
  args.config.inputSources = { screening: true, postDescription: true, matchingResult: true }
  args.complete = async input => { inputs.push(input); return response('reply') }
  assert.equal((await runHrAgent(args)).status, 'replied')
  assert.match(JSON.stringify(inputs[0]), /FAKE_PROFILE/)
  assert.match(JSON.stringify(inputs[0]), /FAKE_RESUME/)
  assert.match(JSON.stringify(inputs[0]), /FAKE_ORIGINAL/)
  assert.match(JSON.stringify(inputs[0]), /FAKE_JD/)
  args.config.personalProfile = 'NEW_PROFILE_SHOULD_NOT_REPEAT'
  args.history.push(message('m2', '收到', true), message('m3', '还有哪些技能'))
  assert.equal((await runHrAgent(args)).status, 'replied')
  const last = JSON.parse(JSON.parse(inputs[1].at(-1).content).content[0].text)
  assert.equal('initialData' in last, false)
  assert.deepEqual(last.chat.map(item => item.mid), ['m2', 'm3'])
  assert.match(JSON.stringify(inputs[1]), /FAKE_PROFILE/)
  assert.doesNotMatch(JSON.stringify(inputs[1]), /NEW_PROFILE/)
  assert.equal(inputs[1].filter(item => item.content.includes('FAKE_PROFILE')).length, 1)
  assert.ok(inputs[1].some(item => item.content.includes('toolResult')))
})

test('unchecked inputs are absent, and jobs and HRs have isolated sessions', async t => {
  const args = await setup(t), inputs = []
  args.config.inputSources = { personalProfile: false, resumeText: false, screening: false }
  args.complete = async input => { inputs.push(input); return response('manual', '资料不足') }
  await runHrAgent(args)
  assert.doesNotMatch(JSON.stringify(inputs), /FAKE_PROFILE|FAKE_RESUME/)
  args.friend = { ...friend, encryptJobId: 'other-job' }
  await runHrAgent(args)
  args.friend = { ...friend, encryptBossId: 'other-boss' }
  await runHrAgent(args)
  assert.equal((await fs.readdir(path.join(args.directory, 'hr-agent-sessions'))).length, 3)
  assert.ok(inputs.every(input => input.length === 2))
})

test('first reply can recover the original screening payload and JD without another matching call', async t => {
  const args = await setup(t)
  await saveHrScreeningSnapshot(args.directory, friend.encryptJobId, { preferences: '假偏好', job: { postDescription: '假JD：搭建评测平台' } }, { match: true, score: 88 })
  args.config.inputSources = { personalProfile: false, resumeText: false, screening: true, postDescription: true, matchingResult: true }
  args.complete = async input => {
    const text = JSON.stringify(input)
    assert.match(text, /假偏好/)
    assert.match(text, /搭建评测平台/)
    assert.match(text, /88/)
    assert.doesNotMatch(text, /FAKE_PROFILE|FAKE_RESUME/)
    return response('manual', '等待人工')
  }
  await runHrAgent(args)
})

test('agent cannot send unrequested, disabled, unbound, negative or external resume requests', async t => {
  for (const [text, config] of [ ['介绍一下你的经验', {}], ['请发简历', { autoSendResume: false }], ['请发简历', { resumeBinding: null }], ['不要发简历', {}], ['请发简历到hr@example.com', {}] ]) {
    const args = await setup(t)
    const sent = []
    args.send = async action => { sent.push(action); return { status: 'resume_sent' } }
    args.history = [message('m1', text)]
    Object.assign(args.config, config)
    args.complete = async () => response('resume', '尝试发送')
    const result = await runHrAgent(args)
    assert.equal(result.status, 'manual')
    assert.equal(sent.length, 0)
    assert.ok(result.reason)
  }
})

test('invalid model responses and damaged sessions never send; self-last never invokes model', async t => {
  const args = await setup(t)
  const sent = []
  args.send = async action => { sent.push(action); return { status: 'replied' } }
  args.complete = async () => ({ choices: [{ message: { content: '{"tool":"bash","text":"run"}' } }] })
  await assert.rejects(runHrAgent(args), /格式无效/)
  assert.equal(sent.length, 0)
  const folder = path.join(args.directory, 'hr-agent-sessions')
  await fs.writeFile(path.join(folder, (await fs.readdir(folder))[0]), '{broken')
  await assert.rejects(runHrAgent(args))
  assert.equal(sent.length, 0)
  args.history = [message('self', '你好', true)]
  args.complete = async () => { throw new Error('不能调用模型') }
  assert.equal((await runHrAgent(args)).status, 'superseded')
})

for (const invitation of [false, true]) test(`Pi chooses bound resume tool for ${invitation ? 'invitation' : 'text request'} through mock native BOSS`, async t => {
  const args = await setup(t), { page, state } = fakePage({ invitation })
  if (!invitation) state.messages = [message('m1', '请发一下简历')]
  args.history = (await readHrConversation(page)).messages
  args.complete = async () => response('resume', 'HR明确索要简历')
  args.isCurrent = () => isCurrentHrConversation(page, args.friend, args.history.at(-1).mid)
  args.send = plan => sendBossResume(page, args.friend, args.history.at(-1).mid, { invitation: plan.invitation, binding: args.config.resumeBinding })
  const result = await runHrAgent(args)
  assert.ok(['resume_sent', 'resume_requested'].includes(result.status), JSON.stringify(result))
  assert.ok(state.clicks.includes(invitation ? 'accept-resume' : 'resume-toolbar'))
})

test('Pi text reply uses the existing native send tool', async t => {
  const args = await setup(t), { page, state } = fakePage()
  state.messages = args.history
  args.send = plan => sendHrText(page, args.friend, 'm1', plan.text)
  assert.equal((await runHrAgent(args)).status, 'replied')
  assert.ok(state.clicks.includes('text-send'))
})

test('tools reject unrequested resume, disabled delivery, changed conversation and invalid model output', async t => {
  const args = await setup(t)
  let sends = 0
  args.send = async () => { sends++; return { status: 'replied' } }
  args.complete = async () => response('resume')
  assert.equal((await runHrAgent(args)).status, 'manual')
  args.history = [message('m2', '请发一下简历')]
  args.config.autoSendResume = false
  assert.equal((await runHrAgent(args)).status, 'manual')
  args.config.autoSendResume = true
  args.isCurrent = async () => false
  assert.equal((await runHrAgent(args)).status, 'superseded')
  args.complete = async () => ({ choices: [{ message: { content: 'invalid' } }] })
  await assert.rejects(runHrAgent(args))
  assert.equal(sends, 0)
})

test('durable record deduplication wraps Pi and never replays an uncertain send', async t => {
  const args = await setup(t), records = new Set(), saved = []
  let sends = 0, models = 0
  args.complete = async () => { models++; return response('reply') }
  args.send = async () => { sends++; throw new Error('mock timeout') }
  const processArgs = { ...args, records, save: async record => { saved.push(record); return record }, runAgent: () => runHrAgent(args) }
  assert.equal((await processHrMessage(processArgs)).status, 'uncertain')
  assert.equal(await processHrMessage(processArgs), null)
  assert.equal(sends, 1)
  assert.equal(models, 1)
  assert.equal(saved[0].status, 'processing')
  processArgs.history = [message('self', '你好', true)]
  assert.equal(await processHrMessage(processArgs), null)
  assert.equal(models, 1)
})

test('Agent can skip a polite closing without sending a message', async t => {
 const args = await setup(t)
 args.history = [message('closing', '好的，谢谢')]
 args.complete = async () => response('skip', '礼貌收尾，无需回复')
 let sends = 0
 args.send = async () => { sends++; return { status:'replied' } }
 assert.equal((await runHrAgent(args)).status, 'skipped')
 assert.equal(sends, 0)
})

test('Agent keeps concrete send errors and distinguishes no click from uncertain website result', async t => {
  for(const definitelyNotSent of [true,false]) {
    const args=await setup(t)
    args.send=async()=>{throw Object.assign(new Error('发送按钮不可用'),{definitelyNotSent})}
    const result=await runHrAgent(args)
    assert.equal(result.status,definitelyNotSent?'failed':'uncertain')
    assert.match(result.reason,/发送按钮不可用/)
    assert.equal(result.reply,'测试回复')
  }
})

test('one quiet-minute burst is passed together even when earlier history is disabled', async t => {
 const args=await setup(t)
 args.config.inputSources={history:false}
 args.history=[message('old','不应带入的旧聊天'),message('start','什么时候到岗'),message('next','每周能来几天'),message('last','能做多久')]
 args.batchStartMid='start'
 args.complete=async messages=>{
  const text=JSON.stringify(messages)
  for(const fragment of ['什么时候到岗','每周能来几天','能做多久'])assert.ok(text.includes(fragment))
  assert.ok(!text.includes('不应带入的旧聊天'))
  return response('reply','我按资料统一回答到岗、出勤与时长。')
 }
 let sends=0
 args.send=async()=>{sends++;return {status:'replied'}}
 const result=await runHrAgent(args)
 assert.equal(result.status,'replied')
 assert.equal(sends,1)
})

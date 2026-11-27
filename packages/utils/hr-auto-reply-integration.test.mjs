import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { processHrMessage, parseHrReply } from './hr-auto-reply.mjs'
import { readHrConversation, isCurrentHrConversation, sendHrText, sendBossResume } from './hr-auto-reply-browser.mjs'
import { fakePage, fakeBinding } from './fixtures/hr-chat-page.mjs'

const friend = { encryptBossId: 'boss', encryptJobId: 'job', brandName: '模拟公司', name: '模拟HR' }
const profile = '模拟个人资料：计算机硕士在读，使用Python做Agent评测、Go/Gin做后端鉴权。'
const textMessage = (mid, text, isSelf = false) => ({ mid, text, isSelf, messageType: 'text', templateId: 1, status: isSelf ? 2 : 0 })

async function runScenario(t, options = {}) {
  const { page, state } = fakePage(options)
  if (options.history) state.messages = structuredClone(options.history)
  const history = (await readHrConversation(page)).messages
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ggr-hr-test-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const file = path.join(directory, 'records.jsonl')
  const inputs = [], records = new Set()
  const config = { personalProfile: profile, autoSendResume: true, resumeBinding: fakeBinding(), ...options.config }
  const args = {
    friend, history, config, records,
    save: async record => { await fs.appendFile(file, `${JSON.stringify(record)}\n`); return record },
    generate: async messages => {
      inputs.push(structuredClone(messages))
      return parseHrReply(await (options.complete || (async () => '{"action":"reply","text":"我使用Python做Agent评测，也有Go/Gin后端实践。"}'))(messages, state))
    },
    isCurrent: () => isCurrentHrConversation(page, friend, history.at(-1)?.mid),
    send: plan => plan.action === 'resume'
      ? sendBossResume(page, friend, history.at(-1)?.mid, { invitation: plan.invitation, binding: config.resumeBinding })
      : sendHrText(page, friend, history.at(-1)?.mid, plan.text)
  }
  const result = await processHrMessage(args)
  return { state, result, inputs, args, readRecords: async () => (await fs.readFile(file, 'utf8')).trim().split('\n').map(line => JSON.parse(line)) }
}

test('HR question goes through context, model parsing, native text action and durable result', async t => {
  const history = Array.from({ length: 12 }, (_, index) => textMessage(`m${index}`, index === 11 ? '请介绍Agent和后端能力' : `上下文${index}`, index % 2 === 0))
  history.splice(7, 0, { ...textMessage('system', '系统通知'), templateId: 3 })
  const scenario = await runScenario(t, { history })
  assert.equal(scenario.result.status, 'replied')
  assert.deepEqual(scenario.state.clicks, ['text-send'])
  assert.equal(scenario.inputs.length, 1)
  const [system, ...recent] = scenario.inputs[0]
  assert.ok(system.content.endsWith(profile))
  assert.deepEqual(recent, history.filter(message => message.templateId !== 3).slice(-8).map(message => ({ role: message.isSelf ? 'assistant' : 'user', content: message.text })))
  assert.equal(recent.length, 8)
  assert.deepEqual((await scenario.readRecords()).map(record => record.status), ['processing', 'replied'])
  await processHrMessage(scenario.args)
  assert.deepEqual(scenario.state.clicks, ['text-send'])
})

test('resume invitation and text request complete immediate, confirmation and attachment-choice paths without AI', async t => {
  for (const invitation of [true, false]) {
    for (const resumeFlow of ['immediate', 'confirm', 'chooser']) {
      const scenario = await runScenario(t, { invitation, resumeFlow })
      assert.equal(scenario.result.status, invitation ? 'resume_sent' : 'resume_requested')
      assert.equal(scenario.inputs.length, 0)
      assert.equal(scenario.state.clicks[0], invitation ? 'accept-resume' : 'resume-toolbar')
      assert.equal(scenario.state.clicks.filter(click => click === 'resume-confirm').length, 1)
      await processHrMessage(scenario.args)
      assert.equal(scenario.state.clicks.filter(click => click === 'resume-confirm').length, 1)
      assert.equal((await scenario.readRecords()).at(-1).status, scenario.result.status)
    }
  }
})

test('text resume request selects the named resume and never the portfolio', async t => {
  const scenario = await runScenario(t, {
    resumes: [{ resumeId: 'old', showName: '旧简历.pdf' }, { resumeId: 'target', showName: 'Agent简历.pdf' }, { resumeId: 'portfolio', showName: '作品集.pdf', annexType: 1 }],
    config: { resumeBinding: fakeBinding({ resumeId: 'target', showName: 'Agent简历.pdf' }) }
  })
  assert.equal(scenario.result.status, 'resume_requested')
  assert.deepEqual(scenario.state.clicks, ['resume-toolbar', 'choose:Agent简历.pdf', 'resume-confirm'])
  assert.equal(scenario.inputs.length, 0)
})

test('insufficient personal information stays manual; no model answer or outgoing message is fabricated', async t => {
  const scenario = await runScenario(t, {
    history: [textMessage('hr', '下周能到岗吗？')],
    complete: async messages => {
      assert.ok(messages[0].content.endsWith(profile))
      return '{"action":"manual","reason":"个人资料未提供到岗时间"}'
    }
  })
  assert.equal(scenario.result.status, 'manual')
  assert.match(scenario.result.reason, /未提供到岗时间/)
  assert.deepEqual(scenario.state.clicks, [])
})

test('a newer HR message invalidates the old generated answer before sending', async t => {
  const scenario = await runScenario(t, {
    history: [textMessage('hr', '你会什么语言？')],
    complete: async (_messages, state) => {
      state.messages.push(textMessage('new-hr', '先不用回复，稍后再说。'))
      return '{"action":"reply","text":"我会Python。"}'
    }
  })
  assert.equal(scenario.result.status, 'superseded')
  assert.deepEqual(scenario.state.clicks, [])
})

test('incoming message during typing cancels the unsent draft and never clicks send', async t => {
  const scenario = await runScenario(t, {
    history: [textMessage('hr', '你会什么语言？')],
    onType: state => state.messages.push(textMessage('new-hr', '稍等。'))
  })
  assert.equal(scenario.result.status, 'superseded')
  assert.deepEqual(scenario.state.clicks, [])
  assert.equal(scenario.state.typed, '')
})

test('unacknowledged resume sends are uncertain and do not retry or claim success', async t => {
  for (const invitation of [true, false]) {
    const scenario = await runScenario(t, { invitation, ack: false })
    assert.equal(scenario.result.status, 'uncertain')
    assert.equal(scenario.inputs.length, 0)
    await processHrMessage(scenario.args)
    assert.equal(scenario.state.clicks.filter(click => click === 'resume-confirm').length, 1)
    assert.equal((await scenario.readRecords()).at(-1).status, 'uncertain')
  }
})

test('self-last conversation does not enter AI or follow-up sending', async t => {
  const scenario = await runScenario(t, { history: [textMessage('self', '您好，期待回复', true)] })
  assert.equal(scenario.result, null)
  assert.equal(scenario.inputs.length, 0)
  assert.deepEqual(scenario.state.clicks, [])
})

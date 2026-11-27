import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { hrReplyPlan, requestsContact, parseHrReply, processHrMessage } from './hr-auto-reply.mjs'
import { runHrAgent } from './hr-agent.mjs'
import { readHrConversation, isCurrentHrConversation, exchangeBossWechat, exchangeBossPhone } from './hr-auto-reply-browser.mjs'
import { fakePage } from './fixtures/hr-chat-page.mjs'

const friend = { encryptBossId: 'boss', encryptJobId: 'job' }
const config = { autoExchangeWechat: true, autoExchangePhone: true }
const message = text => ({ mid: 'hr', isSelf: false, messageType: 'text', text })
const native = { wechat: exchangeBossWechat, phone: exchangeBossPhone }

test('explicit contact requests and exact invitation types are independently gated', () => {
  for (const [action, text, type, key] of [['wechat','方便加一下微信吗',1,'autoExchangeWechat'],['phone','请给我留个电话号码',11,'autoExchangePhone']]) {
    assert.equal(requestsContact(text, action), true)
    assert.deepEqual(hrReplyPlan([message(text)], config), { action, invitation: false })
    const invitation = { ...message(''), messageType: 'dialog', dialog: { type, operated: false } }
    assert.deepEqual(hrReplyPlan([invitation], config), { action, invitation: true })
    assert.equal(hrReplyPlan([invitation], { ...config, [key]: false }).action, 'manual')
    invitation.dialog.operated = true
    assert.equal(hrReplyPlan([invitation], config).action, 'manual')
  }
  for (const text of ['不要加微信','不用留电话号码','方便电话面试吗','联系方式是什么','我用微信开发小程序','请把简历发到微信','请通过https://example.com提交电话']) {
    assert.equal(requestsContact(text, 'wechat') || requestsContact(text, 'phone'), false, text)
  }
  assert.equal(hrReplyPlan([{ ...message('请加微信'), isSelf: true }], config).action, 'skip')
  assert.equal(parseHrReply('{"action":"reply","text":"我的手机号是13800000000"}').action, 'manual')
})

for (const action of ['wechat','phone']) {
  for (const invitation of [false,true]) test(`${action}: ${invitation ? 'accept invitation' : 'request via toolbar'} runs Pi and native flow once`, async t => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ggr-contact-'))
    t.after(() => fs.rm(directory, { recursive: true, force: true }))
    const { page, state } = fakePage({ contact: action, invitation })
    const history = (await readHrConversation(page)).messages
    const saved = [], records = new Set()
    const args = { friend, history, config, records, save: async record => { saved.push(record); return record },
      runAgent: args => runHrAgent({ ...args, directory, complete: async messages => {
        assert.ok(messages[0].content.includes('requestFacts.allowedAction'))
        const input = JSON.parse(JSON.parse(messages.at(-1).content).content[0].text)
        assert.equal(input.requestFacts.allowedAction, action)
        return { choices: [{ message: { content: JSON.stringify({ tool: action, text: 'HR明确请求交换' }) } }] }
      } }),
      isCurrent: () => isCurrentHrConversation(page, friend, 'hr'),
      send: plan => native[action](page, friend, 'hr', plan)
    }
    const result = await processHrMessage(args)
    assert.equal(result.status, `${action}_${invitation ? 'exchanged' : 'requested'}`, result.reason)
    assert.deepEqual(state.clicks, [invitation ? `accept-${action}` : `${action}-toolbar`, `${action}-confirm`])
    assert.equal(await processHrMessage(args), null)
    assert.deepEqual(saved.map(item => item.status), ['processing',result.status])
  })

  test(`${action}: pending, unavailable and wrong-card requests do not click`, async () => {
    const pending = fakePage({ contact: action }); pending.state[action === 'phone' ? 'requestPhone' : 'requestWeiXin'] = true
    await assert.rejects(native[action](pending.page, friend, 'hr', { invitation: false }), /等待确认/)
    assert.deepEqual(pending.state.clicks, [])
    const unavailable = fakePage({ contact: action, contactAvailable: false })
    await assert.rejects(native[action](unavailable.page, friend, 'hr', { invitation: false }), /未找到可用/)
    assert.deepEqual(unavailable.state.clicks, [])
    const wrong = fakePage({ contact: action, invitation: true }); wrong.state.messages[0].dialog.type = 17
    await assert.rejects(native[action](wrong.page, friend, 'hr', { invitation: true }), /未明确请求/)
    assert.deepEqual(wrong.state.clicks, [])
  })

  test(`${action}: website immediate confirmation does not trigger a second action`, async () => {
    for (const invitation of [false,true]) {
      const {page,state} = fakePage({contact:action,invitation,contactFlow:'immediate'})
      assert.equal((await native[action](page,friend,'hr',{invitation})).status, `${action}_${invitation ? 'exchanged' : 'requested'}`)
      assert.equal(state.clicks.filter(item => item === `${action}-confirm`).length, 1)
    }
  })

  test(`${action}: new message before confirmation cancels; missing acknowledgment is never success`, async () => {
    const changed = fakePage({ contact: action, onContactOpen: state => state.messages.push({ ...message('等等'), mid: 'new' }) })
    await assert.rejects(native[action](changed.page, friend, 'hr', { invitation: false }), /收到新消息/)
    assert.equal(changed.state.clicks.includes(`${action}-confirm`), false)
    const noAck = fakePage({ contact: action, ack: false })
    await assert.rejects(native[action](noAck.page, friend, 'hr', { invitation: false }), /确认超时/)
    assert.equal(noAck.state.clicks.filter(item => item === `${action}-confirm`).length, 1)
  })
}

test('unset WeChat never invents an account or changes BOSS profile', async () => {
  for (const invitation of [false,true]) {
    const { page, state } = fakePage({ contact: 'wechat', contactNeedsAccount: true, invitation })
    await assert.rejects(exchangeBossWechat(page, friend, 'hr', { invitation }), /尚未配置可用微信号/)
    assert.deepEqual(state.clicks, [invitation ? 'accept-wechat' : 'wechat-toolbar'])
  }
})

test('Agent cannot use an unrequested or disabled tool, or swap the requested contact type', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ggr-contact-guard-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  for (const [history, settings, tool] of [[[message('你好')],config,'phone'],[[message('请加微信')],config,'phone'],[[message('请加微信')],{},'wechat']]) {
    let sends = 0
    const result = await runHrAgent({ directory, friend, history, config: settings, isCurrent: async () => true,
      complete: async () => ({ choices:[{ message:{ content:JSON.stringify({tool,text:'测试'}) } }] }), send: async () => { sends++; return {status:'replied'} } })
    assert.equal(sends,0)
    assert.equal(result.status,'manual')
  }
})

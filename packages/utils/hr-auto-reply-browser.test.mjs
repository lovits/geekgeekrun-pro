import test from 'node:test'
import assert from 'node:assert/strict'
import { fakePage, fakeBinding } from './fixtures/hr-chat-page.mjs'
import { sendBossResume, sendHrText } from './hr-auto-reply-browser.mjs'

const friend = { encryptBossId: 'boss', encryptJobId: 'job' }

test('native invitation and text request follow different BOSS UI entries and require acknowledgment', async () => {
  for (const invitation of [true, false]) {
    const { page, state } = fakePage({ invitation })
    const result = await sendBossResume(page, friend, 'hr', { invitation, binding: fakeBinding() })
    assert.equal(result.status, invitation ? 'resume_sent' : 'resume_requested')
    assert.deepEqual(state.clicks, [invitation ? 'accept-resume' : 'resume-toolbar', 'choose:简历.pdf', 'resume-confirm'])
  }
})

test('multiple attachments, changed conversation and existing resume request do not send blindly', async () => {
  const many = fakePage({ resumes: [{ showName: 'a' }, { showName: 'b' }] })
  await assert.rejects(sendBossResume(many.page, friend, 'hr', { invitation: false, binding: fakeBinding() }), /不可用/)
  assert.equal(many.state.clicks.includes('resume-confirm'), false)
  const switched = fakePage(); switched.state.friend.encryptJobId = 'other'
  await assert.rejects(sendBossResume(switched.page, friend, 'hr', { invitation: false, binding: fakeBinding() }), /会话已变化/)
  assert.deepEqual(switched.state.clicks, [])
  const existing = fakePage(); existing.state.requestResume = true
  await assert.rejects(sendBossResume(existing.page, friend, 'hr', { invitation: false, binding: fakeBinding() }), /已有简历/)
  assert.deepEqual(existing.state.clicks, [])
  const interview = fakePage({ invitation: true, binding: fakeBinding() }); interview.state.messages[0].dialog.type = 17
  await assert.rejects(sendBossResume(interview.page, friend, 'hr', { invitation: true, binding: fakeBinding() }), /不是待接受的简历/)
  assert.deepEqual(interview.state.clicks, [])
})

test('text delivery checks drafts, newly created outgoing message and website acknowledgment', async () => {
  const normal = fakePage()
  assert.equal((await sendHrText(normal.page, friend, 'hr', '我会Python。')).status, 'replied')
  const draft = fakePage({ draft: '用户的草稿' })
  await assert.rejects(sendHrText(draft.page, friend, 'hr', '我会Python。'), /已有草稿/)
  assert.deepEqual(draft.state.clicks, [])
  const noAck = fakePage({ ack: false })
  noAck.state.messages.unshift({ mid: 'old', isSelf: true, text: '我会Python。', status: 2 })
  await assert.rejects(sendHrText(noAck.page, friend, 'hr', '我会Python。'), /确认超时/)
})

test('changed BOSS attachment and missing binding block all resume actions', async () => {
  for (const invitation of [true, false]) {
    const changed = fakePage({ invitation, resumes: [{ resumeId: 'r', showName: '简历.pdf', uploadTime: '2026-11-23' }] })
    await assert.rejects(sendBossResume(changed.page, friend, 'hr', { invitation, binding: fakeBinding() }), /已更新/)
    assert.deepEqual(changed.state.clicks, [])
    const missing = fakePage({ invitation })
    await assert.rejects(sendBossResume(missing.page, friend, 'hr', { invitation, binding: null }), /先将本地简历/)
    assert.deepEqual(missing.state.clicks, [])
  }
})

test('text delivery waits for the button before clicking and classifies pre-click failures', async () => {
  const {page,state}=fakePage()
  const wait=page.waitForFunction,handle=page.evaluateHandle
  let ready=false
  page.waitForFunction=async(fn,options,...args)=>{if(options.timeout===5000)ready=true;return wait(fn,options,...args)}
  page.evaluateHandle=async(fn,...args)=>{if(String(args[0]).includes('.btn-send'))assert.equal(ready,true);return handle(fn,...args)}
  assert.equal((await sendHrText(page,friend,'hr','你好')).status,'replied')
  assert.equal(state.clicks.filter(x=>x==='text-send').length,1)
  const unavailable=fakePage()
  unavailable.page.waitForFunction=async()=>{throw new Error('mock timeout')}
  await assert.rejects(sendHrText(unavailable.page,friend,'hr','你好'),e=>e.definitelyNotSent===true && /尚未点击/.test(e.message))
  assert.deepEqual(unavailable.state.clicks,[])
  const unconfirmed=fakePage({ack:false})
  await assert.rejects(sendHrText(unconfirmed.page,friend,'hr','你好'),e=>e.definitelyNotSent===false)
  assert.equal(unconfirmed.state.clicks.filter(x=>x==='text-send').length,1)
})

test('new HR message while waiting for send button cancels only the generated draft', async () => {
  const {page,state}=fakePage(),wait=page.waitForFunction
  page.waitForFunction=async(fn,options,...args)=>{if(options.timeout===5000)state.messages.push({mid:'new',isSelf:false,messageType:'text',text:'还想问一下薪资'});return wait(fn,options,...args)}
  const result=await sendHrText(page,friend,'hr','旧问题的回答')
  assert.equal(result.status,'superseded')
  assert.equal(state.typed,'')
  assert.deepEqual(state.clicks,[])
})

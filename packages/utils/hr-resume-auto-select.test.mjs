import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { bindSameNamedBossResume } from './hr-auto-reply.mjs'
import { runHrAgent } from './hr-agent.mjs'
import { readBossResumes, readHrConversation, sendBossResume, isCurrentHrConversation } from './hr-auto-reply-browser.mjs'
import { fakePage } from './fixtures/hr-chat-page.mjs'

const local = { resumeFileId: 'current.pdf', resumeFileName: '我的简历.pdf', resumeSha256: 'a'.repeat(64) }
const resume = { resumeId: 'chosen', showName: '我的简历.pdf', uploadTime: '2026-11-23', resumeSize: 100 }
test('selects the exact file name, not the first attachment; no match or ambiguous match blocks delivery', () => {
  const binding = bindSameNamedBossResume(local, [{ ...resume, resumeId: 'other', showName: '别人的简历.pdf' }, resume])
  assert.equal(binding.bossResumeId, 'chosen')
  assert.equal(bindSameNamedBossResume({ ...local, resumeBinding: binding }, [resume, { ...resume, resumeId: 'duplicate' }]).bossResumeId, 'chosen')
  assert.throws(() => bindSameNamedBossResume(local, []), /没有.*同名/)
  assert.throws(() => bindSameNamedBossResume(local, [resume, { ...resume, resumeId: 'duplicate' }]), /多个同名/)
  for (const extra of [{ restricted: true }, { annexType: 1 }, { uploadTime: '' }]) assert.throws(() => bindSameNamedBossResume(local, [{ ...resume, ...extra }]))
  assert.throws(() => bindSameNamedBossResume({ ...local, resumeFileId: '' }, [resume]), /PDF不可用/)
  assert.throws(() => bindSameNamedBossResume({ ...local, resumeBinding: binding }, [{ ...resume, uploadTime: 'changed' }]), /已更新/)
})

for (const invitation of [false, true]) test(`auto selection -> actual Pi -> mock BOSS ${invitation ? 'invitation' : 'text request'} uses the matching attachment`, async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ggr-auto-resume-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const { page, state } = fakePage({ invitation, resumes: [{ ...resume, resumeId: 'wrong', showName: '旧简历.pdf' }, resume] })
  if (!invitation) state.messages[0].text = '请发一下简历'
  const history = (await readHrConversation(page)).messages
  const config = { ...local, personalProfile: '模拟个人资料', autoSendResume: true, resumeBinding: bindSameNamedBossResume(local, await readBossResumes(page)) }
  const friend = { encryptBossId: 'boss', encryptJobId: 'job' }
  const result = await runHrAgent({ directory, friend, history, config,
    complete: async messages => {
      const payload = JSON.parse(JSON.parse(messages.at(-1).content).content[0].text)
      assert.equal(payload.requestFacts.resumeSendingAllowed, true)
      assert.equal(payload.requestFacts.resumeInvitation, invitation)
      return { choices: [{ message: { content: '{"tool":"resume","text":"HR索要当前简历"}' } }] }
    },
    isCurrent: () => isCurrentHrConversation(page, friend, history.at(-1).mid),
    send: plan => sendBossResume(page, friend, history.at(-1).mid, { invitation: plan.invitation, binding: config.resumeBinding })
  })
  assert.equal(result.status, invitation ? 'resume_sent' : 'resume_requested')
  assert.ok(state.clicks.includes('choose:我的简历.pdf'))
  assert.ok(!state.clicks.includes('choose:旧简历.pdf'))
})

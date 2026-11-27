import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canStartChat, installChatRequestGuard } from './chat-eligibility.mjs'

const candidate = {
  expectedJobId: 'job-1',
  jobInfo: { encryptId: 'job-1', jobName: 'Agent开发实习生', postDescription: '负责Agent工具调用与后端API开发' },
  selectedJob: { encryptJobId: 'job-1', jobName: 'Agent开发实习生', brandName: '目标公司' },
  companies: ['目标公司'], blockedCompanyPattern: '排除公司',
  patterns: { jobName: '^(?!.*产品).*Agent开发.*实习', postDescription: '后端.*开发' }
}

test('network boundary blocks a queued greeting when the allowed time window ends', async () => {
  let allowed=true, listener, outcome
  const page={setRequestInterception:async()=>{},on:(_,fn)=>{listener=fn}}
  const guard=await installChatRequestGuard(page,{canSendNow:()=>allowed})
  guard.approve('job-1')
  const request=()=>({isInterceptResolutionHandled:()=>false,url:()=> 'https://www.zhipin.com/wapi/zpgeek/friend/add.json?jobId=job-1',abort:async()=>{outcome='blocked'},continue:async()=>{outcome='allowed'}})
  listener(request());assert.equal(outcome,'allowed')
  allowed=false;listener(request());assert.equal(outcome,'blocked')
})

test('final chat check requires the same job, matching company, title and duties', () => {
  assert.equal(canStartChat(candidate), true)
  assert.equal(canStartChat({ ...candidate, selectedJob: { ...candidate.selectedJob, encryptJobId: 'other' } }), false)
  assert.equal(canStartChat({ ...candidate, jobInfo: { ...candidate.jobInfo, jobName: 'Agent产品实习生' } }), false)
  assert.equal(canStartChat({ ...candidate, selectedJob: { ...candidate.selectedJob, brandName: '其他公司' } }), false)
  assert.equal(canStartChat({ ...candidate, jobInfo: { ...candidate.jobInfo, postDescription: '产品调研与竞品分析报告' } }), false)
  assert.equal(canStartChat({ ...candidate, patterns: { jobName: '[' } }), false)
})

test('outgoing chat requests require an approved matching job ID', async () => {
  let listener
  const page = { setRequestInterception: async () => {}, on: (_, handler) => { listener = handler } }
  const guard = await installChatRequestGuard(page)
  const dispatch = jobId => {
    let outcome
    listener({
      isInterceptResolutionHandled: () => false,
      url: () => 'https://www.zhipin.com/wapi/zpgeek/friend/add.json?jobId=' + jobId,
      abort: async () => { outcome = 'blocked' },
      continue: async () => { outcome = 'allowed' }
    })
    return outcome
  }
  assert.equal(dispatch('job-1'), 'blocked')
  guard.approve('job-1')
  assert.equal(dispatch('job-1'), 'allowed')
  assert.equal(dispatch('other'), 'blocked')
  guard.clear()
  assert.equal(dispatch('job-1'), 'blocked')
})

test('online simulation permits unsuitable feedback but still blocks greetings, messages and resume upload', async () => {
  let listener
  const page = { setRequestInterception: async () => {}, on: (_, fn) => { listener = fn } }
  const guard = await installChatRequestGuard(page, { simulation: true })
  guard.approve('job-1')
  function dispatch(path, method = 'GET') {
    let result
    listener({ isInterceptResolutionHandled: () => false, url: () => 'https://www.zhipin.com' + path, method: () => method, abort: async () => { result = 'blocked' }, continue: async () => { result = 'allowed' } })
    return result
  }
  assert.equal(dispatch('/wapi/zpgeek/friend/add.json?jobId=job-1'), 'blocked')
  assert.equal(dispatch('/wapi/zpgeek/negativefeedback/save.json', 'POST'), 'allowed')
  assert.equal(dispatch('/wapi/zpgeek/negativefeedback/save.json/other', 'POST'), 'blocked')
  assert.equal(dispatch('/wapi/zpchat/send.json', 'POST'), 'blocked')
  assert.equal(dispatch('/wapi/zpgeek/resume/upload.json', 'POST'), 'blocked')
  assert.equal(dispatch('/wapi/zpgeek/search/joblist.json'), 'allowed')
  assert.equal(dispatch('/wapi/zpgeek/job/detail.json'), 'allowed')
})

test('final check honors any/all while company blocks and job identity always remain mandatory', () => {
  const partial = { ...candidate, patterns: { jobName: 'Agent', postDescription: '客服' } }
  assert.equal(canStartChat({ ...partial, matchLogic: 1 }), false)
  assert.equal(canStartChat({ ...partial, matchLogic: 2 }), true)
  assert.equal(canStartChat({ ...partial, matchLogic: 2, blockedCompanyPattern: '目标公司' }), false)
  assert.equal(canStartChat({ ...partial, matchLogic: 2, expectedJobId: 'changed' }), false)
  assert.equal(canStartChat({ ...partial, matchLogic: 2, companies: ['其他公司'] }), false)
  assert.equal(canStartChat({ ...partial, matchLogic: 2, patterns: {} }), true)
})

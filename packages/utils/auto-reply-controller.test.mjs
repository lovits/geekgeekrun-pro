import test from 'node:test'
import assert from 'node:assert/strict'
import { createAutoReplyController, canSendFollowup } from './auto-reply-controller.mjs'

test('HR runs independently while follow-up follows the real chat lifecycle, including changes during a run', async () => {
  let list=[], enabled={hr:false,followup:false};const actions=[]
  const tick=createAutoReplyController({workers:async()=>list,flags:async()=>enabled,start:async workerId=>{actions.push(['start',workerId]);list.push({workerId})},stop:async workerId=>{actions.push(['stop',workerId]);list=list.filter(w=>w.workerId!==workerId)}})
  enabled.hr=true;await tick();assert.deepEqual(actions,[['start','hrAutoReplyMain']])
  list.push({workerId:'geekAutoStartWithBossMain',pid:1,args:['--run-record-id=1']});await tick();assert.deepEqual(actions,[['start','hrAutoReplyMain']])
  enabled.followup=true;await tick();assert.deepEqual(actions.at(-1),['start','readNoReplyAutoReminderMain'])
  enabled.hr=false;await tick();assert.deepEqual(actions.at(-1),['stop','hrAutoReplyMain']);assert.ok(list.some(w=>w.workerId==='readNoReplyAutoReminderMain'))
  enabled.hr=true;await tick();assert.deepEqual(actions.at(-1),['start','hrAutoReplyMain'])
  list=list.filter(w=>w.workerId!=='geekAutoStartWithBossMain');await tick();assert.deepEqual(list.map(w=>w.workerId),['hrAutoReplyMain']);assert.deepEqual(enabled,{hr:true,followup:true})
  list.push({workerId:'geekAutoStartWithBossMain',pid:2,args:['--run-record-id=2']});await tick();assert.equal(list.length,3)
})

test('simulation never starts replies and failed starts do not retry endlessly', async () => {
  let list=[{workerId:'geekAutoStartWithBossMain',pid:1,args:['--simulation-limit=50']}],count=0
  const tick=createAutoReplyController({workers:async()=>list,flags:async()=>({followup:true}),start:async()=>{count++;throw new Error('fake failure')},stop:async()=>{}})
  await tick();assert.equal(count,0)
  list[0].args=[];await assert.rejects(tick(),/fake failure/);await tick();assert.equal(count,1)
})

test('follow-up refuses disabled switches and newly arrived HR messages', () => {
  assert.equal(canSendFollowup({enabled:false},{isSelf:true}),false)
  assert.equal(canSendFollowup({enabled:true},{isSelf:false}),false)
  assert.equal(canSendFollowup({enabled:true},{isSelf:true}),true)
  assert.equal(canSendFollowup({},null),false)
})

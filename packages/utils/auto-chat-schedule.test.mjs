import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultAutoChatSchedule, validateAutoChatSchedule, autoChatWindow, assertAutoChatTime, waitAndCheckAutoChatTime, createAutoChatScheduler } from './auto-chat-schedule.mjs'
import { createSuccessfulChatRest } from './successful-chat-rest.mjs'

const config = () => ({ ...structuredClone(defaultAutoChatSchedule), enabled: true })
const time = (hour, minute = 0, day = 23) => new Date(2026, 10, day, hour, minute)

test('Monday-Friday and both daily windows include starts and exclude ends, lunch and weekends', () => {
  const c = config()
  for (const day of [23, 24, 25, 26, 27]) {
    for (const [hour, minute, expected] of [[8,59,false],[9,0,true],[11,59,true],[12,0,false],[13,59,false],[14,0,true],[17,59,true],[18,0,false]]) assert.equal(Boolean(autoChatWindow(c,time(hour,minute,day))),expected,`${day} ${hour}:${minute}`)
  }
  for (const day of [28,29]) assert.equal(autoChatWindow(c,time(10,0,day)),null)
  assert.notEqual(autoChatWindow(c,time(10)),autoChatWindow(c,time(15)))
  assert.notEqual(autoChatWindow(c,time(10)),autoChatWindow(c,time(10,0,24)))
})

test('custom weekdays, custom windows and one disabled period work; invalid settings cannot be saved', () => {
  const c = config(); c.weekdays=[6]; c.morning={enabled:true,start:'10:30',end:'11:15'};c.afternoon.enabled=false
  assert.ok(autoChatWindow(c,time(10,30,28)))
  assert.equal(autoChatWindow(c,time(11,15,28)),null)
  assert.equal(autoChatWindow(c,time(15,0,28)),null)
  for (const patch of [{weekdays:[]},{weekdays:[7]},{morning:{enabled:true,start:'25:00',end:'26:00'}},{morning:{enabled:true,start:'12:00',end:'09:00'}},{morning:{enabled:true,start:'11:00',end:'15:00'}},{morning:{enabled:false,start:'09:00',end:'12:00'},afternoon:{enabled:false,start:'14:00',end:'18:00'}}]) assert.throws(()=>validateAutoChatSchedule({...config(),...patch}))
})

test('rest crossing the end of a window blocks continuation; disabled schedule preserves manual behavior', async () => {
  let now=time(11,59), checked=false
  const check=()=>{checked=true;assertAutoChatTime(config(),now)}
  await assert.rejects(waitAndCheckAutoChatTime(120000,async()=>{now=time(12,1)},check),{code:'AUTO_CHAT_SCHEDULE_CLOSED'})
  assert.equal(checked,true)
  const successRest=createSuccessfulChatRest(ms=>waitAndCheckAutoChatTime(ms,async()=>{now=time(18)},check))
  now=time(17,59)
  await assert.rejects(successRest('fake-job',{successfulChatRestEnabled:true,successfulChatRestEvery:1,successfulChatRestMinutes:1}),{code:'AUTO_CHAT_SCHEDULE_CLOSED'})
  assert.doesNotThrow(()=>assertAutoChatTime(defaultAutoChatSchedule,time(23)))
  assert.throws(()=>assertAutoChatTime(defaultAutoChatSchedule,time(10),{scheduled:true}))
  assert.throws(()=>assertAutoChatTime(config(),time(10),{pausedWindow:autoChatWindow(config(),time(10))}))
})

function harness() {
  const h={ config:config(), state:{}, now:time(8,59), list:[], pause:'', events:[] }
  h.tick=createAutoChatScheduler({ readConfig:()=>h.config,readState:()=>h.state,writeState:async state=>{h.state=state},pausedWindow:()=>h.pause, workers:async()=>h.list,now:()=>h.now,
    start:async()=>{h.events.push('start');if (h.failStart) throw new Error('mock login expired');h.list=[{workerId:'geekAutoStartWithBossMain'}]},stop:async()=>{h.events.push('stop');h.list=[]} })
  return h
}
test('controller starts once in the morning, stops at lunch, resumes in afternoon, stops at end', async () => {
  const h=harness();await h.tick();assert.deepEqual(h.events,[])
  h.now=time(9);await h.tick();await h.tick();assert.deepEqual(h.events,['start'])
  h.now=time(12);await h.tick();assert.deepEqual(h.events,['start','stop'])
  h.now=time(14);await h.tick();assert.deepEqual(h.events,['start','stop','start'])
  h.now=time(18);await h.tick();assert.deepEqual(h.events,['start','stop','start','stop'])
  h.now=time(10,0,28);await h.tick();assert.equal(h.events.length,4)
})
test('manual stop, failed startup and simultaneous ticks do not repeatedly relaunch in the same window', async () => {
  const h=harness();h.now=time(10);await Promise.all([h.tick(),h.tick(),h.tick()]);assert.deepEqual(h.events,['start'])
  h.list=[];await h.tick();assert.deepEqual(h.events,['start'])
  h.now=time(15);h.pause=autoChatWindow(h.config,h.now);await h.tick();assert.equal(h.events.length,1)
  h.now=time(10,0,24);await h.tick();assert.deepEqual(h.events,['start','start'])
  const failed=harness();failed.failStart=true;failed.now=time(10);await failed.tick();await failed.tick();assert.deepEqual(failed.events,['start']);assert.equal(failed.state.status,'启动失败')
})
test('turning the service off stops owned work, simulation blocks automatic startup and sleep has no catch-up', async () => {
  const h=harness();h.now=time(10);h.list=[{workerId:'geekSimulateApplications'}];await h.tick();assert.deepEqual(h.events,[])
  h.list=[];h.now=time(20);await h.tick();assert.deepEqual(h.events,[])
  h.now=time(10,0,24);await h.tick();h.config.enabled=false;await h.tick();assert.deepEqual(h.events,['start','stop'])
})

import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { createHrReplyPolling, watchHrMessages, snapshotMatchesDueMessage } from './hr-reply-polling.mjs'
import { hrReplyIsDue } from './hr-auto-reply.mjs'

const friend = (mid, extra = {}) => ({ encryptBossId:'hr', encryptJobId:'job', lastMsgId:mid, lastIsSelf:false, ...extra })
test('idle full scans every five minutes; reply observes five minutes then returns to idle without sending', () => {
 const p=createHrReplyPolling();assert.equal(p.shouldScan(0),true);assert.equal(p.shouldScan(299999),false);assert.equal(p.shouldScan(300000),true)
 p.replied(300001);assert.equal(p.shouldScan(305001),true);assert.equal(p.shouldScan(305002),false)
 assert.equal(p.shouldScan(600001),true);assert.equal(p.shouldScan(899999),false);assert.equal(p.shouldScan(900001),true)
})
test('HR burst resets sixty-second quiet timer and does not block another HR', () => {
 const p=createHrReplyPolling(),pending=new Map();
 const add=(item,now)=>{for(const changed of p.observe([item],now))hrReplyIsDue(changed,pending,60,now)}
 add(friend('a',{unreadCount:1}),0);add(friend('b'),40000);add(friend('c'),80000)
 assert.equal(hrReplyIsDue({...friend('c'),lastMessageId:'c'},pending,60,139999),false)
 assert.equal(hrReplyIsDue({...friend('c'),lastMessageId:'c'},pending,60,140000),true)
 const other={...friend('other'),encryptBossId:'other',lastMessageId:'other'}
 assert.equal(hrReplyIsDue(other,pending,60,90000),false)
 assert.equal(hrReplyIsDue(other,pending,60,150000),true)
})
test('website notifications deliver new IDs without a full idle scan; failed watcher uses fallback', async () => {
 const chat={list:[friend('one')],$watch:(read,callback)=>{chat.read=read;chat.callback=callback}}
 let receive;const received=[]
 const page={exposeFunction:async(name,fn)=>{assert.equal(name,'__ggrHrMessagesChanged');receive=fn},evaluate:async(fn)=>vm.runInNewContext(`(${fn})()`,{document:{querySelector:()=>({__vue__:chat})},window:{__ggrHrMessagesChanged:items=>Promise.resolve(receive(items))}})}
 assert.equal(await watchHrMessages(page,items=>received.push(items)),true)
 chat.list=[friend('two')];chat.callback();assert.equal(received[0][0].lastMsgId,'two')
 delete chat.$watch;assert.equal(await watchHrMessages(page,()=>{}),false)
})
test('custom idle and observation durations control polling', () => {
 const options={idleMinutes:2,observeMinutes:1}, p=createHrReplyPolling(options)
 assert.equal(p.shouldScan(0),true); assert.equal(p.shouldScan(119999),false); assert.equal(p.shouldScan(120000),true)
 p.replied(120001); assert.equal(p.shouldScan(125001),true)
 assert.equal(p.shouldScan(180001),true); assert.equal(p.shouldScan(300000),false); assert.equal(p.shouldScan(300001),true)
})

test('observation scan interval follows the configured seconds', () => {
 const options={idleMinutes:5,observeMinutes:2,observeIntervalSeconds:12}, p=createHrReplyPolling(options)
 assert.equal(p.shouldScan(0),true)
 p.replied(1000)
 assert.equal(p.shouldScan(12999),false)
 assert.equal(p.shouldScan(13000),true)
 assert.equal(p.shouldScan(24999),false)
 assert.equal(p.shouldScan(25000),true)
})

test('zero observation duration does not schedule an observation scan', () => {
 const p=createHrReplyPolling({idleMinutes:5,observeMinutes:0,observeIntervalSeconds:5})
 assert.equal(p.shouldScan(0),true)
 p.observe([friend('one',{unreadCount:1})],1000)
 p.replied(2000)
 assert.equal(p.shouldScan(7000),false)
 assert.equal(p.shouldScan(300000),true)
})

test('changing observation duration to zero cancels an active observation scan', () => {
 const options={idleMinutes:5,observeMinutes:1,observeIntervalSeconds:5}, p=createHrReplyPolling(options)
 assert.equal(p.shouldScan(0),true)
 p.replied(1000)
 options.observeMinutes=0
 assert.equal(p.shouldScan(6000),false)
 assert.equal(p.shouldScan(300000),true)
})

test('new messages detected after selection must not use the old waiting period', () => {
 const selected = { lastMessageId: 'old' }, pending = new Map()
 assert.equal(snapshotMatchesDueMessage(selected, { mid: 'new', isSelf: false }), false)
 assert.equal(snapshotMatchesDueMessage(selected, { mid: 'old', isSelf: true }), false)
 assert.equal(snapshotMatchesDueMessage(selected, { mid: 'old', isSelf: false }), true)
 const item = { encryptBossId: 'hr', encryptJobId: 'job', lastMessageId: 'new', lastIsSelf: false }
 assert.equal(hrReplyIsDue(item, pending, 60, 1000), false)
 assert.equal(hrReplyIsDue(item, pending, 60, 60999), false)
 assert.equal(hrReplyIsDue(item, pending, 60, 61000), true)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeHrFriend, hrReplyIsDue } from './hr-auto-reply.mjs'
test('actual BOSS lastMsgId supports selection and delay reset without changing original friend', () => {
 const source={encryptBossId:'b',encryptJobId:'j',lastMsgId:123,lastIsSelf:false},pending=new Map()
 const friend=normalizeHrFriend(source)
 assert.equal(friend.lastMessageId,123)
 assert.equal(source.lastMessageId,undefined)
 assert.equal(hrReplyIsDue(friend,pending,30,0),false)
 assert.equal(hrReplyIsDue(friend,pending,30,30000),true)
 assert.equal(hrReplyIsDue(normalizeHrFriend({...source,lastMsgId:124}),pending,30,30000),false)
 assert.equal(normalizeHrFriend({...source,lastMessageId:125}).lastMessageId,125)
})

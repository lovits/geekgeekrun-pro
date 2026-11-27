import test from 'node:test'
import assert from 'node:assert/strict'
import { bossNonReplyTemplates, bossTemplateSkipReason } from './boss-chat-templates.mjs'
import { processHrMessage } from './hr-auto-reply.mjs'
const m=(text,mid='hr')=>({text,mid,isSelf:false,messageType:'text'})

test('recognized BOSS-style status and closing examples skip with punctuation variants', () => {
 for(const group of bossNonReplyTemplates)for(const text of group.examples)assert.ok(bossTemplateSkipReason([m(text+'～！')]),text)
 assert.ok(bossTemplateSkipReason([m('[祈祷]不好意思，不太合适哦')]))
})
test('questions, new opportunities and tools are never dropped just for resembling a template', () => {
 for(const text of ['好的，什么时候能到岗？','谢谢，方便发份简历吗？','您与当前岗位暂不匹配，但另一个岗位可以考虑吗？','当前岗位关闭了，可以加微信联系吗？','开场问题，期待你的回答','你是否认为岗位不匹配？'])assert.equal(bossTemplateSkipReason([m(text)]),'',text)
 assert.equal(bossTemplateSkipReason([m('什么时候可以到岗','a'),m('谢谢','b')]),'')
 assert.equal(bossTemplateSkipReason([{...m('旧问题'),isSelf:true},m('收到')]).length>0,true)
 assert.equal(bossTemplateSkipReason([{...m(''),messageType:'dialog',dialog:{type:2,operated:false}}]),'')
})
test('pure rejection records skipped without a model call or any outbound action; dedup persists', async () => {
 let models=0,sends=0;const saved=[],args={friend:{encryptBossId:'boss',encryptJobId:'job'},history:[m('您与当前岗位暂不匹配')],config:{},records:new Set(),save:async row=>{saved.push(row);return row},runAgent:async()=>{models++},send:async()=>{sends++}}
 const result=await processHrMessage(args)
 assert.equal(result.status,'skipped');assert.equal(models,0);assert.equal(sends,0)
 assert.deepEqual(saved.map(x=>x.status),['processing','skipped'])
 assert.equal(await processHrMessage(args),null)
})

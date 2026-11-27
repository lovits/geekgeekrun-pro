import test from 'node:test'
import assert from 'node:assert/strict'
import { createSuccessfulChatRest, normalizeChatRestConfig } from './successful-chat-rest.mjs'

test('rest modes are exclusive and the inactive pause is always zero', () => {
  const both = { isSageTimeEnabled: true, sageTimePauseMinute: 15, sageTimeOpTimes: 100, successfulChatRestEnabled: true, successfulChatRestEvery: 50, successfulChatRestMinutes: 5 }
  const success = normalizeChatRestConfig(both)
  assert.equal(success.successfulChatRestEnabled, true)
  assert.equal(success.successfulChatRestMinutes, 5)
  assert.equal(success.isSageTimeEnabled, false)
  assert.equal(success.sageTimePauseMinute, 0)
  assert.equal(success.sageTimeOpTimes, 100)
  const operations = normalizeChatRestConfig({ ...both, successfulChatRestEnabled: false })
  assert.equal(operations.isSageTimeEnabled, true)
  assert.equal(operations.sageTimePauseMinute, 15)
  assert.equal(operations.successfulChatRestEnabled, false)
  assert.equal(operations.successfulChatRestMinutes, 0)
  const disabled = normalizeChatRestConfig({ ...both, isSageTimeEnabled: false, successfulChatRestEnabled: false })
  assert.equal(disabled.sageTimePauseMinute, 0)
  assert.equal(disabled.successfulChatRestMinutes, 0)
  assert.deepEqual(normalizeChatRestConfig(success), success)
})

const config = { successfulChatRestEnabled: true, successfulChatRestEvery: 2, successfulChatRestMinutes: 0.5 }
test('rests exactly at the success threshold, ignores duplicate confirmations and repeats after resetting', async () => {
  const waits = [], events = []
  const record = createSuccessfulChatRest(async ms => waits.push(ms))
  const hooks = { sageTimeEnter: { promise: async event => events.push(['enter', event.recordedOpCount]) }, sageTimeExit: { promise: async () => events.push(['exit']) } }
  await record('a', config, hooks)
  await record('a', config, hooks)
  assert.deepEqual(waits, [])
  await record('b', config, hooks)
  assert.deepEqual(waits, [30000])
  await record('c', config, hooks)
  await record('d', config, hooks)
  assert.deepEqual(waits, [30000, 30000])
  assert.deepEqual(events, [['enter', 2], ['exit'], ['enter', 2], ['exit']])
})

test('disabled settings and missing success identities do not rest; new tasks start at zero', async () => {
  const waits = [], record = createSuccessfulChatRest(async ms => waits.push(ms))
  await record('a', { ...config, successfulChatRestEnabled: false })
  await record('', config)
  await record('b', config)
  assert.deepEqual(waits, [])
  const newTask = createSuccessfulChatRest(async ms => waits.push(ms))
  await newTask('c', config)
  assert.deepEqual(waits, [])
  await newTask('d', config)
  assert.deepEqual(waits, [30000])
})

test('one success can trigger a rest; invalid thresholds and durations never schedule a wait', async () => {
  const waits = [], record = createSuccessfulChatRest(async ms => waits.push(ms))
  await record('one', { ...config, successfulChatRestEvery: 1 })
  assert.deepEqual(waits, [30000])
  for (const [index, bad] of [{ successfulChatRestEvery: 0 }, { successfulChatRestEvery: 1.5 }, { successfulChatRestMinutes: -1 }, { successfulChatRestMinutes: Infinity }].entries()) await record(`bad${index}`, { ...config, ...bad })
  assert.deepEqual(waits, [30000])
})

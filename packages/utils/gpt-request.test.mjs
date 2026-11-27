import test from 'node:test'
import assert from 'node:assert/strict'
import { completes, isOpenAiModernOrReasoningModel, buildOpenAiChatParams } from './gpt-request.mjs'

test('identifies modern OpenAI reasoning models vs classic chat models', () => {
  assert.equal(isOpenAiModernOrReasoningModel('gpt-6-luna'), true)
  assert.equal(isOpenAiModernOrReasoningModel('gpt-5.4'), true)
  assert.equal(isOpenAiModernOrReasoningModel('o3'), true)
  assert.equal(isOpenAiModernOrReasoningModel('gpt-4o-mini'), false)
  assert.equal(isOpenAiModernOrReasoningModel('deepseek-chat'), false)
})

test('builds max_completion_tokens without unsupported temperature for GPT-5/6 and o-series', () => {
  const modern = buildOpenAiChatParams({
    messages: [{ role: 'user', content: 'hi' }],
    model: 'gpt-6-luna',
    maxTokens: 200,
    reasoningEffort: 'low'
  })
  assert.equal(modern.max_completion_tokens, 1024)
  assert.equal(modern.reasoning_effort, 'low')
  assert.equal('max_tokens' in modern, false)
  assert.equal('temperature' in modern, false)

  const classic = buildOpenAiChatParams({
    messages: [{ role: 'user', content: 'hi' }],
    model: 'deepseek-chat',
    maxTokens: 200
  })
  assert.equal(classic.max_tokens, 200)
  assert.equal(classic.temperature, 0.1)
})

test('automatically retries with modern params if an endpoint rejects max_tokens or temperature with 400', async () => {
  const calls = []
  const result = await completes(
    {
      provider: 'openai',
      baseURL: 'https://example.com/v1',
      apiKey: 'sk-test',
      model: 'custom-reasoning-model',
      maxTokens: 300,
      clientFactory: () => ({
        chat: {
          completions: {
            create: async (params) => {
              calls.push(params)
              if ('max_tokens' in params) {
                const err = new Error("Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.")
                err.status = 400
                throw err
              }
              return { model: 'custom-reasoning-model', choices: [{ message: { content: '连接成功' } }] }
            }
          }
        }
      })
    },
    [{ role: 'user', content: 'ping' }]
  )
  assert.equal(calls.length, 2)
  assert.equal('max_tokens' in calls[0], true)
  assert.equal(calls[1].max_completion_tokens, 1024)
  assert.equal(result.choices[0].message.content, '连接成功')
})

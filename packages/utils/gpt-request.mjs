import { piCompletion } from './pi-request.mjs';
import { codexCompletion } from './codex-request.mjs';
import OpenAI from "openai";

export function isOpenAiModernOrReasoningModel(model = '') {
  return /^(o\d|gpt-[5-9]|gpt-\d{2})/i.test(String(model || '').trim());
}

export function buildOpenAiChatParams({ messages, model, maxTokens = 100, reasoningEffort, modern = isOpenAiModernOrReasoningModel(model) }) {
  if (modern) {
    const params = {
      messages,
      model,
      max_completion_tokens: Math.max(Number(maxTokens) || 100, 1024),
    };
    if (reasoningEffort && ['minimal', 'low', 'medium', 'high'].includes(reasoningEffort)) {
      params.reasoning_effort = reasoningEffort;
    }
    return params;
  }
  return {
    messages,
    model,
    frequency_penalty: 0,
    max_tokens: maxTokens,
    temperature: 0.1,
  };
}

export async function completes(
  {
    provider,
    codexDetectionMode,
    codexBinaryPath,
    piDetectionMode,
    piBinaryPath,
    baseURL,
    apiKey,
    model,
    reasoningEffort,
    contextWindowTokens,
    maxTokens = 100,
    clientFactory = (opts) => new OpenAI(opts),
  },
  messages
) {
  if (provider === 'pi-cli') return piCompletion(messages, model, { reasoningEffort, contextWindowTokens, piDetectionMode, piBinaryPath });
  if (provider === 'codex-cli') return codexCompletion(messages, model, { reasoningEffort, contextWindowTokens, codexDetectionMode, codexBinaryPath });
  const openai = clientFactory({
    baseURL: baseURL?.trim(),
    apiKey: apiKey?.trim(),
  });

  const modern = isOpenAiModernOrReasoningModel(model);
  let completion;
  try {
    completion = await openai.chat.completions.create(
      buildOpenAiChatParams({ messages, model, maxTokens, reasoningEffort, modern })
    );
  } catch (error) {
    const msg = String(error?.message || '');
    if (!modern && error?.status === 400 && /max_tokens|max_completion_tokens|temperature|frequency_penalty/i.test(msg)) {
      completion = await openai.chat.completions.create(
        buildOpenAiChatParams({ messages, model, maxTokens, reasoningEffort, modern: true })
      );
    } else if (modern && error?.status === 400 && /max_completion_tokens|reasoning_effort/i.test(msg)) {
      completion = await openai.chat.completions.create(
        buildOpenAiChatParams({ messages, model, maxTokens, modern: false })
      );
    } else {
      throw error;
    }
  }

  console.log(completion.choices?.[0]?.message?.content);
  return completion;
}

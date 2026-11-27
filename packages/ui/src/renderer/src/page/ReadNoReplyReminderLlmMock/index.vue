<template>
  <div class="h100vh flex flex-col">
    <div
      ref="scrollElRef"
      :style="{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        overflow: `auto`,
        margin: `0 auto`,
        alignItems: `flex-end`,
        width: '100%'
      }"
    >
      <div
        v-if="messageList.length"
        :style="{
          width: '480px',
          margin: '0 auto'
        }"
      >
        <div class="pb20px"></div>
        <div v-for="(item, index) in messageList" :key="index" flex flex-col flex-items-end>
          <div class="message-item-wrap flex flex-col">
            <template v-if="item.type === 'text'">
              <div
                class="message-item"
                :class="{
                  'will-enter-context': getIsEnterContent(index)
                }"
              >
                {{ item.text }}
              </div>
            </template>
            <template v-else>
              <div
                class="message-item image-message-item"
                :class="{
                  'will-enter-context': getIsEnterContent(index)
                }"
              >
                <img :src="item.imageUrl" alt="" />
              </div>
            </template>
            <!-- eslint-disable-next-line prettier/prettier -->
            <template v-if="(typeof item.usedLlmConfig !== 'string')">
              <div
                :style="{
                  width: 'fit-content',
                  alignSelf: 'flex-end'
                }"
                font-size-10px
              >
                {{ item.usedLlmConfig.model }}
              </div>
              <div
                v-if="item?.usedLlmConfig?.providerCompleteApiUrl?.trim()"
                :style="{
                  width: 'fit-content',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  alignSelf: 'flex-end',
                  color: 'var(--el-text-color-secondary)'
                }"
                font-size-10px
                w-fit-content
                max-w-20em
              >
                {{ item.usedLlmConfig.providerCompleteApiUrl }}
              </div>
            </template>
            <template v-else>
              <div
                :style="{
                  width: 'fit-content',
                  alignSelf: 'flex-end',
                  color: 'var(--el-text-color-secondary)'
                }"
                font-size-10px
              >
                {{ item.usedLlmConfig }}
              </div>
            </template>
          </div>
        </div>
        <div class="pb20px"></div>
      </div>
      <div v-else w-full h-full flex flex-item-center justify-center>
        <el-empty>
          <template #description>
            <template v-if="!isLoading">
              点击下方“<el-button
                font-size-15px
                h-fit-content
                align-baseline
                p0
                link
                type="primary"
                @click.prevent="sendLlmGeneratedContent"
                >生成开场白</el-button
              >”预览已读不回跟进效果
            </template>
            <template v-else>正在生成开场消息，请稍候…</template>
          </template>
        </el-empty>
      </div>
    </div>
    <div
      :style="{
        display: 'grid',
        gridTemplateColumns: 'min-content 1fr min-content',
        gap: '10px',
        alignItems: 'center',
        height: 'fit-content',
        padding: '10px 14px',
        backgroundColor: 'var(--el-bg-color)',
        borderTop: '1px solid var(--el-border-color-light)'
      }"
    >
      <el-select v-model="selectedLlmConfig" w180px placeholder="随机选用已启用模型">
        <el-option
          v-for="(it, index) in llmConfigListForRender"
          :key="index"
          :value="it.id"
          :label="it.model"
          :disabled="!it.enabled"
          :style="{
            paddingTop: '8px',
            paddingBottom: '8px',
            height: 'auto',
            lineHeight: '1.35'
          }"
        >
          <div
            :style="{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '12px'
            }"
          >
            <div>{{ it.model }}</div>
            <div style="font-size: 12px; color: var(--el-text-color-secondary)">
              {{ formatApiSecret(it.providerApiSecret) || '' }}
            </div>
          </div>
          <div
            v-if="it?.providerCompleteApiUrl?.trim?.()"
            :style="{
              color: 'var(--el-text-color-secondary)',
              maxWidth: '32em',
              fontSize: '12px',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }"
          >
            {{ it.providerCompleteApiUrl }}
          </div>
        </el-option>
      </el-select>
      <el-button
        :loading="isLoading"
        width-fit-content
        type="primary"
        @click="sendLlmGeneratedContent"
      >
        <template v-if="isLoading">正在生成消息，请稍候…</template>
        <template v-else-if="!messageList.length">生成开场白</template>
        <template v-else>生成下一条跟进消息</template>
      </el-button>
      <el-button @click="closeWindow">关闭窗口</el-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { sleep } from '@geekgeekrun/utils/sleep.mjs'
import { ElMessage } from 'element-plus'
import { gtagRenderer } from '@renderer/utils/gtag'
import {
  OPEN_CONTENT_SOURCE,
  RECHAT_CONTENT_SOURCE
} from '../../../../common/enums/auto-start-chat'
import { DEFAULT_CONSTANT_OPEN_CONTENT_SEGS } from '../../../../common/constant'
import lookForwardReplyEmotion from '../MainLayout/resources/look-forward-reply-emotion.gif'

type MessageItem = {
  text: string
  usedLlmConfig: string | { model: string; providerCompleteApiUrl: string }
  type: 'text'
  // recordInfo: any
}
type ImageMessageItem = Omit<MessageItem, 'type'> & {
  type: 'image'
  imageUrl: string
}
const messageList = ref<(MessageItem | ImageMessageItem)[]>([])
const searchParams = Object.fromEntries(new URL(location.href).searchParams)

const recentMessageQuantityForLlm = Number(searchParams.recentMessageQuantityForLlm) || 8
function getIsEnterContent(index) {
  return messageList.value.length - index - 1 < recentMessageQuantityForLlm
}

const llmConfigList = ref<{ id: string; model: string; providerCompleteApiUrl: string; providerApiSecret: string; enabled: boolean }[]>([])
const llmConfigListForRender = computed(() => {
  return [
    {
      id: null,
      model: '随机使用一个模型',
      providerCompleteApiUrl: '',
      providerApiSecret: '',
      enabled: true
    },
    ...(llmConfigList.value ?? [])
  ]
})
async function getLlmConfigList() {
  llmConfigList.value = await electron.ipcRenderer.invoke('get-llm-config-for-test')
}
getLlmConfigList().catch(() => {})
const selectedLlmConfig = ref<string | null>(null)
watch(
  () => selectedLlmConfig.value,
  () => {
    gtagRenderer('change_mock_chat_llm_model', {
      model: llmConfigList.value.find(item => item.id === selectedLlmConfig.value)?.model ?? ''
    })
  }
)

const scrollElRef = ref<HTMLDivElement>()
const isLoading = ref(false)
const openContentSource = Number(searchParams.openContentSource)
const constantOpenContent = (() => {
  if (searchParams.constantOpenContent?.trim()) {
    return searchParams.constantOpenContent.trim()
  }
  if (Number(searchParams.rechatContentSource) === RECHAT_CONTENT_SOURCE.GEMINI_WITH_CHAT_CONTEXT) {
    return DEFAULT_CONSTANT_OPEN_CONTENT_SEGS.join(`；`)
  } else {
    return DEFAULT_CONSTANT_OPEN_CONTENT_SEGS[0]
  }
})()
const rechatContentSource = Number(searchParams.rechatContentSource)

async function sendLlmGeneratedContent() {
  gtagRenderer('click_mock_chat_send')
  if (!(messageList.value ?? []).length) {
    // send open content
    if (openContentSource === OPEN_CONTENT_SOURCE.GEMINI_WITH_CHAT_CONTEXT) {
      isLoading.value = true
      try {
        const response = await electron.ipcRenderer.invoke('request-llm-for-test', {
          messageList: [],
          llmConfigIdForPick: selectedLlmConfig.value ? [selectedLlmConfig.value] : null
        })
        console.log(response)
        messageList.value.push({
          type: 'text',
          text: response.responseText,
          usedLlmConfig: response.usedLlmConfig
        })
        await sleep(50)
        ;(scrollElRef.value as any as HTMLDivElement)?.scrollTo({
          top: scrollElRef.value?.scrollHeight,
          behavior: 'smooth'
        })
      } catch (err) {
        ElMessage.error({
          dangerouslyUseHTMLString: true,
          grouping: true,
          message: `<div>本次测试所使用的模型不可用</div><div style="margin-top: 10px; white-space: nowrap;">建议在大语言模型配置中关闭相关模型</div>`
        })
      } finally {
        isLoading.value = false
      }
    } else {
      messageList.value.push({
        type: 'text',
        text: constantOpenContent,
        usedLlmConfig: '未使用大模型'
      })
    }
  } else {
    if (rechatContentSource === RECHAT_CONTENT_SOURCE.GEMINI_WITH_CHAT_CONTEXT) {
      isLoading.value = true
      try {
        const response = await electron.ipcRenderer.invoke('request-llm-for-test', {
          messageList: JSON.parse(JSON.stringify((messageList.value ?? []).slice(-8))),
          llmConfigIdForPick: selectedLlmConfig.value ? [selectedLlmConfig.value] : null
        })
        console.log(response)
        messageList.value.push({
          type: 'text',
          text: response.responseText,
          usedLlmConfig: response.usedLlmConfig
        })
        await sleep(50)
        ;(scrollElRef.value as any as HTMLDivElement)?.scrollTo({
          top: scrollElRef.value?.scrollHeight,
          behavior: 'smooth'
        })
      } catch (err) {
        ElMessage.error({
          dangerouslyUseHTMLString: true,
          grouping: true,
          message: `<div>本次测试所使用的模型不可用</div><div style="margin-top: 10px; white-space: nowrap;">建议在大语言模型配置中关闭相关模型</div>`
        })
      } finally {
        isLoading.value = false
      }
    } else {
      messageList.value.push({
        type: 'image',
        text: `[盼回复] 表情`,
        imageUrl: lookForwardReplyEmotion,
        usedLlmConfig: '未使用大模型'
      })
    }
  }
}

function closeWindow() {
  electron.ipcRenderer.send(`close-read-no-reply-reminder-llm-mock-window`)
}

function formatApiSecret(text) {
  if (typeof text !== 'string' || !text?.trim()) {
    return ''
  }
  if (text === 'ollama') {
    return text
  }
  if (text.length >= 8) {
    return `${text.slice(0, 4)}***${text.slice(-4)}`
  }
  return `***`
}

gtagRenderer('enter_mock_chat_page')
</script>

<style lang="scss" scoped>
.message-item-wrap {
  max-width: 420px;
  margin-top: 20px;
  .message-item {
    line-height: 1.5;
    font-size: 13.5px;
    background-color: var(--ggr-chat-bubble-bg);
    color: var(--ggr-chat-bubble-fg);
    padding: 10px 12px;
    border-radius: 10px 10px 2px 10px;
    &.will-enter-context {
      position: relative;
      &::before {
        content: '上下文范围内';
        display: flex;
        font-size: 10px;
        position: absolute;
        top: 100%;
        left: 0;
        background-color: var(--ggr-chat-badge-bg);
        color: var(--ggr-chat-badge-fg);
        line-height: 1;
        padding: 2px 5px;
        border-radius: 0 0 4px 4px;
      }
    }
  }
  .message-item.image-message-item {
    background-color: transparent;
    width: 128px;
    img {
      width: 100%;
    }
  }
}
</style>

<template>
  <div class="ggr-page auto-reply">
    <header class="ggr-page-header">
      <div>
        <h2 class="ggr-page-title">自动回复</h2>
        <p class="ggr-page-desc">独立响应 HR 新消息，或对已读不回的历史沟通进行礼貌跟进</p>
      </div>
    </header>
    <el-tabs v-model="activeTab" class="auto-reply-tabs">
      <el-tab-pane label="HR 消息自动回复" name="hr" lazy>
        <HrAutoReply embedded />
      </el-tab-pane>
      <el-tab-pane label="已读不回自动跟进" name="followup" lazy>
        <ReadNoReplyReminder embedded />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import HrAutoReply from './HrAutoReply.vue'
import ReadNoReplyReminder from './ReadNoReplyReminder.vue'

const route = useRoute()
const router = useRouter()
const activeTab = computed({
  get: () => (route.query.tab === 'followup' ? 'followup' : 'hr'),
  set: (tab) => {
    router.replace({ path: '/main-layout/AutoReply', query: { tab } })
  }
})
</script>

<style scoped>
.auto-reply {
  flex: 0 0 auto;
  align-self: stretch;
}
.auto-reply-tabs {
  margin-top: -4px;
}
</style>

<template>
  <div class="group-item">
    <div class="group-title">记录与数据</div>
    <div flex flex-col class="link-list">
      <RouterLink to="./ApplicationSimulation">
        <span>模拟开聊</span>
        <el-tooltip placement="right" :enterable="false">
          <template #content>
            <div style="max-width: 360px; line-height: 1.7">
              <div>模拟仅执行筛选与记录，不会发送任何沟通消息。「拟沟通」代表模拟匹配通过，「未沟通」代表条件不符，「已沟通」仅代表真实开聊任务已成功发出问候。</div>
              <div style="margin-top: 6px">支持「本地职位库重评」与「BOSS 在线模拟」两种方式，开启 AI 筛选后同时生成评分与理由。</div>
            </div>
          </template>
          <QuestionFilled class="nav-icon" aria-label="模拟开聊说明" />
        </el-tooltip>
      </RouterLink>
      <RouterLink to="./HrReplyRecords"><span>回复记录</span></RouterLink>
      <RouterLink to="./StartChatRecord"><span>开聊记录</span></RouterLink>
      <RouterLink to="./MarkAsNotSuitRecord"><span>不合适记录</span></RouterLink>
      <RouterLink to="./JobLibrary"><span>职位库</span></RouterLink>
      <RouterLink to="./BossLibrary"><span>BOSS 库</span></RouterLink>
      <RouterLink to="./CompanyLibrary"><span>公司库</span></RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { QuestionFilled } from '@element-plus/icons-vue'
</script>

<style scoped lang="scss" src="./style.scss"></style>
<style scoped>
.nav-icon {
  width: 13px;
  height: 13px;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}
</style>

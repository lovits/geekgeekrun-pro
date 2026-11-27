<template>
  <div class="group-item">
    <div class="group-title">求职沟通</div>
    <div flex flex-col class="link-list">
      <RouterLink to="./GeekAutoStartChatWithBoss">
        <span>自动开聊</span>
        <el-tooltip
          placement="right"
          :enterable="false"
          @show="gtagRenderer('tooltip_show_for_nav_boss_b_entry')"
        >
          <template #content>
            <div style="max-width: 380px; line-height: 1.7">
              <div style="font-weight: 600; margin-bottom: 6px">按你设置的筛选规则，自动向匹配的 BOSS 发起沟通</div>
              <ol m0 pl1.4em>
                <li>按来源与条件组合查找职位，自动点开查看详情</li>
                <li>检查 BOSS 活跃度与公司规则，跳过不活跃或屏蔽公司的岗位</li>
                <li>核对正则条件与 AI 匹配评分，通过后自动发起沟通；不匹配则按策略跳过或在平台标记“不合适”，促使平台补充新推荐</li>
              </ol>
              <div style="margin-top: 8px; opacity: 0.85">
                提示：当前条件查完会自动切换下一组条件；若当日沟通次数用尽，会自动暂停 60 分钟后再试。
              </div>
            </div>
          </template>
          <QuestionFilled class="nav-icon" />
        </el-tooltip>
      </RouterLink>
      <RouterLink to="./AutoReply"><span>自动回复</span></RouterLink>
      <a href="javascript:void(0)" @click="handleClickLaunchBossLogin">
        <span>登录账号管理</span><TopRight class="nav-icon" />
      </a>
      <a href="javascript:void(0)" @click="handleLaunchBossSite">
        <span>打开 BOSS 网页版</span><TopRight class="nav-icon" />
      </a>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { gtagRenderer } from '@renderer/utils/gtag'
import { debounce } from 'lodash'
import { ElMessage } from 'element-plus'
import { TopRight, QuestionFilled } from '@element-plus/icons-vue'

const handleClickLaunchBossLogin = async () => {
  gtagRenderer('launch_login_clicked')
  try {
    await electron.ipcRenderer.invoke('login-with-cookie-assistant')
    ElMessage({
      type: 'success',
      message: '登录状态已保存'
    })
  } catch {
    //
  }
}

const handleLaunchBossSite = debounce(
  async () => {
    gtagRenderer('launch_boss_site_clicked')
    return await electron.ipcRenderer.invoke('open-site-with-boss-cookie', {
      url: `https://www.zhipin.com/`
    })
  },
  1000,
  { leading: true, trailing: false }
)
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

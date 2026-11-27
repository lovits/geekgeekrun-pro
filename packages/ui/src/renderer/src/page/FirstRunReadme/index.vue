<template>
  <div ref="componentRootEl" class="first-run-readme">
    <div class="first-run-readme__inner-outer">
      <div class="first-run-readme__inner">
        <h2 class="readme-title">欢迎使用 Geek Geek Run-Pro</h2>
        <div class="readme-desc">
          使用前请逐条阅读以下须知，确认知悉并接受后勾选对应条目：
        </div>
        <article class="readme-article">
          <ElCheckboxGroup
            v-model="readmeItemCheckStatusList"
            @change="handleReadmeItemCheckStatusListChange"
          >
            <ElCheckbox :label="0" :class="[unreadItemsAfterClickSubmit[0] ? 'unread' : '']">
              本程序属于求职辅助工具，与<el-link
                type="primary"
                @click.stop.prevent="
                  () => {
                    electron.ipcRenderer.send(
                      'open-external-link',
                      'https://about.zhipin.com/agreement/'
                    )
                    gtagRenderer('view_boss_agreement_clicked')
                  }
                "
                >《BOSS直聘用户协议》</el-link
              >（2023年3月版）相关条款存在冲突；根据其中
              <i>七、用户的平台使用义务</i>、<i>八、违约责任</i>
              章节，若异常操作被平台风控识别，可能面临包括但不限于<b class="risk-em"
                >强制退出登录、限制功能或封禁账号</b
              >等风险。继续使用即代表<b class="risk-em">您知悉并自行承担上述风险与后果</b>。
            </ElCheckbox>
            <ElCheckbox :label="1" :class="[unreadItemsAfterClickSubmit[1] ? 'unread' : '']">
              本程序需要在本地保存您的登录凭证（Cookie）以访问 BOSS 直聘。Cookie 仅保存在您的设备本地并仅用于向 BOSS 直聘发起请求，<b
                class="risk-em"
                >不会上传或提供给任何第三方</b
              >；同时<b class="risk-em">请勿向他人泄露您的 Cookie</b>。
            </ElCheckbox>
            <ElCheckbox :label="2" :class="[unreadItemsAfterClickSubmit[2] ? 'unread' : '']">
              程序会尽量模拟真人浏览与沟通节奏，但无法完全消除平台风控风险。使用时请<b
                class="risk-em"
                >合理控制频率</b
              >，当日沟通额度用完后建议间隔数日再使用，或<b class="risk-em"
                >使用独立的求职账号</b
              >。
            </ElCheckbox>
            <ElCheckbox :label="3" :class="[unreadItemsAfterClickSubmit[3] ? 'unread' : '']">
              程序通过识别网页元素完成自动化操作；若 BOSS 直聘页面改版或命中灰度实验，可能导致脚本暂时失效（例如<b
                class="risk-em"
                >浏览器反复退出并重启</b
              >）。如遇异常，可通过左下角入口反馈。
            </ElCheckbox>
            <ElCheckbox :label="4" :class="[unreadItemsAfterClickSubmit[4] ? 'unread' : '']">
              公司配发的办公电脑或内网环境通常部署有上网行为审计系统（如奇安信、深信服、绿盟等），可能<b
                class="risk-em"
                >记录并审计您的网络与终端活动</b
              >。若不希望当前公司知晓您的求职动向，<b class="risk-em"
                >请勿在公司设备或公司网络下运行本程序</b
              >。
            </ElCheckbox>
            <ElCheckbox :label="5" :class="[unreadItemsAfterClickSubmit[5] ? 'unread' : '']">
              本程序尊重个人隐私，<b class="risk-em"
                >不会收集您的身份敏感信息，也不会向您的雇主或猎头泄露求职记录</b
              >。由于项目开源，第三方修改版可能存在安全隐患，<b class="risk-em"
                >请务必从可信渠道获取安装包</b
              >。
            </ElCheckbox>

            <ElCheckbox :label="6" :class="[unreadItemsAfterClickSubmit[6] ? 'unread' : '']">
              本程序<b class="risk-em">完全免费开源，无任何内置付费墙</b>。若您通过第三方渠道付费购买或被要求付费解锁，<b
                class="risk-em"
                >说明遇到了倒卖或篡改版本</b
              >，<b class="risk-em"
                >请直接向卖方维权并更换官方可信版本</b
              >。
            </ElCheckbox>
            <ElCheckbox :label="7" :class="[unreadItemsAfterClickSubmit[7] ? 'unread' : '']">
              本程序仅辅助提升沟通效率，<b class="risk-em">不对招聘信息真实性及求职结果负责</b
              >；请<b
                class="risk-em"
                >仔细甄别企业资质、谨慎参加面试与选择 Offer</b
              >。
            </ElCheckbox>
            <ElCheckbox :label="8" :class="[unreadItemsAfterClickSubmit[8] ? 'unread' : '']">
              使用前请先在 BOSS 直聘 App 内<b class="risk-em">屏蔽不希望投递的公司</b
              >；若需避免现雇主同事看到您的活跃状态，请提前<b
                class="risk-em"
                >在 BOSS 直聘隐私设置中屏蔽现公司及关联主体</b
              >。
            </ElCheckbox>
            <ElCheckbox :label="9" :class="[unreadItemsAfterClickSubmit[9] ? 'unread' : '']">
              软件虽经多轮测试，仍可能存在极端场景兼容问题；若对本地运行环境有顾虑，可在虚拟机中运行本程序。遇到任何异常欢迎随时反馈。
            </ElCheckbox>
          </ElCheckboxGroup>
        </article>
      </div>
    </div>
    <footer class="readme-footer">
      <div class="readme-footer__inner">
        <el-button @click="handleCancel">退出程序</el-button>
        <el-button type="primary" @click="handleSubmit"
          >我已阅读并同意以上须知，继续使用</el-button
        >
      </div>
    </footer>
  </div>
</template>

<script lang="ts" setup>
import { ElCheckbox, ElCheckboxGroup, ElMessage } from 'element-plus'
import { ref } from 'vue'
import { gtagRenderer as baseGtagRenderer } from '@renderer/utils/gtag'
import { sleep } from '@geekgeekrun/utils/sleep.mjs'

const gtagRenderer = (name, params?: object) => {
  return baseGtagRenderer(name, {
    scene: 'first-run-agreement',
    ...params
  })
}
const electron = window.electron

const readmeItemCheckStatusList = ref<number[]>([])

const handleCancel = async () => {
  gtagRenderer('cancel_clicked')
  await sleep(500)
  window.close()
}

const unreadItemsAfterClickSubmit = ref<Record<number, true>>({})
const handleSubmit = () => {
  gtagRenderer('submit_clicked')
  const COUNT = 10
  if (readmeItemCheckStatusList.value.length !== COUNT) {
    gtagRenderer('agreement_not_finish_read_tip_displayed')
    ElMessage.warning({
      message: `还有 ${COUNT - readmeItemCheckStatusList.value.length} 条须知未勾选，请阅读并勾选后再继续`,
      grouping: true
    })
    unreadItemsAfterClickSubmit.value = {}
    for (let i = 0; i < COUNT; i++) {
      if (!readmeItemCheckStatusList.value.includes(i)) {
        unreadItemsAfterClickSubmit.value[i] = true
      }
    }
    return
  }
  electron.ipcRenderer.send('first-launch-notice-approve')
  gtagRenderer('submit_done')
}
const handleReadmeItemCheckStatusListChange = (value: import('element-plus').CheckboxValueType[]) => {
  value.forEach((it) => {
    if (typeof it === 'number' && unreadItemsAfterClickSubmit.value[it]) {
      delete unreadItemsAfterClickSubmit.value[it]
    }
  })
}
const componentRootEl = ref<HTMLElement>()
</script>

<style lang="scss" scoped>
.first-run-readme {
  box-sizing: border-box;
  width: 100vw;
  height: 100vh;
  overflow: auto;
  user-select: none;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  .first-run-readme__inner-outer {
    flex: 1;
    overflow: auto;
  }
  .first-run-readme__inner {
    max-width: 880px;
    width: 100%;
    box-sizing: border-box;
    margin: 0 auto;
    padding: 28px 28px 32px;
    .readme-title {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }
    .readme-desc {
      margin-top: 8px;
      font-size: 13.5px;
      color: var(--el-text-color-secondary);
    }
    .risk-em {
      color: var(--el-color-danger);
      font-weight: 600;
    }
    .readme-article {
      margin-top: 14px;
      background: var(--el-bg-color);
      border: 1px solid var(--el-border-color-light);
      border-radius: 12px;
      padding: 16px 18px;
      :deep(.el-checkbox) {
        height: fit-content;
        align-items: flex-start;
        margin-right: 0;
        padding: 8px 10px;
        border-radius: 6px;
        border-left: 4px solid transparent;
        &.unread {
          border-left-color: var(--el-color-warning);
          background-color: var(--el-color-warning-light-9);
        }
        .el-checkbox__input {
          margin-top: 3px;
        }
        .el-checkbox__label {
          line-height: 1.65;
          white-space: normal;
          color: var(--el-text-color-regular);
        }
        & + .el-checkbox {
          margin-top: 6px;
        }
        &.is-checked .el-checkbox__label {
          color: var(--el-text-color-secondary);
          opacity: 0.72;
        }
      }
    }
  }
  .readme-footer {
    flex: 0;
    padding: 12px 28px;
    background-color: var(--el-bg-color);
    border-top: 1px solid var(--el-border-color-light);
  }
  .readme-footer__inner {
    max-width: 880px;
    margin: 0 auto;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }
}
</style>

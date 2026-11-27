<template>
  <div class="cookie-assistant-page">
    <header class="ggr-page-header" style="margin-bottom: 14px">
      <div>
        <h2 class="ggr-page-title">BOSS 登录助手</h2>
        <p class="ggr-page-desc">通过浏览器扫码登录自动获取凭证，或粘贴已导出的 Cookie</p>
      </div>
    </header>

    <el-alert v-if="cookieInvalid" type="warning" :closable="false" style="margin-bottom: 14px">
      当前尚未配置登录凭证，或原有登录状态已失效，请重新获取。
    </el-alert>

    <section class="ggr-card" style="padding: 16px 20px">
      <div class="guide-text">
        推荐按以下步骤自动获取登录凭证：
      </div>
      <ol class="guide-steps">
        <li>
          点击
          <el-button size="small" type="primary" @click="handleClickLaunchLogin"
            >启动浏览器登录</el-button
          >
        </li>
        <li>在打开的浏览器窗口中，通过 <b>扫码 / 短信验证码 / 微信小程序</b> 登录 BOSS 直聘账号</li>
        <li>登录成功后页面会自动跳转至首页，约 5～10 秒内凭证将自动填入下方输入框</li>
        <li>
          <details class="manual-details">
            <summary>已完成登录，但输入框仍为空？</summary>
            <div class="manual-help">
              <div>
                您也可以在已登录 BOSS 直聘的浏览器中使用
                <el-link type="primary" @click.prevent="handleEditThisCookieExtensionStoreLinkClick">
                  EditThisCookie 扩展
                </el-link>
                导出标准 JSON 数组格式的 Cookie 并粘贴到下方：
              </div>
              <figure>
                <figcaption>1. 点击浏览器右上角“扩展程序”图标并打开“EditThisCookie”</figcaption>
                <img block max-w-full src="./resources/copy-cookie-step-1.png" />
              </figure>
              <figure>
                <figcaption>2. 点击弹出框中的“Export（导出）”按钮后粘贴到下方输入框</figcaption>
                <img block max-w-full src="./resources/copy-cookie-step-2.png" />
              </figure>
            </div>
          </details>
        </li>
      </ol>
    </section>

    <el-form
      ref="formRef"
      inline-message
      :model="formContent"
      label-position="top"
      :rules="formRules"
      class="cookie-form"
    >
      <el-form-item prop="collectedCookies" label="登录凭证（JSON 数组格式）" mb-0>
        <el-input
          v-model="formContent.collectedCookies"
          class="ggr-mono"
          type="textarea"
          placeholder="点击上方“启动浏览器登录”自动填入，或直接粘贴 JSON 数组格式的 Cookie…"
          :autosize="{
            minRows: 9,
            maxRows: 9
          }"
          font-size-12px
          @input="hasUserMutateInput = true"
        ></el-input>
        <el-alert
          v-if="loginCookieWaitingStatus === LOGIN_COOKIE_WAITING_STATUS.WAITING_FOR_LOGIN"
          :closable="false"
          style="margin-top: 10px"
          >正在等待浏览器完成登录…</el-alert
        >
        <el-alert
          v-if="loginCookieWaitingStatus === LOGIN_COOKIE_WAITING_STATUS.COOKIE_COLLECTED"
          :closable="false"
          type="success"
          style="margin-top: 10px"
          >已成功获取登录凭证<template v-if="hasUserMutateInput"
            >；检测到输入框已有编辑内容，是否覆盖？<el-button
              size="small"
              type="primary"
              style="margin-left: 8px"
              @click="
                () => {
                  gtagRenderer('replace_inputted_cookie_by_collected')
                  fillCollectedCookie()
                }
              "
              >填入最新凭证</el-button
            ></template
          ></el-alert
        >
      </el-form-item>
    </el-form>
    <footer flex mt18px pb16px flex-justify-end gap-8px>
      <el-button @click="handleCancel">取消</el-button>
      <el-button type="primary" @click="handleSubmit">保存凭证</el-button>
    </footer>
  </div>
</template>

<script lang="ts" setup>
import { ElForm, ElMessage } from 'element-plus'
import { ref, onUnmounted, onMounted } from 'vue'
import { checkCookieListFormat } from '../../../../common/utils/cookie'
import { gtagRenderer as baseGtagRenderer } from '@renderer/utils/gtag'

const gtagRenderer = (name, params?: object) => {
  return baseGtagRenderer(name, {
    scene: 'cookie-assistant',
    ...params
  })
}
const cookieInvalid = ref(false)

enum LOGIN_COOKIE_WAITING_STATUS {
  INIT,
  WAITING_FOR_LOGIN,
  COOKIE_COLLECTED
}
const loginCookieWaitingStatus = ref(LOGIN_COOKIE_WAITING_STATUS.INIT)

const formRef = ref<InstanceType<typeof ElForm>>()
const formContent = ref({
  collectedCookies: ''
})

const formRules = {
  collectedCookies: [
    {
      required: true,
      message: '请输入Cookie'
    },
    {
      trigger: 'blur',
      validator(_rule, val, cb) {
        try {
          JSON.parse(val)
        } catch (err) {
          cb(
            new Error(
              `JSON格式无效 - 存在语法错误: ${err instanceof Error ? err.message : String(err)}；建议使用EditThisCookie扩展程序进行复制。`
            )
          )
          gtagRenderer('wrong_cookie_format_json_syntax_error')
          return
        }

        if (!checkCookieListFormat(JSON.parse(formContent.value.collectedCookies))) {
          cb(new Error(`Cookie格式无效 - 部分字段缺失；建议使用EditThisCookie扩展程序进行复制。`))
          gtagRenderer('wrong_cookie_format_field_loss')
          return
        }
        cb()
      }
    }
  ]
}

const hasUserMutateInput = ref(false)
const collectedCookie = ref()
const handleCookieCollected = (_, payload) => {
  loginCookieWaitingStatus.value = LOGIN_COOKIE_WAITING_STATUS.COOKIE_COLLECTED
  collectedCookie.value = payload.cookies
  if (!hasUserMutateInput.value) {
    fillCollectedCookie()
    gtagRenderer('cookie_collected_and_auto_filled')
  } else {
    gtagRenderer('cookie_collected_after_changed_input')
  }
}
const fillCollectedCookie = () => {
  if (loginCookieWaitingStatus.value !== LOGIN_COOKIE_WAITING_STATUS.COOKIE_COLLECTED) {
    return
  }
  formContent.value.collectedCookies = JSON.stringify(collectedCookie.value, null, 2)
  hasUserMutateInput.value = false
}

const handleClickLaunchLogin = () => {
  gtagRenderer('launch_login_button_clicked')
  electron.ipcRenderer.send('launch-bosszhipin-login-page-with-preload-extension')
  loginCookieWaitingStatus.value = LOGIN_COOKIE_WAITING_STATUS.WAITING_FOR_LOGIN
}

const handleEditThisCookieExtensionStoreLinkClick = () => {
  gtagRenderer('etc_extension_link_clicked')
  electron.ipcRenderer.send(
    'open-external-link',
    'https://chromewebstore.google.com/detail/editthiscookie-v3/ojfebgpkimhlhcblbalbfjblapadhbol'
  )
}

const handleCancel = () => {
  gtagRenderer('cancel_clicked')
  window.close()
}
const handleSubmit = async () => {
  gtagRenderer('save_clicked')
  await formRef.value!.validate()
  await electron.ipcRenderer.invoke('write-storage-file', {
    fileName: 'boss-cookies.json',
    data: formContent.value.collectedCookies
  })
  ElMessage.success('BOSS直聘 Cookie 保存成功')
  gtagRenderer('save_cookie_done')

  window.electron.ipcRenderer.send('cookie-saved')
}

const handleBossZhipinLoginPageClosed = () => {
  if (loginCookieWaitingStatus.value === LOGIN_COOKIE_WAITING_STATUS.WAITING_FOR_LOGIN) {
    loginCookieWaitingStatus.value = LOGIN_COOKIE_WAITING_STATUS.INIT
  }
}

onMounted(() => {
  gtagRenderer('cookie_assistant_mounted')
})
onMounted(async () => {
  electron.ipcRenderer.once('BOSS_ZHIPIN_COOKIE_COLLECTED', handleCookieCollected)
  electron.ipcRenderer.on('BOSS_ZHIPIN_LOGIN_PAGE_CLOSED', handleBossZhipinLoginPageClosed)

  const cookieFileContent = await electron.ipcRenderer.invoke('read-storage-file', {
    fileName: 'boss-cookies.json'
  })
  if (checkCookieListFormat(cookieFileContent)) {
    formContent.value.collectedCookies = JSON.stringify(cookieFileContent, null, 2)
  } else {
    cookieInvalid.value = true
  }
})
onUnmounted(() => {
  electron.ipcRenderer.removeListener('BOSS_ZHIPIN_COOKIE_COLLECTED', handleCookieCollected)
  electron.ipcRenderer.removeListener(
    'BOSS_ZHIPIN_LOGIN_PAGE_CLOSED',
    handleBossZhipinLoginPageClosed
  )
  electron.ipcRenderer.send('kill-bosszhipin-login-page-with-preload-extension')
})
</script>

<style lang="scss" scoped>
.cookie-assistant-page {
  max-width: 680px;
  margin: 0 auto;
  padding: 20px 26px;
  box-sizing: border-box;
  font-size: 13.5px;
  color: var(--el-text-color-primary);
}
.guide-text {
  font-weight: 500;
  margin-bottom: 6px;
}
.guide-steps {
  margin: 0;
  padding-left: 20px;
  line-height: 1.9;
  color: var(--el-text-color-regular);
}
.manual-details {
  margin-top: 4px;
  summary {
    color: var(--el-color-warning);
    cursor: pointer;
    font-size: 13px;
  }
}
.manual-help {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
  max-height: 200px;
  overflow: auto;
  font-size: 12.5px;
  line-height: 1.6;
  figure {
    margin: 8px 0;
  }
}
</style>

<style lang="scss">
.cookie-form.el-form {
  .el-form-item__error--inline {
    margin-left: 0;
    margin-top: 10px;
  }
}
</style>

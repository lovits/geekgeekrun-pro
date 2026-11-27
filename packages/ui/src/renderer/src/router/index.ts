import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'
import BootstrapSplash from '@renderer/page/BootstrapSplash/index.vue'
import { gtagRenderer } from '@renderer/utils/gtag'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/first-run-readme',
    component: () => import('@renderer/page/FirstRunReadme/index.vue'),
    meta: {
      title: '初次使用必读'
    }
  },
  {
    path: '/cookieAssistant',
    component: () => import('@renderer/page/CookieAssistant/index.vue'),
    meta: {
      title: 'BOSS登录助手'
    }
  },
  {
    path: '/browserAssistant',
    component: () => import('@renderer/page/BrowserAssistant/index.vue'),
    meta: {
      title: '浏览器助手'
    }
  },
  {
    path: '/browserAutoFind',
    component: () => import('@renderer/page/BrowserAutoFind/index.vue'),
    meta: {
      title: '浏览器助手 - 自动查找浏览器'
    }
  },
  {
    path: '/browserDownloadProgress',
    component: () => import('@renderer/page/BrowserDownloadProgress/index.vue'),
    meta: {
      title: '正在下载浏览器'
    }
  },
  {
    path: '/llmConfig',
    component: () => import('@renderer/page/LlmConfig/index.vue'),
    meta: {
      title: '大语言模型设置'
    }
  },
  {
    path: '/resumeEditor',
    component: () => import('@renderer/page/ResumeEditor/index.vue'),
    meta: {
      title: '简历编辑'
    }
  },
  {
    path: '/readNoReplyReminderLlmMock',
    component: () => import('@renderer/page/ReadNoReplyReminderLlmMock/index.vue'),
    meta: {
      title: '已读不回跟进模拟'
    }
  },
  {
    path: '/commonJobConditionConfig',
    component: () => import('@renderer/page/CommonJobConditionConfig/index.vue'),
    meta: {
      title: '公共筛选规则'
    }
  },
  {
    path: '/main-layout',
    component: () => import('@renderer/page/MainLayout/index.vue'),
    redirect: '/main-layout/GeekAutoStartChatWithBoss',
    children: [
      { path: 'Updates', component: () => import('@renderer/page/MainLayout/Updates.vue'), meta: { title: '设置' } },
      { path: 'HrReplyRecords', component: () => import('@renderer/page/MainLayout/HrReplyRecords.vue'), meta: { title: '回复记录' } },
      { path: 'ApplicationSimulation', component: () => import('@renderer/page/MainLayout/ApplicationSimulation.vue'), meta: { title: '模拟开聊' } },
      { path: 'CommonJobConditionConfig', component: () => import('@renderer/page/CommonJobConditionConfig/index.vue'), props: { embedded: true }, meta: { title: '公共筛选规则' } },
      { path: 'LlmConfig', component: () => import('@renderer/page/LlmConfig/index.vue'), props: { embedded: true }, meta: { title: '大模型设置' } },
      { path: 'BrowserPreferences', component: () => import('@renderer/page/BrowserAssistant/index.vue'), props: { embedded: true }, meta: { title: '浏览器设置' } },
      {
        path: 'SettingsPreview',
        component: () => import('@renderer/page/MainLayout/SettingsPreview/index.vue'),
        meta: { title: '设置总览' }
      },
      {
        path: 'AiJobMatch',
        component: () => import('@renderer/page/MainLayout/AiJobMatch/index.vue'),
        meta: { title: 'AI 模型筛选' }
      },
      {
        path: 'taskManager',
        component: () => import('@renderer/page/MainLayout/TaskManager.vue'),
        meta: {
          title: '任务管理'
        }
      },
      {
        path: 'GeekAutoStartChatWithBoss',
        component: () => import('@renderer/page/MainLayout/GeekAutoStartChatWithBoss/index.vue'),
        meta: {
          title: '自动开聊'
        }
      },
      {
        path: 'ReadNoReplyReminder',
        redirect: '/main-layout/AutoReply?tab=followup'
      },
      { path: 'HrAutoReply', redirect: '/main-layout/AutoReply?tab=hr' },
      { path: 'AutoReply', component: () => import('@renderer/page/MainLayout/AutoReply.vue'), meta: { title: '自动回复' } },
      {
        path: 'StartChatRecord',
        component: () => import('@renderer/page/MainLayout/StartChatRecord.vue'),
        meta: {
          title: '开聊记录'
        }
      },
      {
        path: 'MarkAsNotSuitRecord',
        component: () => import('@renderer/page/MainLayout/MarkAsNotSuitRecord.vue'),
        meta: {
          title: '不合适记录'
        }
      },
      {
        path: 'JobLibrary',
        component: () => import('@renderer/page/MainLayout/JobLibrary.vue'),
        meta: {
          title: '职位库'
        }
      },
      {
        path: 'BossLibrary',
        component: () => import('@renderer/page/MainLayout/BossLibrary.vue'),
        meta: {
          title: 'BOSS库'
        }
      },
      {
        path: 'CompanyLibrary',
        component: () => import('@renderer/page/MainLayout/CompanyLibrary.vue'),
        meta: {
          title: '公司库'
        }
      }
    ]
  },
  {
    path: '/geekAutoStartChatWithBoss',
    component: () => import('@renderer/page/GeekAutoStartChatWithBoss/index.vue'),
    children: [
      {
        path: 'prepareRun',
        component: () => import('@renderer/page/GeekAutoStartChatWithBoss/PrepareRun.vue'),
        meta: {
          title: '自动开聊准备中'
        }
      },
      {
        path: 'runningStatus',
        component: () => import('@renderer/page/GeekAutoStartChatWithBoss/RunningStatus.vue'),
        meta: {
          title: '正在自动开聊'
        }
      },
      {
        path: 'runningStatusForReadNoReplyReminder',
        component: () =>
          import(
            '@renderer/page/GeekAutoStartChatWithBoss/RunningStatusForReadNoReplyReminder.vue'
          ),
        meta: {
          title: '正在自动跟进已读不回'
        }
      }
    ]
  },
  {
    path: '/',
    component: BootstrapSplash,
    meta: {
      title: '正在启动'
    }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.afterEach((to, from) => {
  if (to.meta?.title) {
    document.title = `${to.meta.title} - Geek Geek Run-Pro`
  } else {
    document.title = `Geek Geek Run-Pro`
  }
  gtagRenderer('router_path_changed', {
    from_path: from.fullPath,
    to_path: to.fullPath
  })
  gtagRenderer('page_view', {
    page_location: location.href,
    page_title: document.title
  })
})

export default router

<template>
  <el-tooltip effect="light" placement="bottom-start" :show-after="200" popper-class="job-filter-help-popper">
    <template #content>
      <div class="job-filter-help-content">
        <template v-if="kind === 'expected'">
          <strong>期望公司怎样匹配？</strong>
          <p>按 BOSS 岗位中的公司名称进行包含匹配，不区分大小写；命中任一名单项即可。名单为空或该项停用时，不按期望公司限制。</p>
          <p>公司名称可能与集团简称不同，可根据页面实际名称添加。自动开聊勾选“使用公共设置”时读取公共名单，否则读取任务自己的名单；修改名单用于后续新启动的任务。</p>
          <p>同时命中屏蔽规则时，屏蔽优先。快捷按钮的两份名单互斥；加入后“＋”变“−”，再次点击移除。按钮只增删该公司的独立条目，不删除覆盖其他公司的规则。</p>
          <img :src="companyFigure" alt="BOSS 公司信息位置图示" />
        </template>
        <template v-else-if="kind === 'blocked'">
          <strong>屏蔽公司怎样生效？</strong>
          <p>使用不区分大小写的正则匹配公司名称；规则为空或该项停用时，不据此屏蔽。启用后，屏蔽规则优先于期望公司名单。</p>
          <p>例如“甲公司|乙公司”表示匹配任一公司；过宽的规则（如 .*）会匹配所有公司。通过“−”加入的公司按字面名称转义，名称中的括号、加号等不会变成正则操作符。</p>
          <p>是否在 BOSS 网站标记不合适，仍由自动开聊中对应的处理策略决定；添加本地名单本身不会操作网站。</p>
          <img :src="companyFigure" alt="BOSS 公司信息位置图示" />
        </template>
        <template v-else>
          <strong>职位名称／类型／描述怎样筛选？</strong>
          <p>只有已启用且填写了内容的正则参与判断，匹配不区分大小写。“全部匹配”要求这些条件同时通过；“任一匹配”只需一项通过。空白、停用项不参与；全部留空或停用时，不根据这三项拦截。</p>
          <ul><li>只关注岗位名称：填写名称规则，其余项按需要启用。</li><li>关注具体工作内容：填写描述规则，并结合真实职责排查误伤。</li><li>职位类型是 BOSS 预定义的职类（如 Java、Python），与实习／全职这样的“求职类型”不同。</li></ul>
          <p>可先使用职位详情筛选模板，再修改正则。在“设置总览”核对启用项，用“匹配记录”查看具体排除原因；正则通过后仍需通过其他已启用的筛选；开启 AI 时再进行 AI 匹配。</p>
          <img :src="jobFigure" alt="BOSS 职位信息位置图示" />
          <img :src="typeFigure" alt="BOSS 职位分类入口图示" />
          <el-button link type="primary" size="small" @click="openGuide">查看误伤／误投排查指南</el-button>
        </template>
      </div>
    </template>
    <el-button link class="job-filter-help-button" :aria-label="labels[kind]"><el-icon><QuestionFilled /></el-icon></el-button>
  </el-tooltip>
</template>
<script setup lang="ts">
import { QuestionFilled } from '@element-plus/icons-vue'
import companyFigure from '@renderer/page/MainLayout/resources/intro-of-job-entry.png'
import jobFigure from '@renderer/page/MainLayout/resources/intro-of-job-info.png'
import typeFigure from '@renderer/page/MainLayout/resources/job-type-source-entry.png'
defineProps<{ kind: 'expected' | 'blocked' | 'jobs' }>()
const labels = { expected: '期望公司说明', blocked: '屏蔽公司说明', jobs: '职位正则匹配说明' }
function openGuide() { window.electron.ipcRenderer.send('open-external-link', 'https://linux.do/t/topic/640626/74?u=geekgeekrun') }
</script>
<style scoped>
.job-filter-help-button { margin-left: 6px; padding: 0; color: var(--el-text-color-secondary); vertical-align: middle; }
.job-filter-help-content { width: min(680px, 78vw); max-height: 70vh; overflow-y: auto; font-size: 13px; line-height: 1.7; color: var(--el-text-color-primary); }
p { margin: 8px 0; } ul { padding-left: 20px; margin: 8px 0; } img { display: block; max-width: 100%; max-height: 270px; margin: 10px 0; object-fit: contain; border-radius: 6px; border: 1px solid var(--el-border-color-lighter); }
</style>

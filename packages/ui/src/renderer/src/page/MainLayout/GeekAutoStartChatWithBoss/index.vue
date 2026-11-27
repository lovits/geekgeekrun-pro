<template>
  <div class="geek-auto-start-run-with-boss__wrap">
    <div
      class="main__wrap"
      :style="{
        display: 'flex',
        flexDirection: 'column'
      }"
    >
      <div class="form-wrap geek-auto-start-run-with-boss">
        <header class="page-heading ggr-page-header">
          <div>
            <h2 class="ggr-page-title">自动开聊</h2>
            <p class="ggr-page-desc">按来源与条件组合查找职位，通过规则过滤与 AI 评估后自动向 BOSS 发起沟通</p>
          </div>
        </header>
        <el-form ref="formRef" :model="formContent" label-position="top" :rules="formRules">
          <el-card class="config-section">
            <div class="section-title">运行节奏与定时开聊</div>
            <div class="rhythm-box">
              <div class="settings-subtitle">操作休息策略</div>
              <el-radio-group v-model="restMode">
                <el-radio value="off" label="off">不启用休息</el-radio>
                <el-radio value="operations" label="operations">按累计操作次数休息</el-radio>
                <el-radio value="success" label="success">按成功开聊次数休息</el-radio>
              </el-radio-group>
              <div class="rest-grid">
                <div class="rest-row" :class="{ muted: restMode !== 'operations' }">
                  每累计操作
                  <el-input-number v-model="formContent.sageTimeOpTimes" :min="1" :precision="0" :disabled="restMode !== 'operations'" controls-position="right" /> 次，暂停休息
                  <el-input-number v-model="formContent.sageTimePauseMinute" :min="0" :max="1440" :step="0.5" :precision="1" :disabled="restMode !== 'operations'" controls-position="right" /> 分钟
                </div>
                <div class="rest-row" :class="{ muted: restMode !== 'success' }">
                  每成功开聊
                  <el-input-number v-model="formContent.successfulChatRestEvery" :min="1" :max="10000" :precision="0" :disabled="restMode !== 'success'" controls-position="right" /> 次，暂停休息
                  <el-input-number v-model="formContent.successfulChatRestMinutes" :min="0" :max="1440" :step="0.5" :precision="1" :disabled="restMode !== 'success'" controls-position="right" /> 分钟
                </div>
              </div>
            </div>
            <div class="settings-subtitle schedule-subtitle">定时自动运行</div>
            <AutoChatSchedule ref="scheduleRef" />
          </el-card>
          <el-card class="config-section">
            <el-form-item class="job-source-form-item" prop="__jobSourceList">
              <div w-full>
                <div ref="jobSourceFormItemSectionEl" class="section-title">
                  职位查找来源（支持拖拽调整先后顺序）
                </div>
                <JobSourceDragOrderer
                  v-model="formContent.__jobSourceList"
                  class="job-source-drag-orderer"
                />
              </div>
            </el-form-item>
            <el-form-item data-setting="filters" tabindex="-1" prop="filter" mt18px mb0px w-full>
              <div flex-1>
                <div class="section-title">
                  页面筛选条件组合
                  <el-tooltip placement="top" :enterable="false">
                    <template #content><div class="filter-help-content">
                      <p v-if="formContent.combineRecommendJobFilterType === CombineRecommendJobFilterType.STATIC_COMBINE">固定组合：按表格从上到下一行一组，依次设置城市、薪资、经验、学历、行业与规模并查找岗位。</p>
                      <template v-else>
                        <p>自由组合：支持多选的筛选项（经验、学历、规模、行业）会合并勾选在同一组；仅城市、薪资这类单选项会逐项交叉分组查询。</p>
                        <p>未勾选的维度保持“不限”，不会额外生成多余的空白组合。</p>
                      </template>
                      <p>每组返回的岗位仍需通过已启用的公司名单、正则规则、BOSS 活跃度与 AI 筛选后才会发起沟通。</p>
                    </div></template>
                    <button type="button" class="ggr-help-btn" aria-label="职位筛选条件说明" @click.stop><QuestionFilled /></button>
                  </el-tooltip>
                </div>
                <div>
                  <div class="filter-top-bar">
                    <div v-if="formContent.combineRecommendJobFilterType === CombineRecommendJobFilterType.STATIC_COMBINE" class="filter-top-field">
                      <div class="sub-field-label">求职类型</div>
                      <el-select data-setting="employmentType" v-model="formContent.expectEmploymentType" style="width: 180px">
                        <el-option
                          v-for="op in conditions.jobTypeList"
                          :key="op.code"
                          :value="op.code"
                          :label="op.name"
                        />
                      </el-select>
                    </div>
                    <div class="filter-top-field">
                      <div class="sub-field-label">条件组合方式</div>
                      <el-select
                        v-model="formContent.combineRecommendJobFilterType"
                        style="width: 340px; max-width: 100%"
                        @change="
                          (v) => {
                            gtagRenderer('crjf_type_changed', { v })
                          }
                        "
                      >
                        <el-option
                          v-for="op in combineRecommendJobFilterTypeOptions"
                          :key="op.value"
                          :value="op.value"
                          :label="op.name"
                        />
                      </el-select>
                    </div>
                    <div class="combo-badge">
                      <span>当前共 <strong>{{ currentAnyCombineRecommendJobFilterCombinationCount.toLocaleString() }}</strong> 组查询条件</span>
                      <span
                        v-if="currentAnyCombineRecommendJobFilterCombinationCount >= 5"
                        class="warn-inline"
                      >（组合较多，全部查完耗时较长）</span>
                    </div>
                  </div>
                  <div
                    v-if="
                      formContent.combineRecommendJobFilterType ===
                      CombineRecommendJobFilterType.STATIC_COMBINE
                    "
                    mt10px
                  >
                    <StaticCombineBossRecommendFilter
                      v-model="formContent.staticCombineRecommendJobFilterConditions"
                    />
                  </div>
                  <div v-else mt10px>
                    <AnyCombineBossRecommendFilter
                      v-model="formContent.anyCombineRecommendJobFilter"
                    >
                      <template #employment-type>
                        <el-select data-setting="employmentType" v-model="formContent.expectEmploymentType" style="width: 100%">
                          <el-option
                            v-for="op in conditions.jobTypeList"
                            :key="op.code"
                            :value="op.code"
                            :label="op.name"
                          />
                        </el-select>
                      </template>
                    </AnyCombineBossRecommendFilter>
                  </div>
                </div>
              </div>
            </el-form-item>
            <el-collapse class="local-check-strategies">
              <el-collapse-item name="exact-checks">
                <template #title>职位详情二次复核（可选）
                  <el-tooltip placement="top" :enterable="false">
                    <template #content><div class="filter-help-content">点开职位详情后，再按下方指定的城市或精确薪资区间复核把关（不影响上方 BOSS 页面筛选控件）。留空表示不额外限制。</div></template>
                    <button type="button" class="ggr-help-btn" aria-label="职位详情复核说明" @click.stop><QuestionFilled /></button>
                  </el-tooltip>
                </template>
                <div class="exact-filter-fields">
                  <el-form-item>
                    <template #label>复核工作城市
                      <el-tooltip placement="top" :enterable="false">
                        <template #content><div class="filter-help-content">按岗位详情标注的实际城市再核对一次，仅保留所选城市。留空则不限制。</div></template>
                        <button type="button" class="ggr-help-btn" aria-label="职位城市复核说明" @click.stop><QuestionFilled /></button>
                      </el-tooltip>
                    </template>
                    <div class="city-picker-inline">
                      <CityChooser v-model="formContent.expectCityList">
                        <template #default="{ modelValue, showDialog, clearValue }">
                          <el-tag type="info" effect="plain">{{ Array.isArray(modelValue) ? modelValue.join('、') || '不限城市' : modelValue || '不限城市' }}</el-tag>
                          <el-button size="small" @click="showDialog">选择城市</el-button>
                          <el-button v-if="modelValue?.length" size="small" @click="clearValue">清空</el-button>
                        </template>
                      </CityChooser>
                    </div>
                  </el-form-item>
                  <el-form-item>
                    <template #label>精确薪资范围
                      <el-tooltip placement="top" :enterable="false">
                        <template #content><div class="filter-help-content">支持填写具体月薪（K）或年薪总包（W），岗位薪资范围与所填区间有交集即视为通过；上下限均留空则不限制。</div></template>
                        <button type="button" class="ggr-help-btn" aria-label="精确薪资范围说明" @click.stop><QuestionFilled /></button>
                      </el-tooltip>
                    </template>
                    <el-select v-model="formContent.expectSalaryCalculateWay" @change="handleExpectSalaryCalculateWayChanged">
                      <el-option v-for="option in expectSalaryCalculateWayOption" :key="option.value" :label="option.name" :value="option.value" />
                    </el-select>
                    <div class="exact-salary-range">
                      <el-input-number v-model="formContent.expectSalaryLow" :min="0" :step="0.25" controls-position="right" placeholder="最低" />
                      <span>—</span>
                      <el-input-number v-model="formContent.expectSalaryHigh" :min="0" :step="0.25" controls-position="right" placeholder="最高" />
                    </div>
                  </el-form-item>
                </div>
              </el-collapse-item>
            </el-collapse>
            <el-collapse v-if="localCityCondition.length || isShowSalaryMarkAsNotSuitStrategy || formContent.expectWorkExpList?.length" class="local-check-strategies">
              <el-collapse-item title="复核不匹配时的处理方式" name="local-check-strategies">
                <div v-if="localCityCondition.length" class="strategy-group">
                  <p class="strategy-caption">已选复核城市：{{ localCityCondition.join('、') }}</p>
                  <el-form-item mb10px style="width: 100%">
                    <div class="sub-field-label">岗位城市不匹配时：</div>
                    <el-select
                      v-model="formContent.expectCityNotMatchStrategy"
                      @change="(value) => gtagRenderer('expect_city_not_match_strategy_changed', { value })"
                    >
                      <el-option
                        v-for="op in strategyOptionWhenCurrentJobNotMatch"
                        :key="op.value"
                        :label="op.name"
                        :value="op.value"
                      />
                    </el-select>
                  </el-form-item>
                  <el-form-item
                    v-if="[MarkAsNotSuitOp.MARK_AS_NOT_SUIT_ON_BOSS, MarkAsNotSuitOp.MARK_AS_NOT_SUIT_ON_LOCAL].includes(formContent.expectCityNotMatchStrategy)"
                    mb0
                    style="width: 100%"
                  >
                    <div class="sub-field-label">执行“标记不合适”的职位范围：</div>
                    <el-select
                      v-model="formContent.strategyScopeOptionWhenMarkJobCityNotMatch"
                      @change="(value) => gtagRenderer('strategy_scope_option_wmjcnm_changed', { value })"
                    >
                      <el-option
                        v-for="op in strategyScopeOptionWhenMarkJobNotMatch"
                        :key="op.value"
                        :label="op.name"
                        :value="op.value"
                      />
                    </el-select>
                  </el-form-item>
                </div>
                <div v-if="isShowSalaryMarkAsNotSuitStrategy" class="strategy-group">
                  <el-form-item mb10px style="width: 100%">
                    <div class="sub-field-label">岗位薪资{{ salaryMarkAsNotSuitLabelText }}时：</div>
                    <el-select
                      v-model="formContent.expectSalaryNotMatchStrategy"
                      @change="(value) => gtagRenderer('expect_salary_not_match_strategy_changed', { value })"
                    >
                      <el-option
                        v-for="op in strategyOptionWhenCurrentJobNotMatch"
                        :key="op.value"
                        :label="op.name"
                        :value="op.value"
                      />
                    </el-select>
                  </el-form-item>
                  <el-form-item
                    v-if="[MarkAsNotSuitOp.MARK_AS_NOT_SUIT_ON_BOSS, MarkAsNotSuitOp.MARK_AS_NOT_SUIT_ON_LOCAL].includes(formContent.expectSalaryNotMatchStrategy)"
                    mb0
                    style="width: 100%"
                  >
                    <div class="sub-field-label">执行“标记不合适”的职位范围：</div>
                    <el-select
                      v-model="formContent.strategyScopeOptionWhenMarkSalaryNotMatch"
                      @change="(value) => gtagRenderer('strategy_scope_option_wmjsnm_changed', { value })"
                    >
                      <el-option
                        v-for="op in strategyScopeOptionWhenMarkJobNotMatch"
                        :key="op.value"
                        :label="op.name"
                        :value="op.value"
                      />
                    </el-select>
                  </el-form-item>
                </div>
                <div v-if="formContent.expectWorkExpList?.length" class="strategy-group">
                  <p class="strategy-caption">已选经验要求：{{ formContent.expectWorkExpList.join('、') }}</p>
                  <el-form-item mb10px style="width: 100%">
                    <div class="sub-field-label">工作经验不匹配时：</div>
                    <el-select
                      v-model="formContent.expectWorkExpNotMatchStrategy"
                      @change="(value) => gtagRenderer('expect_we_not_match_strategy_changed', { value })"
                    >
                      <el-option
                        v-for="op in strategyOptionWhenCurrentJobNotMatch"
                        :key="op.value"
                        :label="op.name"
                        :value="op.value"
                      />
                    </el-select>
                  </el-form-item>
                  <el-form-item
                    v-if="[MarkAsNotSuitOp.MARK_AS_NOT_SUIT_ON_BOSS, MarkAsNotSuitOp.MARK_AS_NOT_SUIT_ON_LOCAL].includes(formContent.expectWorkExpNotMatchStrategy)"
                    mb0
                    style="width: 100%"
                  >
                    <div class="sub-field-label">执行“标记不合适”的职位范围：</div>
                    <el-select
                      v-model="formContent.strategyScopeOptionWhenMarkJobWorkExpNotMatch"
                      @change="(value) => gtagRenderer('strategy_scope_option_wmjwenm_changed', { value })"
                    >
                      <el-option
                        v-for="op in strategyScopeOptionWhenMarkJobNotMatch"
                        :key="op.value"
                        :label="op.name"
                        :value="op.value"
                      />
                    </el-select>
                  </el-form-item>
                </div>
              </el-collapse-item>
            </el-collapse>
          </el-card>
          <el-card class="config-section">
            <div class="section-title">公司过滤与 BOSS 活跃度 <JobFilterHelp kind="jobs" /></div>
            <div class="company-head-row">
              <span>期望公司与屏蔽公司统一在公共筛选规则中设置</span>
              <el-button size="small" @click="handleClickConfigCommonJobCondition({ entry: 'expect-company-field' })">前往设置</el-button>
            </div>
            <div class="block-company-filter-wrap">
              <div
                v-if="(!formContent.fieldsForUseCommonConfig.blockCompanyNameRegExpStr ? formContent : commonJobConditionConfig).blockCompanyNameRegExpStr?.length"
                class="block-company-strategy"
              >
                <el-form-item mb0 style="width: 100%">
                  <div class="sub-field-label">命中屏蔽公司时：</div>
                  <el-select
                    v-model="formContent.blockCompanyNameRegMatchStrategy"
                    @change="(value) => gtagRenderer('block_company_match_strategy_changed', { value })"
                  >
                    <el-option
                      v-for="op in strategyOptionWhenCurrentJobNotMatch"
                      :key="op.value"
                      :label="op.name"
                      :value="op.value"
                    />
                  </el-select>
                </el-form-item>
              </div>
            </div>

            <div class="soft-divider" />

            <div>
              <div data-setting="activity" tabindex="-1" class="sub-section-title mb8">BOSS 活跃度要求</div>
              <el-form-item>
                <div class="sub-field-label">要求 BOSS 最近活跃时间不早于：</div>
                <el-slider
                  v-model="formContent.markAsNotActiveSelectedTimeRange"
                  :marks="activityMarks"
                  :max="activityOptions.length"
                  :step="1"
                  show-stops
                  pl50px pr50px pb50px
                  class="no-active-definition-text-slider"
                  aria-label="允许的 BOSS 活跃度"
                  :format-tooltip="formatActivity"
                  @change="(value) => gtagRenderer('job_not_active_time_range_changed', { value })"
                />
              </el-form-item>
              <div style="max-width: 480px">
                <el-form-item v-if="formContent.markAsNotActiveSelectedTimeRange > 0" mb0>
                  <div class="sub-field-label">活跃度不达标时：</div>
                  <el-select
                    v-model="formContent.jobNotActiveStrategy"
                    @change="(value) => gtagRenderer('job_not_active_strategy_changed', { value })"
                  >
                    <el-option
                      v-for="op in strategyOptionWhenCurrentJobNotMatch"
                      :key="op.value"
                      :label="op.name"
                      :value="op.value"
                    />
                  </el-select>
                </el-form-item>
              </div>
            </div>
          </el-card>
        </el-form>
      </div>
      <div class="settings-footer">
        <div class="footer-inner">
          <span class="ggr-status-text" role="status">{{ autosave.status.value }}</span>
          <el-button type="primary" @click="handleSubmit">开始自动开聊</el-button>
        </div>
      </div>
    </div>
    <div
      class="running-overlay__wrap"
      :style="{
        pointerEvents: 'none'
      }"
    >
      <RunningOverlay
        ref="runningOverlayRef"
        :worker-id="CURRENT_WORKER_ID"
        :run-record-id="runRecordId"
      >
        <template #op-buttons="{ currentRunningStatus }">
          <div>
            <template v-if="currentRunningStatus === RUNNING_STATUS_ENUM.RUNNING">
              <el-button
                type="danger"
                plain
                :loading="isStopButtonLoading"
                @click="handleStopButtonClick"
                >结束任务</el-button
              >
            </template>
            <template v-else>
              <el-button
                type="primary"
                @click="
                  () => {
                    runningOverlayRef?.hide?.()
                  }
                "
                >关闭</el-button
              >
            </template>
          </div>
        </template>
      </RunningOverlay>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAutoSave } from '@renderer/composables/useAutoSave'
import AutoChatSchedule from '@renderer/features/AutoChatSchedule.vue'
import { normalizeChatRestConfig } from '@geekgeekrun/utils/successful-chat-rest.mjs'
import { computed, onBeforeUnmount, ref, watch, onUnmounted, onMounted, onActivated, nextTick } from 'vue'
import { ElForm, ElMessage } from 'element-plus'
import { QuestionFilled } from '@element-plus/icons-vue'
import { useRouter, useRoute } from 'vue-router'
import JobFilterHelp from '@renderer/features/JobFilterHelp/index.vue'
import CityChooser from './components/CityChooser.vue'
import AnyCombineBossRecommendFilter from '@renderer/features/AnyCombineBossRecommendFilter/index.vue'
import StaticCombineBossRecommendFilter from '@renderer/features/StaticCombineBossRecommendFilter/index.vue'
import { activeDescList } from '@geekgeekrun/geek-auto-start-chat-with-boss/constant.mjs'
import {
  calculateTotalCombinations,
  formatStaticCombineFilters
} from '@geekgeekrun/geek-auto-start-chat-with-boss/combineCalculator.mjs'
import { gtagRenderer as baseGtagRenderer } from '@renderer/utils/gtag'
import {
  CombineRecommendJobFilterType,
  MarkAsNotSuitOp,
  StrategyScopeOptionWhenMarkJobNotMatch,
  SalaryCalculateWay,
  JobDetailRegExpMatchLogic
} from '@geekgeekrun/sqlite-plugin/src/enums'
import { debounce } from 'lodash'
import mittBus from '../../../utils/mitt'
import conditions from '@geekgeekrun/geek-auto-start-chat-with-boss/internal-config/job-filter-conditions-20241002.json'
import JobSourceDragOrderer from '../../../features/JobSourceDragOrderer/index.vue'
import type { JobSourceConfig } from '../../../../../common/types/runtime'
import RunningOverlay from '@renderer/features/RunningOverlay/index.vue'
import { RUNNING_STATUS_ENUM } from '../../../../../common/enums/auto-start-chat'
import { useTaskManagerStore } from '@renderer/store'
import {
  ensureSalaryRangeCorrect,
  expectSalaryCalculateWayOption,
  getHandlerForExpectSalaryCalculateWayChanged,
  getRuleOfExpectJobNameRegExpStr,
  getRuleOfExpectJobDescRegExpStr,
  getRuleOfBlockCompanyNameRegExpStr,
  getRuleOfExpectJobTypeRegExpStr
} from './common'
const { ipcRenderer } = window.electron
const gtagRenderer = (name, params?: object) => {
  return baseGtagRenderer(name, {
    scene: 'gascwb-config',
    ...params
  })
}

const router = useRouter()
const route = useRoute()
async function revealSetting() {
  const focus = String(route.query.focus || '')
  if (!['filters', 'activity', 'employmentType', 'cityList', 'salaryList', 'experienceList', 'degreeList', 'industryList', 'scaleList'].includes(focus)) return
  await nextTick()
  const root: HTMLElement | undefined = formRef.value?.$el
  const section = [...(root?.querySelectorAll<HTMLElement>(`[data-setting="${focus}"]`) || [])].find(el => el.getBoundingClientRect().height > 0 && getComputedStyle(el).visibility === 'visible') || root?.querySelector<HTMLElement>('[data-setting="filters"]')
  section?.scrollIntoView({ block: 'center' })
  const input = section?.querySelector<HTMLElement>('input, button') || section
  input?.focus({ preventScroll: true })
}
onActivated(revealSetting)
watch(() => route.query.focus, revealSetting)

type FilterForm = {
  [key: string]: any
  anyCombineRecommendJobFilter: Record<string, (string | number)[]>
  fieldsForUseCommonConfig: Record<string, boolean>
  staticCombineRecommendJobFilterConditions: { salary: number | null; experience: number | null; degree: number | null; industry: number | null; scale: number | null }[]
  expectCityList: string[]
  expectWorkExpList: string[]
  expectSalaryLow: number | null
  expectSalaryHigh: number | null
}
const formContent = ref<FilterForm>({
  dingtalkRobotAccessToken: '',
  expectCompanies: '',
  anyCombineRecommendJobFilter: {},
  combineRecommendJobFilterType: 1,
  expectEmploymentType: 0,
  staticCombineRecommendJobFilterConditions: [],
  expectJobNameRegExpStr: '',
  expectJobTypeRegExpStr: '',
  expectJobDescRegExpStr: '',
  jobNotMatchStrategy: MarkAsNotSuitOp.MARK_AS_NOT_SUIT_ON_BOSS,
  jobNotActiveStrategy: MarkAsNotSuitOp.MARK_AS_NOT_SUIT_ON_BOSS,
  markAsNotActiveSelectedTimeRange: 7,
  // city
  expectCityList: [],
  expectCityNotMatchStrategy: MarkAsNotSuitOp.NO_OP,
  strategyScopeOptionWhenMarkJobCityNotMatch:
    StrategyScopeOptionWhenMarkJobNotMatch.ONLY_COMPANY_MATCHED_JOB,
  // salary
  expectSalaryCalculateWay: SalaryCalculateWay.MONTH_SALARY,
  expectSalaryNotMatchStrategy: MarkAsNotSuitOp.NO_OP,
  strategyScopeOptionWhenMarkSalaryNotMatch:
    StrategyScopeOptionWhenMarkJobNotMatch.ONLY_COMPANY_MATCHED_JOB,
  expectSalaryLow: null,
  expectSalaryHigh: null,
  // work exp
  expectWorkExpList: [],
  expectWorkExpNotMatchStrategy: MarkAsNotSuitOp.NO_OP,
  strategyScopeOptionWhenMarkJobWorkExpNotMatch:
    StrategyScopeOptionWhenMarkJobNotMatch.ONLY_COMPANY_MATCHED_JOB,
  jobDetailRegExpMatchLogic: JobDetailRegExpMatchLogic.EVERY,

  __jobSourceList: formatJobSourceConfigToFormValue([
    {
      type: 'expect',
      enabled: true
    }
  ]),
  successfulChatRestEnabled: false,
  successfulChatRestEvery: 20,
  successfulChatRestMinutes: 0,
  isSageTimeEnabled: true,
  sageTimeOpTimes: 100,
  sageTimePauseMinute: 15,
  blockCompanyNameRegExpStr: '',
  blockCompanyNameRegMatchStrategy: MarkAsNotSuitOp.NO_OP,
  fieldsForUseCommonConfig: {}
})

const restMode = computed({
  get: () => {
    const config = normalizeChatRestConfig(formContent.value)
    return config.successfulChatRestEnabled ? 'success' : config.isSageTimeEnabled ? 'operations' : 'off'
  },
  set: (mode: string) => {
    formContent.value.successfulChatRestEnabled = mode === 'success'
    formContent.value.isSageTimeEnabled = mode === 'operations'
    formContent.value.successfulChatRestMinutes = mode === 'success' ? formContent.value.successfulChatRestMinutes || 5 : 0
    formContent.value.sageTimePauseMinute = mode === 'operations' ? formContent.value.sageTimePauseMinute || 15 : 0
  }
})

const currentAnyCombineRecommendJobFilterCombinationCount = computed(() => {
  if (
    formContent.value.combineRecommendJobFilterType === CombineRecommendJobFilterType.STATIC_COMBINE
  ) {
    if (!formContent.value.staticCombineRecommendJobFilterConditions?.length) {
      return 1
    }
    return formatStaticCombineFilters(
      formContent.value.staticCombineRecommendJobFilterConditions
    )?.filter(Boolean).length
  }
  return calculateTotalCombinations(formContent.value.anyCombineRecommendJobFilter)
})
watch(
  () => currentAnyCombineRecommendJobFilterCombinationCount.value,
  (v) => {
    const allCountMap = {}
    Object.entries(formContent.value.anyCombineRecommendJobFilter).forEach(([k, v]) => {
      allCountMap[k + 'Length'] = v?.length
    })
    gtagRenderer('any_combine_rjfc_count', {
      combinedAllCount: v,
      ...allCountMap
    })
  }
)

const unwatchAnyCombineRecommendJobFilter = ref<null | (() => void)>(null)
onBeforeUnmount(() => {
  unwatchAnyCombineRecommendJobFilter.value?.()
})
let loaded = false
electron.ipcRenderer.invoke('fetch-config-file-content').then(async (res) => {
  console.log(res)
  formContent.value.dingtalkRobotAccessToken = res.config['dingtalk.json']['groupRobotAccessToken']
  formContent.value.expectCompanies = res.config['target-company-list.json'].join(',')
  formContent.value.anyCombineRecommendJobFilter = res.config['boss.json']
    ?.anyCombineRecommendJobFilter ?? {
    salaryList: [],
    experienceList: [],
    degreeList: [],
    scaleList: [],
    industryList: []
  }
  unwatchAnyCombineRecommendJobFilter.value = watch(
    () => formContent.value?.anyCombineRecommendJobFilter,
    debounce(() => {
      gtagRenderer('any_combine_filter_changed')
    }, 2000),
    {
      deep: true
    }
  )
  formContent.value.combineRecommendJobFilterType =
    res.config['boss.json']?.combineRecommendJobFilterType ?? 1
  formContent.value.expectEmploymentType = res.config['boss.json']?.expectEmploymentType ?? 0
  formContent.value.staticCombineRecommendJobFilterConditions = res.config['boss.json']
    ?.staticCombineRecommendJobFilterConditions?.length
    ? res.config['boss.json'].staticCombineRecommendJobFilterConditions
    : []
  if (
    res.config['boss.json']?.expectJobRegExpStr &&
    typeof res.config['boss.json']?.expectJobNameRegExpStr === 'undefined' &&
    typeof res.config['boss.json']?.expectJobTypeRegExpStr === 'undefined' &&
    typeof res.config['boss.json']?.expectJobDescRegExpStr === 'undefined'
  ) {
    res.config['boss.json'].expectJobNameRegExpStr = res.config['boss.json'].expectJobRegExpStr
    res.config['boss.json'].expectJobTypeRegExpStr = res.config['boss.json'].expectJobRegExpStr
    res.config['boss.json'].expectJobDescRegExpStr = res.config['boss.json'].expectJobRegExpStr
  }
  formContent.value.expectJobNameRegExpStr = res.config['boss.json'].expectJobNameRegExpStr?.trim()
  formContent.value.expectJobTypeRegExpStr = res.config['boss.json'].expectJobTypeRegExpStr?.trim()
  formContent.value.expectJobDescRegExpStr = res.config['boss.json'].expectJobDescRegExpStr?.trim()

  formContent.value.jobNotMatchStrategy = strategyOptionWhenCurrentJobNotMatch
    .map((it) => it.value)
    .includes(res.config['boss.json'].jobNotMatchStrategy)
    ? res.config['boss.json'].jobNotMatchStrategy
    : MarkAsNotSuitOp.MARK_AS_NOT_SUIT_ON_BOSS
  formContent.value.markAsNotActiveSelectedTimeRange = isNaN(
    parseInt(String(res.config['boss.json'].markAsNotActiveSelectedTimeRange))
  )
    ? 7
    : parseInt(String(res.config['boss.json'].markAsNotActiveSelectedTimeRange))

  formContent.value.jobNotActiveStrategy = strategyOptionWhenCurrentJobNotMatch
    .map((it) => it.value)
    .includes(res.config['boss.json'].jobNotActiveStrategy)
    ? res.config['boss.json'].jobNotActiveStrategy
    : MarkAsNotSuitOp.MARK_AS_NOT_SUIT_ON_BOSS

  // city
  formContent.value.expectCityList = res.config['boss.json']?.expectCityList ?? []
  formContent.value.expectCityNotMatchStrategy = strategyOptionWhenCurrentJobNotMatch
    .map((it) => it.value)
    .includes(res.config['boss.json'].expectCityNotMatchStrategy)
    ? res.config['boss.json'].expectCityNotMatchStrategy
    : MarkAsNotSuitOp.NO_OP
  formContent.value.strategyScopeOptionWhenMarkJobCityNotMatch =
    res.config['boss.json']?.strategyScopeOptionWhenMarkJobCityNotMatch ??
    StrategyScopeOptionWhenMarkJobNotMatch.ONLY_COMPANY_MATCHED_JOB

  // salary
  formContent.value.expectSalaryCalculateWay =
    res.config['boss.json'].expectSalaryCalculateWay ?? SalaryCalculateWay.MONTH_SALARY
  formContent.value.expectSalaryNotMatchStrategy =
    res.config['boss.json'].expectSalaryNotMatchStrategy ?? MarkAsNotSuitOp.NO_OP
  formContent.value.strategyScopeOptionWhenMarkSalaryNotMatch =
    res.config['boss.json'].strategyScopeOptionWhenMarkSalaryNotMatch ??
    StrategyScopeOptionWhenMarkJobNotMatch.ONLY_COMPANY_MATCHED_JOB
  formContent.value.expectSalaryLow = parseFloat(res.config['boss.json'].expectSalaryLow) || null
  formContent.value.expectSalaryHigh = parseFloat(res.config['boss.json'].expectSalaryHigh) || null
  ensureSalaryRangeCorrect({ formContent })

  // work exp
  formContent.value.expectWorkExpList =
    Array.isArray(res.config['boss.json'].expectWorkExpList) &&
    res.config['boss.json'].expectWorkExpList.length
      ? res.config['boss.json'].expectWorkExpList
      : []
  const s = new Set([...(formContent.value?.expectWorkExpList ?? [])])
  s.delete('在校生')
  formContent.value.expectWorkExpList = [...s]
  formContent.value.expectWorkExpNotMatchStrategy =
    res.config['boss.json'].expectWorkExpNotMatchStrategy ?? MarkAsNotSuitOp.NO_OP
  formContent.value.strategyScopeOptionWhenMarkJobWorkExpNotMatch =
    res.config['boss.json'].strategyScopeOptionWhenMarkJobWorkExpNotMatch ??
    StrategyScopeOptionWhenMarkJobNotMatch.ONLY_COMPANY_MATCHED_JOB
  formContent.value.jobDetailRegExpMatchLogic =
    res.config['boss.json'].jobDetailRegExpMatchLogic ?? JobDetailRegExpMatchLogic.EVERY
  formContent.value.__jobSourceList = formatJobSourceConfigToFormValue(
    res.config['boss.json'].jobSourceList || []
  )
  formContent.value.successfulChatRestEnabled = res.config['boss.json'].successfulChatRestEnabled ?? false
  formContent.value.successfulChatRestEvery = res.config['boss.json'].successfulChatRestEvery ?? 20
  formContent.value.successfulChatRestMinutes = res.config['boss.json'].successfulChatRestMinutes ?? 5
  formContent.value.isSageTimeEnabled = res.config['boss.json'].isSageTimeEnabled ?? true
  formContent.value.sageTimeOpTimes =
    isNaN(parseInt(res.config['boss.json'].sageTimeOpTimes)) ||
    parseInt(res.config['boss.json'].sageTimeOpTimes) < 1
      ? 100
      : parseInt(res.config['boss.json'].sageTimeOpTimes)
  formContent.value.sageTimePauseMinute =
    isNaN(parseFloat(res.config['boss.json'].sageTimePauseMinute)) ||
    parseFloat(res.config['boss.json'].sageTimePauseMinute) < 0
      ? 15
      : parseFloat(res.config['boss.json'].sageTimePauseMinute)
  Object.assign(formContent.value, normalizeChatRestConfig(formContent.value))
  formContent.value.blockCompanyNameRegExpStr =
    res.config['boss.json'].blockCompanyNameRegExpStr?.trim() ?? ''
  formContent.value.blockCompanyNameRegMatchStrategy =
    res.config['boss.json'].blockCompanyNameRegMatchStrategy ?? MarkAsNotSuitOp.NO_OP
  formContent.value.fieldsForUseCommonConfig =
    res.config['boss.json']?.fieldsForUseCommonConfig ?? {}

  commonJobConditionConfig.value = {
    expectJobNameRegExpStr:
      res.config['common-job-condition-config.json']?.expectJobNameRegExpStr ?? '',
    expectJobTypeRegExpStr:
      res.config['common-job-condition-config.json']?.expectJobTypeRegExpStr ?? '',
    expectJobDescRegExpStr:
      res.config['common-job-condition-config.json']?.expectJobDescRegExpStr ?? '',
    jobDetailRegExpMatchLogic:
      res.config['common-job-condition-config.json']?.jobDetailRegExpMatchLogic ??
      JobDetailRegExpMatchLogic.EVERY,
    expectCompanies: (res.config['common-job-condition-config.json']?.expectCompanies ?? []).join(
      ','
    ),
    blockCompanyNameRegExpStr:
      res.config['common-job-condition-config.json']?.blockCompanyNameRegExpStr ?? '',
    expectSalaryCalculateWay:
      res.config['common-job-condition-config.json']?.expectSalaryCalculateWay ??
      SalaryCalculateWay.MONTH_SALARY,
    expectSalaryLow: res.config['common-job-condition-config.json']?.expectSalaryLow ?? null,
    expectSalaryHigh: res.config['common-job-condition-config.json']?.expectSalaryHigh ?? null,
    expectCityList: res.config['common-job-condition-config.json']?.expectCityList ?? []
  }
  // Copy legacy shared limits into the only editor before saving them with the task.
  for (const [flag, keys] of Object.entries({ city: ['expectCityList'], salary: ['expectSalaryCalculateWay', 'expectSalaryLow', 'expectSalaryHigh'] })) {
    if (formContent.value.fieldsForUseCommonConfig[flag]) {
      for (const key of keys) formContent.value[key] = commonJobConditionConfig.value[key]
    }
    formContent.value.fieldsForUseCommonConfig[flag] = false
  }
  await nextTick()
  loaded = true
  revealSetting()
})

const jobSourceFormItemSectionEl = ref()
const jobDetailRegExpSectionEl = ref()
const blockCompanyNameRegExpSectionEl = ref()
const formRules: import('element-plus').FormRules = {
  expectJobNameRegExpStr: {
    trigger: 'blur',
    validator: getRuleOfExpectJobNameRegExpStr({ gtagRenderer, jobDetailRegExpSectionEl })
  },
  expectJobTypeRegExpStr: {
    trigger: 'blur',
    validator: getRuleOfExpectJobTypeRegExpStr({ gtagRenderer, jobDetailRegExpSectionEl })
  },
  expectJobDescRegExpStr: {
    trigger: 'blur',
    validator: getRuleOfExpectJobDescRegExpStr({ gtagRenderer, jobDetailRegExpSectionEl })
  },
  __jobSourceList: {
    trigger: undefined,
    validator(_, value, cb) {
      if (!Array.isArray(value)) {
        cb()
        return
      }
      if (value.every((it) => !it.enabled)) {
        cb(new Error(`请至少启用一个职位查找来源`))
        return
      }
      const configMap: Record<string, JobSourceConfig> = {}
      for (const config of value) {
        if (configMap[config.type]) {
          continue
        }
        configMap[config.type] = config
      }
      if (
        !configMap.expect.enabled &&
        !configMap.recommend.enabled &&
        configMap.search.enabled &&
        !configMap.search?.children?.some((it) => it.enabled && it.keyword?.trim())
      ) {
        cb(new Error(`请至少启用一个有效的职位来源或搜索关键词`))
        jobSourceFormItemSectionEl.value?.scrollIntoViewIfNeeded()
        return
      }
      cb()
    }
  },
  sageTimeOpTimes: {
    validator(_, value, cb) {
      if (!formContent.value.isSageTimeEnabled) {
        cb()
        return
      }
      if (value < 1 || isNaN(parseInt(value))) {
        cb(new Error(`最少填写 1`))
        return
      }
      cb()
    }
  },
  sageTimePauseMinute: {
    validator(_, value, cb) {
      if (!formContent.value.isSageTimeEnabled) {
        cb()
        return
      }
      if (value < 0 || isNaN(parseFloat(value))) {
        cb(new Error(`不能小于 0`))
        return
      }
      cb()
    }
  },
  blockCompanyNameRegExpStr: {
    trigger: 'blur',
    validator: getRuleOfBlockCompanyNameRegExpStr({ gtagRenderer, blockCompanyNameRegExpSectionEl })
  }
}

const formRef = ref<InstanceType<typeof ElForm>>()
const scheduleRef = ref<InstanceType<typeof AutoChatSchedule>>()
async function saveConfiguration(config: Record<string, unknown>) {
  try {
    if (!scheduleRef.value) throw new Error('定时设置尚未加载，请稍后重试')
    config.autoChatSchedule = scheduleRef.value.getConfig()
    await electron.ipcRenderer.invoke('save-config-file-from-ui', JSON.stringify(config))
    scheduleRef.value.markSaved(config.autoChatSchedule)
    return true
  } catch (error: any) {
    ElMessage.error(error.message || String(error))
    return false
  }
}
const runRecordId = ref<number>()
const runningOverlayRef = ref<InstanceType<typeof RunningOverlay>>()
const taskManagerStore = useTaskManagerStore()
const CURRENT_WORKER_ID = 'geekAutoStartWithBossMain'

onMounted(async () => {
  await taskManagerStore.getRunningTasks()
  const existingWorker = taskManagerStore.runningTasks?.find(
    (it) => it.workerId === CURRENT_WORKER_ID
  )
  if (existingWorker) {
    runRecordId.value = existingWorker.runtimeStorage?.stepStatusMapByStepId
      ? Object.values(existingWorker.runtimeStorage.stepStatusMapByStepId)[0]?.runRecordId
      : undefined
    if (runRecordId.value) {
      runningOverlayRef.value?.show()
    }
  }
})

const handleSubmit = async () => {
  gtagRenderer('save_config_and_launch_clicked', {
    has_dingtalk_robot_token: !!formContent.value?.dingtalkRobotAccessToken,
    expect_job_name_reg_exp_str: formContent.value?.expectJobNameRegExpStr,
    expect_job_type_reg_exp_str: formContent.value?.expectJobTypeRegExpStr,
    expect_job_desc_reg_exp_str: formContent.value?.expectJobDescRegExpStr,
    crjf_type: formContent.value?.combineRecommendJobFilterType,
    crjf_cc: currentAnyCombineRecommendJobFilterCombinationCount.value?.toLocaleString?.(),
    sage_t_config: JSON.stringify({
      isEnabled: formContent.value.isSageTimeEnabled,
      pauseMinute: formContent.value.sageTimePauseMinute,
      opTimes: formContent.value.sageTimeOpTimes
    })
  })
  // remove the obsolete filter - expectJobRegExpStr
  formContent.value.expectJobRegExpStr = undefined
  try {
    await formRef.value!.validate()
  } catch (err) {
    ElMessage.error({
      message: '部分设置填写有误，请检查标红项',
      grouping: true
    })
    console.log(err)
    return
  }
  const clonedFormContent = JSON.parse(JSON.stringify(normalizeChatRestConfig(formContent.value)))
  clonedFormContent.jobSourceList = formatJobSourceFormValueToConfig(
    clonedFormContent.__jobSourceList
  )
  delete clonedFormContent.__jobSourceList
  if (!await saveConfiguration(clonedFormContent)) return
  mittBus.emit('auto-start-chat-with-boss-config-saved')
  gtagRenderer('config_saved_and_launch_auto_start_chat', {
    has_dingtalk_robot_token: !!formContent.value?.dingtalkRobotAccessToken
  })

  try {
    runningOverlayRef.value?.show()
    const { runRecordId: rrId } = await electron.ipcRenderer.invoke(
      'run-geek-auto-start-chat-with-boss'
    )
    runRecordId.value = rrId
  } catch (err) {
    if (err instanceof Error && err.message.includes('NEED_TO_CHECK_RUNTIME_DEPENDENCIES')) {
      gtagRenderer('gascwb_cannot_run_for_corrupt')
      ElMessage.error({
        message: `运行环境需要重新检测，正在自动处理…`
      })
      router.replace('/')
    }
    console.error(err)
    gtagRenderer('gascwb_cannot_run_for_unknown_error', { err })
  }

  // {
  //   path: '/geekAutoStartChatWithBoss/prepareRun',
  //   query: { flow: 'geek-auto-start-chat-with-boss' }
  // }
}
const autosave = useAutoSave(() => formContent.value, async value => {
  const config = JSON.parse(JSON.stringify(normalizeChatRestConfig(value)))
  config.jobSourceList = formatJobSourceFormValueToConfig(config.__jobSourceList)
  delete config.__jobSourceList
  await electron.ipcRenderer.invoke('save-config-file-from-ui', JSON.stringify(config))
  mittBus.emit('auto-start-chat-with-boss-config-saved')
}, () => loaded)

const strategyOptionWhenCurrentJobNotMatch = [
  {
    name: '在 BOSS 直聘标记“不合适”（推荐，促使平台补充新的推荐职位）',
    value: MarkAsNotSuitOp.MARK_AS_NOT_SUIT_ON_BOSS
  },
  {
    name: '仅在本机记录，7 天内遇到该职位直接跳过',
    value: MarkAsNotSuitOp.MARK_AS_NOT_SUIT_ON_LOCAL
  },
  {
    name: '仅本次运行跳过，不留记录',
    value: MarkAsNotSuitOp.NO_OP
  }
]

const strategyScopeOptionWhenMarkJobNotMatch = [
  {
    name: '所有职位',
    value: StrategyScopeOptionWhenMarkJobNotMatch.ALL_JOB
  },
  {
    name: '仅和“期望投递公司”匹配的职位',
    value: StrategyScopeOptionWhenMarkJobNotMatch.ONLY_COMPANY_MATCHED_JOB
  }
]

const localCityCondition = computed(() => formContent.value.expectCityList || [])
const handleExpectSalaryCalculateWayChanged = getHandlerForExpectSalaryCalculateWayChanged({ gtagRenderer, formContent })

const salaryMarkAsNotSuitLabelText = computed(() => {
  const textSeg: string[] = []
  const formContentToUse = formContent.value
  if (formContentToUse.expectSalaryLow) {
    textSeg.push('低于期望薪资下限')
  }
  if (formContentToUse.expectSalaryHigh) {
    textSeg.push('高于期望薪资上限')
  }
  return textSeg.join(' / ')
})

const isShowSalaryMarkAsNotSuitStrategy = computed(() => {
  const formContentToUse = formContent.value
  let flag = Boolean(formContentToUse.expectSalaryHigh || formContentToUse.expectSalaryLow)

  if (
    formContentToUse.expectSalaryHigh &&
    formContentToUse.expectSalaryLow &&
    formContentToUse.expectSalaryHigh < formContentToUse.expectSalaryLow
  ) {
    flag = false
  }

  return flag
})

const activityOptions = activeDescList.slice(2).map((label, index) => ({ label, value: index + 1 }))
const formatActivity = (value: number) => value === 0 ? '不限活跃度' : activityOptions[value - 1]?.label || ''
const activityMarks = computed(() => Object.fromEntries(
  [{ label: '不限活跃度', value: 0 }, ...activityOptions].map(option => [option.value, {
    label: option.label,
    style: option.value === formContent.value.markAsNotActiveSelectedTimeRange ? { color: 'var(--el-color-primary)', fontWeight: '600' } : {}
  }])
))

function formatJobSourceConfigToFormValue(config: JobSourceConfig[] = []) {
  const typeToNameKey = {
    recommend: '首页推荐职位',
    expect: '按求职期望推荐',
    search: '关键词搜索职位'
  }
  const isInitEmpty = !config?.length
  config = config.filter((it) => Object.hasOwn(typeToNameKey, it.type))

  const addedSet = new Set()
  const tempArr: JobSourceConfig[] = []
  config.forEach((it) => {
    if (!Object.hasOwn(typeToNameKey, it.type)) {
      return
    }
    tempArr.push(it)
    addedSet.add(it.type)
  })
  config = tempArr
  Object.keys(typeToNameKey).forEach((k) => {
    if (addedSet.has(k)) {
      return
    }
    // handle init value
    tempArr.push({
      type: k,
      enabled: isInitEmpty && k === 'expect'
    })
    addedSet.add(k)
  })

  return config.map((outerItem) => {
    return {
      ...outerItem,
      label: typeToNameKey[outerItem.type]
    }
  })
}

function formatJobSourceFormValueToConfig(formValue: JobSourceConfig[] = []) {
  return formValue.map((it) => {
    it = { ...it }
    delete it.label
    return it
  })
}

const combineRecommendJobFilterTypeOptions = [
  {
    name: '自由组合（多选合并查询，城市／薪资逐项分组）',
    value: 1
  },
  {
    name: '按固定组合逐行查找',
    value: 2
  }
]

const needToCheckRuntimeDependenciesHandler = () => {
  router.replace('/')
}
electron.ipcRenderer.on('need-to-check-runtime-dependencies', needToCheckRuntimeDependenciesHandler)
onUnmounted(() => {
  electron.ipcRenderer.removeListener(
    'need-to-check-runtime-dependencies',
    needToCheckRuntimeDependenciesHandler
  )
})

const isStopButtonLoading = ref(false)
const handleStopButtonClick = async () => {
  gtagRenderer('gascwb_stop_button_clicked')
  isStopButtonLoading.value = true
  try {
    await electron.ipcRenderer.invoke('stop-geek-auto-start-chat-with-boss')
    runningOverlayRef.value?.hide()
  } finally {
    isStopButtonLoading.value = false
  }
}

const commonJobConditionConfig = ref<Partial<FilterForm>>({})
const unListenCommonJobConditionConfig = ipcRenderer.on(
  'common-job-condition-config-updated',
  (_, { config, targetCompanies, blockedCompanies }) => {
    commonJobConditionConfig.value = {
      ...config,
      expectCompanies: config?.expectCompanies?.map((it) => it.trim())?.join(',') ?? ''
    }
    if (!formContent.value.fieldsForUseCommonConfig.expectCompanies && Array.isArray(targetCompanies)) formContent.value.expectCompanies = targetCompanies.join(',')
    if (!formContent.value.fieldsForUseCommonConfig.blockCompanyNameRegExpStr && typeof blockedCompanies === 'string') formContent.value.blockCompanyNameRegExpStr = blockedCompanies
  }
)
onUnmounted(() => {
  unListenCommonJobConditionConfig()
})

const handleClickConfigCommonJobCondition = async ({ entry }) => {
  gtagRenderer('config_cjc_clicked', { entry })
  try {
    await router.push('/main-layout/CommonJobConditionConfig')
  } catch (err) {
    console.log(err)
  }
}

</script>

<style scoped lang="scss">
.settings-subtitle { font-size: 13.5px; font-weight: 600; color: var(--el-text-color-primary); margin: 0 0 8px; }
.rhythm-box { padding: 14px 16px; border-radius: 10px; background-color: var(--el-fill-color-lighter); border: 1px solid var(--el-border-color-lighter); }
.rest-grid { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
.rest-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 13px; color: var(--el-text-color-regular); transition: opacity 0.15s ease; }
.rest-row.muted { opacity: 0.55; }
.rest-row :deep(.el-input-number) { width: 118px; }
.schedule-subtitle { margin-top: 16px; }
.filter-help-content { max-width: 440px; line-height: 1.7; }
.filter-help-content p { margin: 0; }
.filter-help-content p + p { margin-top: 8px; }
.filter-top-bar { display: flex; align-items: flex-end; gap: 12px 16px; flex-wrap: wrap; padding: 12px 14px; border-radius: 10px; background-color: var(--el-fill-color-lighter); border: 1px solid var(--el-border-color-lighter); }
.filter-top-field { display: flex; flex-direction: column; gap: 4px; }
.sub-field-label { font-size: 12.5px; color: var(--el-text-color-secondary); margin-bottom: 4px; }
.sub-section-title { font-size: 14px; font-weight: 600; color: var(--el-text-color-primary); display: inline-flex; align-items: center; gap: 6px; }
.mb8 { margin-bottom: 8px; }
.combo-badge { margin-left: auto; font-size: 12.5px; color: var(--el-text-color-secondary); padding-bottom: 6px; }
.warn-inline { color: var(--el-color-warning); margin-left: 4px; font-weight: 500; }
.city-picker-inline { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.exact-filter-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
.exact-salary-range { display: flex; align-items: center; gap: 8px; margin-top: 8px; width: 100%; }
.exact-salary-range .el-input-number { flex: 1; min-width: 0; }
.local-check-strategies { margin-top: 14px; border-top: 1px solid var(--el-border-color-lighter); border-bottom: 0; }
.local-check-strategies :deep(.el-collapse-item__header) { background: transparent; border-bottom: 0; font-weight: 500; }
.local-check-strategies :deep(.el-collapse-item__wrap) { background: transparent; border-bottom: 0; }
.strategy-group + .strategy-group { margin-top: 14px; padding-top: 14px; border-top: 1px dashed var(--el-border-color-lighter); }
.strategy-caption { margin: 0 0 8px; font-size: 12.5px; color: var(--el-text-color-secondary); }
.company-head-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; width: 100%; margin-bottom: 8px; }
.company-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.company-actions .el-button + .el-button { margin-left: 0; }
.soft-divider { height: 1px; background-color: var(--el-border-color-lighter); margin: 18px 0; }
.block-company-filter-wrap { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(260px, 0.9fr); gap: 16px; align-items: start; }
@media (max-width: 900px) { .block-company-filter-wrap { grid-template-columns: minmax(0, 1fr); } }
.block-company-strategy { padding: 12px 14px; border-radius: 10px; background-color: var(--el-fill-color-lighter); border: 1px solid var(--el-border-color-lighter); }
.geek-auto-start-run-with-boss__wrap {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  color: var(--el-text-color-primary);
  font-family: var(--ggr-font-sans);
  font-size: 14px;
  .page-heading { max-width: 1040px; margin: 0 auto 20px; }
  .section-title { font-size: 15px; font-weight: 600; margin-bottom: 14px; display: flex; align-items: center; gap: 6px; }
  .config-section { border: 1px solid var(--el-border-color-light); border-radius: 12px; box-shadow: var(--ggr-card-shadow); background: var(--el-bg-color); }
  .config-section :deep(.el-card__body) { padding: 20px 24px; }
  :deep(.job-source-drag-orderer .list-group-item) { box-shadow: none; border-radius: 8px; background: var(--el-bg-color); }
  .settings-footer { padding: 12px 24px; border-top: 1px solid var(--el-border-color-light); background: var(--ggr-footer-bg); backdrop-filter: blur(8px); flex-shrink: 0; }
  .footer-inner { display: flex; align-items: center; justify-content: space-between; gap: 16px; max-width: 1040px; margin: 0 auto; }
  :deep(.el-checkbox__label) { white-space: normal; line-height: 1.6; }
  .main__wrap {
    position: relative;
    z-index: 0;
    height: 100%;
    min-height: 0;
    .form-wrap {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      min-height: 0;
      padding: 24px 32px;
      .config-section + .config-section {
        margin-top: 16px;
      }
      :deep(.el-form) {
        max-width: 1040px;
        margin: 0 auto;
      }
    }
    .no-active-definition-text-slider {
      ::v-deep(.el-slider__marks-text) {
        font-size: 12px;
        margin-top: 22px;
        &::before {
          content: '';
          bottom: calc(100% - 6px);
          z-index: -1;
          left: 50%;
          transform: translateX(-50%);
          position: absolute;
          display: block;
          width: 2px;
          height: 20px;
          background-image: linear-gradient(var(--el-slider-runway-bg-color), transparent);
        }
      }
      ::v-deep(.el-slider__stop) {
        box-shadow: 0 0 0 2px var(--el-color-primary-light-7);
      }
      ::v-deep(.el-slider__button) {
        transform: rotate(45deg);
        border-radius: 10px 10px 0px 10px;
        --el-slider-button-size: 18px;
      }
    }
  }
}
</style>

<style lang="scss">
.form-wrap.geek-auto-start-run-with-boss {
  .el-form-item__error.el-form-item__error {
    font-size: 12px;
    line-height: 1.2em;
  }
  .job-detail-filter-wrap .el-form-item__error,
  .block-company-filter-wrap .el-form-item__error {
    position: static;
    word-break: break-word;
  }
  .job-source-form-item {
    margin-bottom: 0;
    .job-source-drag-orderer {
      margin-top: 10px;
      background-color: var(--el-fill-color-lighter);
      padding: 16px;
      border: 1px solid var(--el-card-border-color);
      border-radius: 8px;
    }
    &.is-error {
      margin-bottom: 18px;
      .el-input__wrapper {
        box-shadow: 0 0 0 1px var(--el-border-color) inset;
      }
      .job-source-drag-orderer {
        background-color: var(--el-color-danger-light-9);
        border: 1px solid var(--el-color-danger);
      }
    }
  }
}

.running-overlay__wrap {
  position: absolute;
  inset: 0;
}
</style>

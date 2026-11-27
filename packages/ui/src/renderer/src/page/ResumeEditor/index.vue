<template>
  <div class="resume-editor-page">
    <div class="main-wrapper">
      <main>
        <header class="ggr-page-header" style="margin-bottom: 14px">
          <div>
            <h2 class="ggr-page-title">本地简历编辑</h2>
            <p class="ggr-page-desc">供 AI 职位匹配、HR 自动回复与跟进消息参考，仅保存在本地</p>
          </div>
        </header>
        <el-alert type="info" :closable="false" mb20px line-height-1.5em>
          <ul pl16px m0>
            <li>
              建议尽量完整填写工作与项目经历，信息越具体，AI 岗位筛选和沟通回复越贴合真实情况。
            </li>
            <li>期望薪资仅用于岗位匹配评估，不会在自动跟进消息中对外透露。</li>
          </ul>
        </el-alert>
        <el-form
          ref="formRef"
          :model="formContentForElForm"
          :rules="formRulesForElForm"
          label-position="top"
          class="resume-editor-form"
          :validate-on-rule-change="false"
        >
          <div
            :style="{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px'
            }"
          >
            <el-form-item label="姓名">
              <el-input v-model="formContent.name" font-size-12px></el-input>
            </el-form-item>
            <el-form-item label="工作年限">
              <el-input v-model="formContent.workYearDesc" font-size-12px></el-input>
            </el-form-item>
            <el-form-item label="期望职位">
              <el-input v-model="formContent.expectJob" font-size-12px></el-input>
            </el-form-item>
            <el-form-item label="期望薪资（k）">
              <div
                :style="{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  width: '100%'
                }"
              >
                <el-input v-model="formContent.expectSalary[0]" placeholder="最低薪资" />
                <el-input v-model="formContent.expectSalary[1]" placeholder="最高薪资" />
              </div>
            </el-form-item>
          </div>

          <el-form-item label="个人优势">
            <el-input
              v-model="formContent.userDescription"
              type="textarea"
              :autosize="{
                minRows: 6,
                maxRows: 8
              }"
              font-size-12px
            ></el-input>
          </el-form-item>
          <el-form-item>
            <div class="el-form-item__label">
              工作经历
              <el-button size="small" :icon="Plus" @click="addWorkExp">新增一条</el-button>
            </div>
            <div v-for="(exp, index) in formContent.geekWorkExpList" :key="index">
              <div
                :style="{
                  display: 'flex',
                  gap: '12px'
                }"
              >
                <div
                  :style="{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    height: 'fit-content',
                    marginTop: '10px'
                  }"
                >
                  <el-button
                    :disabled="index <= 0"
                    style="margin: 0"
                    circle
                    size="small"
                    :icon="ArrowUp"
                    @click="moveWorkExpUp(index)"
                  />
                  <el-button
                    :disabled="index >= formContent.geekWorkExpList.length - 1"
                    style="margin: 0"
                    circle
                    size="small"
                    :icon="ArrowDown"
                    @click="moveWorkExpDown(index)"
                  />
                  <el-button
                    :disabled="1 >= formContent.geekWorkExpList.length"
                    style="margin: 0"
                    circle
                    size="small"
                    :icon="Delete"
                    @click="removeWorkExp(index)"
                  />
                </div>
                <div style="flex: 1; min-width: 0">
                  <div
                    :style="{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1.25fr 1fr',
                      gap: '10px',
                      width: '100%'
                    }"
                  >
                    <el-form-item
                      label="公司名称"
                      style="margin-bottom: 18px"
                      :prop="`geekWorkExpList_${index}_company`"
                    >
                      <el-input v-model="exp.company" />
                    </el-form-item>
                    <el-form-item label="任职时间" style="margin-bottom: 18px">
                      <div
                        :style="{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '8px',
                          width: '100%'
                        }"
                      >
                        <el-date-picker
                          v-model="exp.startYearMon"
                          :style="{ '--el-date-editor-width': 'auto' }"
                          type="month"
                          placeholder="开始月份"
                        />
                        <el-date-picker
                          v-model="exp.endYearMon"
                          :style="{ '--el-date-editor-width': 'auto' }"
                          type="month"
                          placeholder="结束月份"
                        />
                      </div>
                    </el-form-item>
                    <el-form-item label="职务" style="margin-bottom: 18px">
                      <el-input v-model="exp.positionName" />
                    </el-form-item>
                  </div>
                  <el-form-item label="工作描述" style="margin-bottom: 18px">
                    <el-input
                      v-model="exp.workDescription"
                      type="textarea"
                      :autosize="{
                        minRows: 6,
                        maxRows: 8
                      }"
                      font-size-12px
                    />
                  </el-form-item>
                  <el-form-item label="工作业绩">
                    <el-input
                      v-model="exp.performance"
                      type="textarea"
                      :autosize="{
                        minRows: 6,
                        maxRows: 8
                      }"
                      font-size-12px
                    />
                  </el-form-item>
                  <div
                    v-if="index !== formContent.geekWorkExpList.length - 1"
                    class="mt20px mb20px h1px"
                    style="background-color: var(--el-border-color-lighter)"
                  />
                </div>
              </div>
            </div>
          </el-form-item>
          <el-form-item>
            <div class="el-form-item__label">
              项目经历
              <el-button size="small" :icon="Plus" @click="addProjExp">新增一条</el-button>
            </div>
            <div v-for="(proj, index) in formContent.geekProjExpList" :key="index">
              <div
                :style="{
                  display: 'flex',
                  gap: '12px'
                }"
              >
                <div
                  :style="{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    height: 'fit-content',
                    marginTop: '10px'
                  }"
                >
                  <el-button
                    :disabled="index <= 0"
                    style="margin: 0"
                    circle
                    size="small"
                    :icon="ArrowUp"
                    @click="moveProjExpUp(index)"
                  />
                  <el-button
                    :disabled="index >= formContent.geekProjExpList.length - 1"
                    style="margin: 0"
                    circle
                    size="small"
                    :icon="ArrowDown"
                    @click="moveProjExpDown(index)"
                  />
                  <el-button
                    :disabled="1 >= formContent.geekProjExpList.length"
                    style="margin: 0"
                    circle
                    size="small"
                    :icon="Delete"
                    @click="removeProjExp(index)"
                  />
                </div>
                <div style="flex: 1; min-width: 0">
                  <div
                    :style="{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1.25fr',
                      gap: '10px',
                      width: '100%'
                    }"
                  >
                    <el-form-item
                      label="项目名称"
                      style="margin-bottom: 18px"
                      :prop="`geekProjExpList_${index}_name`"
                    >
                      <el-input v-model="proj.name" />
                    </el-form-item>
                    <el-form-item label="项目角色" style="margin-bottom: 18px">
                      <el-input v-model="proj.roleName" />
                    </el-form-item>
                    <el-form-item label="项目时间" style="margin-bottom: 18px">
                      <div
                        :style="{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '8px',
                          width: '100%'
                        }"
                      >
                        <el-date-picker
                          v-model="proj.startYearMon"
                          :style="{ '--el-date-editor-width': 'auto' }"
                          type="month"
                          placeholder="开始月份"
                        />
                        <el-date-picker
                          v-model="proj.endYearMon"
                          :style="{ '--el-date-editor-width': 'auto' }"
                          type="month"
                          placeholder="结束月份"
                        />
                      </div>
                    </el-form-item>
                  </div>
                  <el-form-item label="项目描述" style="margin-bottom: 18px">
                    <el-input
                      v-model="proj.projectDescription"
                      type="textarea"
                      :autosize="{
                        minRows: 6,
                        maxRows: 8
                      }"
                      font-size-12px
                    />
                  </el-form-item>
                  <el-form-item label="项目业绩">
                    <el-input
                      v-model="proj.performance"
                      type="textarea"
                      :autosize="{
                        minRows: 6,
                        maxRows: 8
                      }"
                      font-size-12px
                    />
                  </el-form-item>
                  <div
                    v-if="index !== formContent.geekProjExpList.length - 1"
                    class="mt20px mb20px h1px"
                    style="background-color: var(--el-border-color-lighter)"
                  />
                </div>
              </div>
            </div>
          </el-form-item>
        </el-form>
      </main>
    </div>
    <footer class="resume-footer">
      <div class="resume-footer__inner">
        <div></div>
        <div flex gap-8px>
          <el-button @click="handleCancel">取消</el-button>
          <el-button type="primary" @click="handleSubmit">保存简历</el-button>
        </div>
      </div>
    </footer>
  </div>
</template>

<script lang="ts" setup>
import { ElForm, ElButton, ElAlert, ElMessageBox } from 'element-plus'
import { ref, onMounted, computed } from 'vue'
import { ArrowUp, ArrowDown, Delete, Plus } from '@element-plus/icons-vue'
import { gtagRenderer as baseGtagRenderer } from '@renderer/utils/gtag'
import { type ResumeContent, resumeContentEnoughDetect } from '../../../../common/utils/resume'

const formRef = ref<InstanceType<typeof ElForm>>()

const gtagRenderer = (name, params?: object) => {
  return baseGtagRenderer(name, {
    scene: 'resume-editor',
    ...params
  })
}

const getEmptyFormContent = () => {
  const o: any = {
    expectJob: '',
    name: '',
    userDescription: '',
    workYearDesc: '',
    expectSalary: ['', ''],
    geekWorkExpList: [],
    geekProjExpList: []
  }
  o.geekProjExpList = [getNewProjExpItem()]
  o.geekWorkExpList = [getNewWorkExpItem()]

  return o as ResumeContent
}
const formContent = ref<ResumeContent>(getEmptyFormContent())

const formContentForElForm = computed(() => {
  const valueMap = {}
  formContent.value.geekWorkExpList?.forEach((item, i) => {
    valueMap[`geekWorkExpList_${i}_company`] = item.company
  })
  formContent.value.geekProjExpList?.forEach((item, i) => {
    valueMap[`geekProjExpList_${i}_name`] = item.name
  })
  return valueMap
})
const formRulesForElForm = computed(() => {
  const valueMap = {}
  formContent.value.geekWorkExpList.forEach((_, i) => {
    valueMap[`geekWorkExpList_${i}_company`] = [
      {
        required: true,
        message: '请输入公司名称'
      },
      {
        trigger: 'blur',
        validator(_, value, cb) {
          if (!value.trim()) {
            cb(`请输入公司名称`)
          } else {
            cb()
          }
        }
      }
    ]
  })
  formContent.value.geekProjExpList.forEach((_, i) => {
    valueMap[`geekProjExpList_${i}_name`] = [
      {
        required: true,
        message: '请输入项目名称'
      },
      {
        trigger: 'blur',
        validator(_, value, cb) {
          if (!value.trim()) {
            cb(`请输入项目名称`)
          } else {
            cb()
          }
        }
      }
    ]
  })
  return valueMap
})
const handleCancel = () => {
  gtagRenderer('cancel_clicked')
  electron.ipcRenderer.send('close-resume-editor')
  gtagRenderer('cancel_done')
}
const handleSubmit = async () => {
  await formRef.value?.validate()
  gtagRenderer('submit_clicked')
  if (
    !resumeContentEnoughDetect({
      content: formContent.value
    })
  ) {
    try {
      gtagRenderer('rc_not_enough_dialog_show')
      await ElMessageBox.confirm(
        `当前简历内容较少（总字数不足 800 字），可能影响 AI 岗位匹配准确度与自动跟进消息质量。<br /><br />是否仍然保存？`,
        '简历内容偏少',
        {
          cancelButtonText: '继续补充',
          confirmButtonText: '仍然保存',
          dangerouslyUseHTMLString: true
        }
      )
    } catch {
      return
    }
  }
  electron.ipcRenderer.invoke('save-resume-content', JSON.parse(JSON.stringify(formContent.value)))
  gtagRenderer('submit_done')
}

onMounted(async () => {
  try {
    const savedFileContent = await electron.ipcRenderer.invoke('fetch-resume-content')
    if (!savedFileContent) {
      return
    }
    for (const k of Object.keys(formContent.value)) {
      formContent.value[k] = savedFileContent[k]
    }
    if (!formContent.value.expectSalary) {
      formContent.value.expectSalary = ['', '']
    }
    if (!formContent.value.expectSalary?.[0] || /\D/.test(formContent.value.expectSalary?.[0])) {
      formContent.value.expectSalary[0] = ''
    }
    if (!formContent.value.expectSalary?.[1] || /\D/.test(formContent.value.expectSalary?.[1])) {
      formContent.value.expectSalary[1] = ''
    }
    if (!formContent.value.geekProjExpList?.length) {
      formContent.value.geekProjExpList = [getNewProjExpItem()]
    }
    if (!formContent.value.geekWorkExpList?.length) {
      formContent.value.geekWorkExpList = [getNewWorkExpItem()]
    }
  } catch (err) {
    formContent.value = getEmptyFormContent()
  }
})

// function handlePresetClick(selected: (typeof llmPresetList)[number]) {}

// #region edit work exp list
function getNewWorkExpItem() {
  return {
    company: '',
    endYearMon: '',
    positionName: '',
    startYearMon: '',
    performance: '',
    workDescription: ''
  }
}
function addWorkExp() {
  formContent.value.geekWorkExpList.push(getNewWorkExpItem())
  gtagRenderer('resume_work_exp_added')
}
function moveWorkExpUp(index) {
  ;[formContent.value.geekWorkExpList[index], formContent.value.geekWorkExpList[index - 1]] = [
    formContent.value.geekWorkExpList[index - 1],
    formContent.value.geekWorkExpList[index]
  ]
  gtagRenderer('resume_work_exp_moved_up')
}

function moveWorkExpDown(index) {
  ;[formContent.value.geekWorkExpList[index], formContent.value.geekWorkExpList[index + 1]] = [
    formContent.value.geekWorkExpList[index + 1],
    formContent.value.geekWorkExpList[index]
  ]
  gtagRenderer('resume_work_exp_moved_down')
}

function removeWorkExp(index) {
  formContent.value.geekWorkExpList.splice(index, 1)
  gtagRenderer('resume_work_exp_removed')
}
// #endregion

// #region edit proj list
function getNewProjExpItem() {
  return {
    name: '',
    endYearMon: '',
    roleName: '',
    startYearMon: '',
    performance: '',
    projectDescription: ''
  }
}
function addProjExp() {
  formContent.value.geekProjExpList.push(getNewProjExpItem())
  gtagRenderer('resume_proj_exp_added')
}
function moveProjExpUp(index) {
  ;[formContent.value.geekProjExpList[index], formContent.value.geekProjExpList[index - 1]] = [
    formContent.value.geekProjExpList[index - 1],
    formContent.value.geekProjExpList[index]
  ]
  gtagRenderer('resume_proj_exp_moved_up')
}

function moveProjExpDown(index) {
  ;[formContent.value.geekProjExpList[index], formContent.value.geekProjExpList[index + 1]] = [
    formContent.value.geekProjExpList[index + 1],
    formContent.value.geekProjExpList[index]
  ]
  gtagRenderer('resume_proj_exp_moved_down')
}

function removeProjExp(index) {
  formContent.value.geekProjExpList.splice(index, 1)
  gtagRenderer('resume_proj_exp_removed')
}
// #endregion

onMounted(() => {
  gtagRenderer('resume_editor_mounted')
})
</script>

<style lang="scss" scoped>
.resume-editor-page {
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  height: 100vh;
  .main-wrapper {
    flex: 1;
    overflow: auto;
    main {
      margin: 0 auto;
      max-width: 780px;
      padding: 22px 24px 28px;
      box-sizing: border-box;
    }
  }
  .resume-footer {
    padding: 12px 24px;
    background-color: var(--el-bg-color);
    border-top: 1px solid var(--el-border-color-light);
  }
  .resume-footer__inner {
    max-width: 780px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}
</style>

<style lang="scss">
.resume-editor-form.el-form {
  .el-form-item__error--inline {
    margin-left: 0;
    margin-top: 10px;
  }
}
</style>

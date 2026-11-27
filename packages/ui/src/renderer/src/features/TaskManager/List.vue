<template>
  <div class="ggr-page">
    <header class="ggr-page-header">
      <div>
        <h2 class="ggr-page-title">运行中的后台任务</h2>
        <p class="ggr-page-desc">查看当前守护进程托管的任务状态、实时画面与进程信息</p>
      </div>
    </header>
    <template v-if="runningTasks.length">
      <TaskManagerItem v-for="task in runningTasks" :key="task.workerId" :task="task" />
    </template>
    <el-empty v-else description="当前没有正在运行的后台任务" />
  </div>
</template>

<script lang="ts" setup>
import { useTaskManagerStore } from '@renderer/store'
import { computed } from 'vue'
import TaskManagerItem from './Item.vue'

const taskManagerStore = useTaskManagerStore()
const runningTasks = computed(() => taskManagerStore.runningTasks || [])
</script>

<template>
  <div class="template-actions">
    <el-button size="small" @click="save">保存为模板</el-button>
    <el-dropdown trigger="click" @visible-change="visible => visible && load()" @command="apply">
      <el-button size="small" :disabled="busy">套用模板 <el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item v-if="!items.length" disabled>暂无保存的模板</el-dropdown-item>
          <el-dropdown-item v-for="item in items" :key="item.name" :command="item" class="template-item">
            <span class="template-name">{{ item.name }}</span>
            <el-button class="template-delete" link type="danger" size="small" :aria-label="`删除模板 ${item.name}`" title="删除模板" @click.stop="remove(item)">×</el-button>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { ArrowDown } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
const props = withDefaults(defineProps<{ kind: string; value: unknown; defaults?: Array<{name: string; data: unknown}> }>(), { defaults: () => [] })
const emit = defineEmits<{ apply: [value: any] }>()
const items = ref<any[]>([])
const busy = ref(false)
async function load() {
  try { items.value = await window.electron.ipcRenderer.invoke('initialize-personal-templates', { kind: props.kind, defaults: JSON.parse(JSON.stringify(props.defaults)) }); return true }
  catch (error) { ElMessage.error(String(error)); return false }
}
async function save() {
  try {
    if (!await load()) return
    const data = JSON.parse(JSON.stringify(props.value))
    const { value } = await ElMessageBox.prompt('为当前内容起一个名称', '保存个人模板', { inputPlaceholder: '例如：Agent 实习', inputValidator: value => !!value?.trim() && value.trim().length <= 60 || '请输入 1–60 个字符的名称' })
    busy.value = true
    await window.electron.ipcRenderer.invoke('save-personal-template', { kind: props.kind, name: value.trim(), data })
    await load()
    ElMessage.success('模板已保存')
  } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(String(error)) }
  finally { busy.value = false }
}
async function apply(item: any) {
  try {
    await ElMessageBox.confirm(`使用“${item.name}”将替换本项当前内容。`, '使用模板', { confirmButtonText: '使用', cancelButtonText: '取消' })
    emit('apply', JSON.parse(JSON.stringify(item.data)))
  } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(String(error)) }
}
async function remove(item: any) {
  try {
    await ElMessageBox.confirm(`删除模板“${item.name}”？`, '删除模板', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
    await window.electron.ipcRenderer.invoke('delete-personal-template', { kind: props.kind, name: item.name })
    await load()
    ElMessage.success('模板已删除')
  } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(String(error)) }
}
</script>
<style scoped>
.template-actions { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.template-actions :deep(.el-button + .el-button) { margin-left: 0; }
.template-name { max-width: 180px; overflow: hidden; text-overflow: ellipsis; margin-right: 12px; }
.template-delete { opacity: 0; pointer-events: none; font-size: 18px; line-height: 1; }
.template-item:hover .template-delete, .template-item:focus-within .template-delete, .template-delete:focus-visible { opacity: 1; pointer-events: auto; }
</style>

<template>
  <div class="reference-picker">
    <el-select
      v-bind="$attrs"
      :model-value="modelValue ?? undefined"
      filterable
      remote
      :remote-method="quickSearch"
      :clearable="clearable"
      :disabled="inheritedDisabled || contextBlocked || committing"
      :loading="loading || resolving"
      :placeholder="effectivePlaceholder"
      :validate-event="false"
      style="width: 100%; min-width: 0"
      @change="choose"
      @visible-change="opened"
    >
      <el-option
        v-for="row in visibleOptions"
        :key="row.warehouseId"
        :value="row.warehouseId"
        :label="label(row)"
        :disabled="row.status !== EnableStatus.Enabled"
      />
      <el-option
        v-if="modelValue != null && !selectedRecord"
        :value="modelValue"
        :label="`#${modelValue}（${resolving ? '加载中' : resolveFailed ? '回显失败，可重试' : '已失效'}）`"
        disabled
      />
    </el-select>
    <el-button
      :icon="Search"
      aria-label="打开仓库参照"
      :disabled="inheritedDisabled || contextBlocked || committing || resolving"
      @click="openDialog"
    />
    <el-button v-if="failed" text type="danger" :disabled="inheritedDisabled || resolving || committing" @click="retry">
      重试
    </el-button>
    <WarehousePickerDialog v-model="dialogOpen" :selected-record="selectedRecord" @confirm="accept" />
  </div>
</template>
<script setup lang="ts" name="WarehousePicker">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { ElMessage, useFormDisabled, useFormItem } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { useDebounceFn } from '@vueuse/core'
import { searchWarehouseReferences, resolveWarehouseReferences } from '@/api/masterdata/storage-reference'
import { EnableStatus } from '@/types/api/common'
import type { WarehousePickerProps, WarehouseReference } from './types'

import WarehousePickerDialog from './WarehousePickerDialog.vue'
defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<WarehousePickerProps>(), {
  disabled: undefined,
  clearable: true,
  placeholder: '输入编码或名称'
})
const emit = defineEmits<{ 'update:modelValue': [value: number | null]; change: [records: WarehouseReference[]] }>()
const inheritedDisabled = useFormDisabled(),
  { formItem } = useFormItem()
const cache = shallowRef(new Map<number, WarehouseReference>()),
  choices = shallowRef<WarehouseReference[]>([])
const selectedRecord = computed(() => (props.modelValue == null ? undefined : cache.value.get(props.modelValue)))
const visibleOptions = computed(() => [
  ...new Map(
    [...(selectedRecord.value ? [selectedRecord.value] : []), ...choices.value].map((row) => [row.warehouseId, row])
  ).values()
])
const resolving = ref(false),
  loading = ref(false),
  committing = ref(false),
  resolveFailed = ref(false),
  searchFailed = ref(false),
  dialogOpen = ref(false)
const failed = computed(() => resolveFailed.value || searchFailed.value)
let alive = true,
  valueSequence = 0,
  searchSequence = 0,
  commitSequence = 0,
  keyword = ''
const contextBlocked = computed(() => false)
const effectivePlaceholder = computed(() => props.placeholder)
function label(row: WarehouseReference) {
  return `${row.warehouseCode} / ${row.warehouseName}${row.status !== EnableStatus.Enabled ? '（停用）' : ''}`
}
function remember(records: WarehouseReference[]) {
  cache.value = new Map([...cache.value, ...records.map((row) => [row.warehouseId, row] as const)])
}
async function hydrate() {
  const current = ++valueSequence,
    id = props.modelValue
  resolving.value = true
  resolveFailed.value = false
  try {
    const records = id == null ? [] : (await resolveWarehouseReferences([id])).data
    if (!alive || current !== valueSequence) return
    const next = new Map(cache.value)
    if (id != null) next.delete(id)
    records.forEach((row) => next.set(row.warehouseId, row))
    cache.value = next
  } catch {
    if (alive && current === valueSequence) resolveFailed.value = true
  } finally {
    if (alive && current === valueSequence) resolving.value = false
  }
}
async function search(text: string) {
  const current = ++searchSequence
  if (contextBlocked.value) return
  loading.value = true
  try {
    const { data } = await searchWarehouseReferences({ pageNum: 1, pageSize: 20, keyword: text.trim() || undefined })
    if (!alive || current !== searchSequence) return
    choices.value = data.rows
    remember(data.rows)
    searchFailed.value = false
  } catch {
    if (alive && current === searchSequence) searchFailed.value = true
  } finally {
    if (alive && current === searchSequence) loading.value = false
  }
}
const debounced = useDebounceFn((text: string) => {
  if (alive) void search(text)
}, 300)
function quickSearch(text: string) {
  keyword = text
  searchSequence++
  loading.value = false
  void debounced(text)
}
function opened(open: boolean) {
  if (open) void search(keyword)
  else keyword = ''
}
function accept(row: WarehouseReference) {
  if (inheritedDisabled.value || contextBlocked.value || row.status !== EnableStatus.Enabled) return
  remember([row])
  if (props.modelValue === row.warehouseId) return
  emit('update:modelValue', row.warehouseId)
  emit('change', [row])
  void formItem?.validate('change').catch(() => {})
}
async function choose(value: unknown) {
  if (inheritedDisabled.value || contextBlocked.value || committing.value) return
  if (value == null || value === '') {
    if (props.modelValue == null) return
    emit('update:modelValue', null)
    emit('change', [])
    void formItem?.validate('change').catch(() => {})
    return
  }
  if (typeof value !== 'number') return
  const current = ++commitSequence
  committing.value = true
  try {
    const { data } = await resolveWarehouseReferences([value])
    if (!alive || current !== commitSequence || inheritedDisabled.value) return
    const record = data[0]
    if (!record || record.status !== EnableStatus.Enabled) {
      ElMessage.warning('选中的仓库已失效或停用，请重新选择')
      return
    }
    accept(record)
    searchFailed.value = false
  } catch {
    if (alive && current === commitSequence) searchFailed.value = true
  } finally {
    if (alive && current === commitSequence) committing.value = false
  }
}
async function openDialog() {
  await hydrate()
  if (alive && !resolveFailed.value && !contextBlocked.value && !inheritedDisabled.value) dialogOpen.value = true
}
async function retry() {
  await hydrate()
  if (!resolveFailed.value) await search(keyword)
}
watch(
  () => props.modelValue,
  () => {
    searchSequence++
    commitSequence++
    loading.value = false
    committing.value = false
    choices.value = []
    dialogOpen.value = false

    void hydrate()
  },
  { immediate: true }
)
watch(inheritedDisabled, (disabled) => {
  if (disabled) {
    dialogOpen.value = false
    commitSequence++
    committing.value = false
  }
})
onBeforeUnmount(() => {
  alive = false
  valueSequence++
  searchSequence++
  commitSequence++
})
</script>
<style scoped>
.reference-picker {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
}
.reference-picker > :first-child {
  flex: 1;
  min-width: 0;
}
</style>

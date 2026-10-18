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
        :key="row.locationId"
        :value="row.locationId"
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
      aria-label="打开货位参照"
      :disabled="inheritedDisabled || contextBlocked || committing || resolving"
      @click="openDialog"
    />
    <el-button v-if="failed" text type="danger" :disabled="inheritedDisabled || resolving || committing" @click="retry">
      重试
    </el-button>
    <LocationPickerDialog
      v-model="dialogOpen"
      :warehouse-id="warehouseId"
      :selected-record="selectedRecord"
      @confirm="accept"
    />
  </div>
</template>
<script setup lang="ts" name="LocationPicker">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { ElMessage, useFormDisabled, useFormItem } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { useDebounceFn } from '@vueuse/core'
import {
  searchLocationReferences,
  resolveLocationReferences,
  getLocationWarehouseContext
} from '@/api/masterdata/storage-reference'
import { EnableStatus } from '@/types/api/common'
import type { LocationPickerProps, LocationReference } from './types'
import type { WarehouseReference } from '@/types/api/masterdata/storage-reference'
import LocationPickerDialog from './LocationPickerDialog.vue'
defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<LocationPickerProps>(), {
  disabled: undefined,
  clearable: true,
  placeholder: '输入编码或名称'
})
const emit = defineEmits<{ 'update:modelValue': [value: number | null]; change: [records: LocationReference[]] }>()
const inheritedDisabled = useFormDisabled(),
  { formItem } = useFormItem()
const cache = shallowRef(new Map<number, LocationReference>()),
  choices = shallowRef<LocationReference[]>([])
const selectedRecord = computed(() => (props.modelValue == null ? undefined : cache.value.get(props.modelValue)))
const visibleOptions = computed(() => [
  ...new Map(
    [...(selectedRecord.value ? [selectedRecord.value] : []), ...choices.value].map((row) => [row.locationId, row])
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
const context = shallowRef<WarehouseReference>()
const contextBlocked = computed(
  () =>
    !props.warehouseId ||
    context.value?.warehouseId !== props.warehouseId ||
    context.value.status !== EnableStatus.Enabled ||
    !context.value.locationEnabled
)
const effectivePlaceholder = computed(() =>
  !props.warehouseId
    ? '请先选择仓库'
    : resolving.value
      ? '加载仓库信息…'
      : failed.value && !context.value
        ? '仓库信息加载失败'
        : context.value?.status === '1'
          ? '所属仓库已停用'
          : context.value && !context.value.locationEnabled
            ? '所属仓库未启用货位管理'
            : props.placeholder
)
function label(row: LocationReference) {
  const state =
    row.status !== EnableStatus.Enabled
      ? '（停用）'
      : context.value?.status === EnableStatus.Disabled
        ? '（所属仓库已停用）'
        : ''
  return `${row.locationCode} / ${row.locationName}${state}`
}
function remember(records: LocationReference[]) {
  cache.value = new Map([...cache.value, ...records.map((row) => [row.locationId, row] as const)])
}
async function hydrate() {
  const current = ++valueSequence,
    id = props.modelValue
  resolving.value = true
  resolveFailed.value = false
  try {
    if (!props.warehouseId) {
      context.value = undefined
      if (id != null) {
        const next = new Map(cache.value)
        next.delete(id)
        cache.value = next
      }
      return
    }
    const { data: parent } = await getLocationWarehouseContext(props.warehouseId)
    if (!alive || current !== valueSequence) return
    context.value = parent
    const records = id == null ? [] : (await resolveLocationReferences(props.warehouseId!, [id])).data
    if (!alive || current !== valueSequence) return
    const next = new Map(cache.value)
    if (id != null) next.delete(id)
    records.forEach((row) => next.set(row.locationId, row))
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
    const { data } = await searchLocationReferences({
      pageNum: 1,
      pageSize: 20,
      keyword: text.trim() || undefined,
      warehouseId: props.warehouseId!
    })
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
function accept(row: LocationReference) {
  if (
    inheritedDisabled.value ||
    contextBlocked.value ||
    row.status !== EnableStatus.Enabled ||
    row.warehouseId !== props.warehouseId
  )
    return
  remember([row])
  if (props.modelValue === row.locationId) return
  emit('update:modelValue', row.locationId)
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
    const { data: parent } = await getLocationWarehouseContext(props.warehouseId!)
    if (parent.status !== '0' || !parent.locationEnabled) {
      ElMessage.warning('所属仓库已停用或未启用货位管理，请重新选择')
      return
    }
    const { data } = await resolveLocationReferences(props.warehouseId!, [value])
    if (!alive || current !== commitSequence || inheritedDisabled.value) return
    const record = data[0]
    if (!record || record.status !== EnableStatus.Enabled) {
      ElMessage.warning('选中的货位已失效或停用，请重新选择')
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
  () => [props.modelValue, props.warehouseId],
  () => {
    searchSequence++
    commitSequence++
    loading.value = false
    committing.value = false
    choices.value = []
    dialogOpen.value = false
    context.value = undefined
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

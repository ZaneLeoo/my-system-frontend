<template>
  <div class="item-picker">
    <el-select
      v-bind="$attrs"
      :model-value="selectValue"
      :multiple="multipleEnabled"
      :multiple-limit="100"
      filterable
      remote
      :remote-method="quickSearch"
      :clearable="clearable ?? true"
      :disabled="inheritedDisabled || committing"
      :loading="loading || resolving"
      :placeholder="placeholder ?? '输入编码、名称或规格'"
      :validate-event="false"
      style="width: 100%; min-width: 0"
      @change="quickChoose"
      @visible-change="visibleChanged"
    >
      <el-option
        v-for="item in visibleOptions"
        :key="item.itemId"
        :value="item.itemId"
        :label="label(item)"
        :disabled="item.status !== EnableStatus.Enabled || (purchaseOnly && !item.purchaseEnabled)"
      />
      <el-option v-for="id in missingIds" :key="`missing-${id}`" :value="id" :label="`#${id}（已失效）`" disabled />
    </el-select>
    <el-button
      :icon="Search"
      aria-label="打开料品参照"
      :disabled="inheritedDisabled || committing || resolving"
      @click="openDialog"
    />
    <el-button v-if="failed" text type="danger" :disabled="inheritedDisabled || committing" @click="retry">
      重试
    </el-button>
    <ItemPickerDialog
      v-model="dialogOpen"
      :multiple="multipleEnabled"
      :purchase-only="Boolean(purchaseOnly)"
      :selected-ids="ids"
      :selected-records="selectedRecords"
      @confirm="accept"
    />
  </div>
</template>
<script setup lang="ts" name="ItemPicker" generic="Multiple extends boolean = false">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { ElMessage, useFormDisabled, useFormItem } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { useDebounceFn } from '@vueuse/core'
import { resolveItemReferences, searchItemReferences } from '@/api/masterdata/reference'
import { EnableStatus } from '@/types/api/common'
import type { ItemPickerProps, ItemPickerValue, ItemReference } from './types'
import ItemPickerDialog from './ItemPickerDialog.vue'
defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<ItemPickerProps<Multiple>>(), { disabled: undefined, clearable: true })
// 泛型布尔属性在运行时可能保留为裸属性的空字符串，统一按 Vue 布尔属性语义处理。
const multipleEnabled = computed(() => props.multiple != null && props.multiple !== false)
const emit = defineEmits<{
  'update:modelValue': [value: ItemPickerValue<Multiple>]
  change: [records: ItemReference[]]
}>()
const inheritedDisabled = useFormDisabled()
const { formItem } = useFormItem()
const ids = computed<number[]>(() =>
  props.modelValue == null ? [] : Array.isArray(props.modelValue) ? [...new Set(props.modelValue)] : [props.modelValue]
)
const selectValue = computed(() => (multipleEnabled.value ? ids.value : ids.value[0]))
const cached = shallowRef(new Map<number, ItemReference>())
const choices = shallowRef<ItemReference[]>([])
const selectedRecords = computed(() =>
  ids.value.flatMap((id) => {
    const record = cached.value.get(id)
    return record ? [record] : []
  })
)
const missingIds = computed(() => ids.value.filter((id) => !cached.value.has(id)))
const visibleOptions = computed(() => [
  ...new Map([...selectedRecords.value, ...choices.value].map((row) => [row.itemId, row])).values()
])
const loading = ref(false),
  resolving = ref(false),
  committing = ref(false),
  failed = ref(false),
  dialogOpen = ref(false)
let searchSequence = 0,
  valueSequence = 0,
  alive = true
let keyword = ''
function label(row: ItemReference) {
  return `${row.itemCode} / ${row.itemName}${row.specification ? ` / ${row.specification}` : ''}${row.status !== EnableStatus.Enabled ? '（停用）' : ''}`
}
function cache(records: ItemReference[]) {
  cached.value = new Map([...cached.value, ...records.map((row) => [row.itemId, row] as const)])
}
async function hydrate() {
  const sequence = ++valueSequence,
    requested = [...ids.value]
  if (!requested.length) {
    resolving.value = false
    failed.value = false
    return
  }
  if (requested.length > 100) {
    failed.value = true
    ElMessage.warning('每次最多选择 100 个料品')
    return
  }
  resolving.value = true
  try {
    const { data } = await resolveItemReferences(requested)
    if (!alive || sequence !== valueSequence) return
    const next = new Map(cached.value)
    requested.forEach((id) => next.delete(id))
    data.forEach((row) => next.set(row.itemId, row))
    cached.value = next
    failed.value = false
  } catch {
    if (alive && sequence === valueSequence) failed.value = true
  } finally {
    if (alive && sequence === valueSequence) resolving.value = false
  }
}
async function search(value: string) {
  const sequence = ++searchSequence
  loading.value = true
  try {
    const { data } = await searchItemReferences({
      keyword: value.trim() || undefined,
      purchaseOnly: Boolean(props.purchaseOnly),
      pageNum: 1,
      pageSize: 20
    })
    if (!alive || sequence !== searchSequence) return
    choices.value = data.rows
    cache(data.rows)
    failed.value = false
  } catch {
    if (alive && sequence === searchSequence) failed.value = true
  } finally {
    if (alive && sequence === searchSequence) loading.value = false
  }
}
const debouncedSearch = useDebounceFn((value: string) => {
  if (alive) void search(value)
}, 300)
function quickSearch(value: string) {
  keyword = value
  searchSequence++
  loading.value = false
  void debouncedSearch(value)
}
function visibleChanged(open: boolean) {
  if (open) void search(keyword)
  else keyword = ''
}
function accept(records: ItemReference[]) {
  if (inheritedDisabled.value) return
  cache(records)
  const value = (
    multipleEnabled.value ? records.map((row) => row.itemId) : (records[0]?.itemId ?? null)
  ) as ItemPickerValue<Multiple>
  emit('update:modelValue', value)
  emit('change', records)
  void formItem?.validate('change').catch(() => {})
}
async function quickChoose(value: unknown) {
  if (inheritedDisabled.value || committing.value) return
  const selected = Array.isArray(value)
    ? value.filter((id): id is number => typeof id === 'number')
    : typeof value === 'number'
      ? [value]
      : []
  if (selected.length > 100) {
    ElMessage.warning('每次最多选择 100 个料品')
    return
  }
  const sequence = ++valueSequence,
    original = new Set(ids.value)
  resolving.value = false
  committing.value = true
  try {
    const records = selected.length ? (await resolveItemReferences(selected)).data : []
    if (!alive || sequence !== valueSequence || inheritedDisabled.value) return
    if (records.length !== selected.length) {
      ElMessage.warning('选中料品已失效，请重新选择')
      return
    }
    if (
      records.some(
        (row) =>
          !original.has(row.itemId) &&
          (row.status !== EnableStatus.Enabled || (props.purchaseOnly && !row.purchaseEnabled))
      )
    ) {
      ElMessage.warning('料品状态已变化，请重新选择')
      return
    }
    accept(records)
    failed.value = false
  } catch {
    if (alive && sequence === valueSequence) failed.value = true
  } finally {
    if (alive) {
      committing.value = false
    }
  }
}
async function openDialog() {
  await hydrate()
  if (alive && !failed.value && !inheritedDisabled.value) dialogOpen.value = true
}
async function retry() {
  await hydrate()
  await search(keyword)
}
watch(
  ids,
  () => {
    void hydrate()
  },
  { immediate: true }
)
watch(
  () => props.purchaseOnly,
  () => {
    void search(keyword)
  }
)
onBeforeUnmount(() => {
  alive = false
  searchSequence++
  valueSequence++
})
</script>
<style scoped>
.item-picker {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
}
</style>

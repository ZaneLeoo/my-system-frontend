<template>
  <span v-if="unary" class="empty-value">无需填写值</span>
  <template v-else-if="field.component === 'SELECT' || field.component === 'REFERENCE'">
    <el-select
      :model-value="modelValue"
      :multiple="multiple"
      :remote="field.component === 'REFERENCE' && field.optionProvider !== 'categories'"
      :remote-method="remoteSearch"
      filterable
      clearable
      :loading="loading"
      :disabled="disabled"
      :placeholder="`请选择${field.label}`"
      @update:model-value="setValue"
    >
      <el-option
        v-for="option in renderedOptions"
        :key="String(option.value)"
        :label="option.label"
        :value="option.value"
      />
      <template #footer>
        <el-button v-if="total > loadedCount" text :loading="loading" @click="loadMore">加载更多</el-button>
        <el-button v-if="failed" text @click="load()">加载失败，点击重试</el-button>
      </template>
    </el-select>
  </template>
  <el-date-picker
    v-else-if="field.component === 'DATE' || field.component === 'DATETIME'"
    :model-value="between ? [modelValue, value2] : modelValue"
    :type="dateType"
    :value-format="field.component === 'DATE' ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm:ss'"
    :disabled="disabled"
    clearable
    :placeholder="field.label"
    start-placeholder="开始"
    end-placeholder="结束"
    @update:model-value="setDate"
  />
  <template v-else-if="multiple">
    <el-select
      :model-value="modelValue"
      multiple
      filterable
      allow-create
      default-first-option
      clearable
      :disabled="disabled"
      placeholder="输入值后按回车，可添加多项"
      @update:model-value="setValue"
    >
      <el-option v-for="value in arrayValue" :key="String(value)" :label="String(value)" :value="value" />
    </el-select>
  </template>
  <div v-else class="value-range">
    <el-input
      :model-value="modelValue"
      :disabled="disabled"
      :maxlength="field.component === 'NUMBER' ? 30 : Math.min(field.maxLength || 500, 2000)"
      clearable
      :placeholder="field.label"
      @update:model-value="setValue"
    />
    <template v-if="between">
      <span>至</span>
      <el-input
        :model-value="value2"
        :disabled="disabled"
        clearable
        placeholder="结束值"
        @update:model-value="setSecond"
      />
    </template>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, watch, inject } from 'vue'
import { getQueryOptions } from '@/api/system/query'
import { queryOptionLabels } from './useQueryDefinition'
import type { ComputedRef } from 'vue'
import type { QueryFieldSpec, QueryValue, QueryScalar, QueryOption } from '@/types/api/system/query'
const props = defineProps<{
  queryKey: string
  field: QueryFieldSpec
  op: string
  modelValue?: QueryValue
  value2?: QueryScalar
  disabled?: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [value: QueryValue | undefined]
  'update:value2': [value: QueryScalar | undefined]
}>()
const unary = computed(() => ['isNull', 'isNotNull', 'isEmpty', 'isNotEmpty'].includes(props.op))
const multiple = computed(() => ['in', 'notIn'].includes(props.op))
const between = computed(() => props.op === 'between')
const arrayValue = computed(() => (Array.isArray(props.modelValue) ? props.modelValue : []))
const dateType = computed(() =>
  props.field.component === 'DATE'
    ? between.value
      ? 'daterange'
      : 'date'
    : between.value
      ? 'datetimerange'
      : 'datetime'
)
const previewDefinitionId = inject<ComputedRef<number | undefined>>('queryPreviewDefinitionId')
const loadedCount = ref(0)
const options = ref<QueryOption[]>([])
const total = ref(0)
const loading = ref(false)
const failed = ref(false)
let sequence = 0
let keyword = ''
let page = 1
function scalar(value: QueryScalar): QueryScalar {
  if (props.field.dataType === 'INTEGER' && typeof value === 'string' && /^-?\d+$/.test(value)) {
    const numeric = Number(value)
    return Number.isSafeInteger(numeric) ? numeric : value
  }
  return value
}

function setValue(value: QueryValue | undefined) {
  emit(
    'update:modelValue',
    value === '' || value === undefined ? undefined : Array.isArray(value) ? value.map(scalar) : scalar(value)
  )
}
function setSecond(value: string) {
  emit('update:value2', value === '' ? undefined : scalar(value))
}
function setDate(value: string | string[] | null) {
  emit('update:modelValue', Array.isArray(value) ? value[0] : value || undefined)
  emit('update:value2', Array.isArray(value) ? value[1] : undefined)
}
async function load(append = false) {
  if (!props.field.optionProvider) return
  const current = ++sequence
  loading.value = true
  try {
    const { data } = await getQueryOptions(
      props.queryKey,
      props.field.fieldKey,
      keyword,
      page,
      undefined,
      previewDefinitionId?.value
    )
    if (current !== sequence) return
    options.value = append
      ? [...options.value, ...data.rows.filter((row) => !options.value.some((old) => old.value === row.value))]
      : data.rows
    loadedCount.value = append ? loadedCount.value + data.rows.length : data.rows.length
    total.value = data.total
    failed.value = false
    const ids = (Array.isArray(props.modelValue) ? props.modelValue : [props.modelValue]).filter(
      (v): v is number => typeof v === 'number' && !options.value.some((o) => o.value === v)
    )
    if (ids.length && props.field.component === 'REFERENCE') {
      const result = await getQueryOptions(props.queryKey, props.field.fieldKey, '', 1, ids, previewDefinitionId?.value)
      if (current === sequence)
        options.value.push(...result.data.rows.filter((row) => !options.value.some((old) => old.value === row.value)))
    }
  } catch {
    if (current === sequence) {
      failed.value = true
      if (append) page--
    }
  } finally {
    if (current === sequence) loading.value = false
  }
}
const renderedOptions = computed(() => {
  if (props.field.optionProvider !== 'categories') return options.value
  const indexed = new Map(options.value.map((option) => [option.value, option]))
  return options.value.map((option) => {
    const labels = [option.label]
    let parent = option.parentId
    const visited = new Set<QueryScalar>([option.value])
    while (parent && indexed.has(parent) && !visited.has(parent)) {
      visited.add(parent)
      const ancestor = indexed.get(parent)!
      labels.unshift(ancestor.label)
      parent = ancestor.parentId
    }
    return { ...option, label: labels.join(' / ') }
  })
})
watch(
  renderedOptions,
  (values) => {
    for (const option of values)
      queryOptionLabels.set(`${props.queryKey}:${props.field.fieldKey}:${String(option.value)}`, option.label)
  },
  { immediate: true }
)
function remoteSearch(value: string) {
  keyword = value
  page = 1
  void load()
}
function loadMore() {
  page++
  void load(true)
}
watch(
  () => props.field.fieldKey,
  () => {
    keyword = ''
    page = 1
    void load()
  }
)
watch(
  () => props.modelValue,
  () => {
    if (props.field.component === 'REFERENCE' && !loading.value) void load()
  }
)
onMounted(() => void load())
</script>
<style scoped>
.value-range {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 180px;
}
.empty-value {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
</style>

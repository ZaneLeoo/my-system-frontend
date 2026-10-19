<template>
  <div class="query-panel">
    <el-alert v-if="!metadata" title="查询配置尚未加载" type="info" :closable="false">
      <el-button text @click="emit('reload')">重新加载</el-button>
    </el-alert>
    <template v-else>
      <el-form inline @submit.prevent="submit">
        <el-form-item v-for="field in commonFields" :key="field.fieldKey" :label="field.label">
          <el-checkbox
            v-if="isUnary(field.defaultOperator)"
            :model-value="draft[field.fieldKey] === true"
            :disabled="busy"
            @change="setUnary(field.fieldKey, $event)"
          >
            {{ operatorLabels[field.defaultOperator] }}
          </el-checkbox>
          <ConditionValueInput
            v-else
            v-model="draft[field.fieldKey]"
            v-model:value2="rangeEnds[field.fieldKey]"
            :query-key="metadata.queryKey"
            :field="field"
            :op="field.defaultOperator"
            :disabled="busy"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" native-type="submit" :loading="busy">查询</el-button>
          <el-button :disabled="busy" @click="reset">重置</el-button>
          <el-button :disabled="busy" @click="openAdvanced">
            高级查询
            <span v-if="appliedAdvanced?.children?.length">（已生效）</span>
          </el-button>
          <el-button text :disabled="busy" @click="emit('reload')">刷新配置</el-button>
        </el-form-item>
      </el-form>
      <div v-if="summaries.length" class="applied-conditions">
        <span>已生效：</span>
        <el-tag v-for="(text, index) in summaries" :key="index" type="info">{{ text }}</el-tag>
      </div>
      <el-drawer v-model="advancedOpen" title="高级查询" size="min(1080px, 95vw)" :before-close="beforeClose">
        <el-alert
          title="明细关联组中的多个条件要求同一行满足；添加多个关联组可分别匹配不同行。"
          type="info"
          :closable="false"
          class="group-hint"
        />
        <ConditionGroup :node="advancedDraft" :metadata="metadata" :depth="2" />
        <template #footer>
          <el-button @click="advancedOpen = false">取消</el-button>
          <el-button @click="advancedDraft = emptyGroup()">清空高级条件</el-button>
          <el-button type="primary" :disabled="busy" @click="applyAdvanced">应用查询</el-button>
        </template>
      </el-drawer>
    </template>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch, provide } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ConditionValueInput from './ConditionValueInput.vue'
import ConditionGroup from './ConditionGroup.vue'
import { clone, isFilled, operatorLabels, queryOptionLabels } from './useQueryDefinition'
import type { QueryMetadata, QueryValue, QueryScalar, QueryNode, QuerySelection } from '@/types/api/system/query'
const props = defineProps<{
  metadata?: QueryMetadata
  appliedValues: Record<string, unknown>
  appliedAdvanced?: QueryNode
  busy?: boolean
  previewDefinitionId?: number
}>()
const emit = defineEmits<{ submit: [selection: QuerySelection]; reload: [] }>()
provide(
  'queryPreviewDefinitionId',
  computed(() => props.previewDefinitionId)
)
const draft = ref<Record<string, QueryValue | undefined>>({})
const rangeEnds = ref<Record<string, QueryScalar | undefined>>({})
const commonFields = computed(
  () =>
    props.metadata?.fields
      .filter((f) => f.commonVisible && f.sourceKey === 'main')
      .sort((a, b) => a.displayOrder - b.displayOrder) || []
)
function restore() {
  draft.value = {}
  rangeEnds.value = {}
  for (const [key, value] of Object.entries(props.appliedValues))
    if (isFilled(value)) {
      const field = props.metadata?.fields.find((f) => f.fieldKey === key)
      if (field?.defaultOperator === 'between' && Array.isArray(value)) {
        draft.value[key] = value[0]
        rangeEnds.value[key] = value[1]
      } else draft.value[key] = value
    }
}
watch(() => [props.appliedValues, props.metadata], restore, { immediate: true })
function setUnary(key: string, value: unknown) {
  draft.value[key] = value === true ? true : undefined
}
function isUnary(op: string) {
  return ['isNull', 'isNotNull', 'isEmpty', 'isNotEmpty'].includes(op)
}
function values() {
  const result: Record<string, QueryValue> = {}
  for (const [key, value] of Object.entries(draft.value))
    if (isFilled(value)) {
      const field = props.metadata?.fields.find((f) => f.fieldKey === key)
      if (field?.defaultOperator === 'between') {
        if (!isFilled(rangeEnds.value[key])) throw new Error('请填写完整查询区间')
        result[key] = [value as QueryScalar, rangeEnds.value[key]!]
      } else result[key] = value
    }
  return result
}
function submit() {
  try {
    emit('submit', { values: values(), advanced: props.appliedAdvanced })
  } catch (error) {
    ElMessage.warning(error instanceof Error ? error.message : '查询条件无效')
  }
}
function reset() {
  emit('submit', { values: {} })
}
const emptyGroup = (): QueryNode => ({ type: 'group', logic: 'AND', children: [] })
const advancedOpen = ref(false)
const advancedDraft = ref<QueryNode>(emptyGroup())
let advancedSnapshot = ''
function openAdvanced() {
  advancedDraft.value = clone(props.appliedAdvanced || emptyGroup())
  advancedSnapshot = JSON.stringify(advancedDraft.value)
  advancedOpen.value = true
}
function validate(node: QueryNode) {
  if (node.type === 'condition') {
    if (!node.field || !node.op) throw new Error('请选择字段和查询方式')
    if (!['isNull', 'isNotNull', 'isEmpty', 'isNotEmpty'].includes(node.op) && !isFilled(node.value))
      throw new Error('请填写查询值')
    if (node.op === 'between' && !isFilled(node.value2)) throw new Error('请填写完整查询区间')
  } else {
    if (!node.children?.length) throw new Error('请移除空的条件分组')
    node.children.forEach(validate)
  }
}
function applyAdvanced() {
  try {
    if (advancedDraft.value.children?.length) validate(advancedDraft.value)
    emit('submit', {
      values: props.appliedValues as Record<string, QueryValue>,
      advanced: advancedDraft.value.children?.length ? clone(advancedDraft.value) : undefined
    })
    advancedOpen.value = false
  } catch (error) {
    ElMessage.warning(error instanceof Error ? error.message : '条件无效')
  }
}
async function beforeClose(done: () => void) {
  if (JSON.stringify(advancedDraft.value) !== advancedSnapshot) {
    try {
      await ElMessageBox.confirm('放弃尚未应用的高级查询条件？', '关闭高级查询', { type: 'warning' })
    } catch {
      return
    }
  }
  done()
}
function valueLabel(key: string, value: unknown): string {
  if (Array.isArray(value)) return value.map((v) => valueLabel(key, v)).join('、')
  return queryOptionLabels.get(`${props.metadata?.queryKey}:${key}:${String(value)}`) || String(value ?? '')
}
function describe(node: QueryNode): string {
  if (node.type === 'condition') {
    const label = props.metadata?.fields.find((f) => f.fieldKey === node.field)?.label || node.field
    return `${label} ${operatorLabels[node.op || ''] || node.op} ${node.value === undefined ? '' : valueLabel(node.field || '', node.value)}${node.value2 === undefined ? '' : ` 至 ${node.value2}`}`
  }
  const text = (node.children || []).map(describe).join(node.logic === 'OR' ? ' 或者 ' : ' 并且 ')
  return node.type === 'relation'
    ? `${node.mode === 'NOT_EXISTS' ? '不存在' : '存在'}${props.metadata?.relations[node.relation || '']}（${text}）`
    : `（${text}）`
}
const summaries = computed(() => {
  const result = Object.entries(props.appliedValues)
    .filter(([, value]) => isFilled(value))
    .map(([key, value]) => {
      const field = props.metadata?.fields.find((f) => f.fieldKey === key)
      return `${field?.label || key}：${field && isUnary(field.defaultOperator) ? operatorLabels[field.defaultOperator] : valueLabel(key, value)}`
    })
  if (props.appliedAdvanced?.children?.length) result.push(describe(props.appliedAdvanced))
  return result
})
</script>
<style scoped>
.query-panel {
  margin-bottom: 12px;
}
.query-panel :deep(.el-form-item__content > .el-select),
.query-panel :deep(.el-form-item__content > .value-range) {
  width: 220px;
}
.applied-conditions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 10px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.applied-conditions .el-tag {
  height: auto;
  white-space: normal;
  line-height: 1.6;
  max-width: 100%;
}
.group-hint {
  margin-bottom: 16px;
}
</style>

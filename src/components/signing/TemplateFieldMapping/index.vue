<template>
  <div class="field-mapping">
    <div v-if="!modelValue.length" class="mapping-empty">
      <span class="empty-icon">
        <el-icon :size="20"><Connection /></el-icon>
      </span>
      <strong>{{ controls.length ? '该平台模板没有需要映射的控件' : '尚未加载平台控件' }}</strong>
      <span>
        {{
          controls.length
            ? '控件类型无需映射，保存后将原样下发平台。'
            : '在上方的基本信息中选择 e签宝平台模板后，会自动读取模板控件。'
        }}
      </span>
    </div>
    <template v-else>
      <div class="mapping-summary">
        <span>
          已映射
          <strong>{{ mappedCount }}</strong>
          / {{ modelValue.length }} 个控件
        </span>
        <div class="summary-progress">
          <div class="summary-track">
            <div class="summary-fill" :style="{ width: `${mappedPercent}%` }" />
          </div>
          <span class="summary-text">{{ mappedPercent }}%</span>
        </div>
      </div>
      <el-table :data="modelValue" border class="mapping-table" :row-class-name="rowClassName">
        <el-table-column label="平台控件" min-width="220">
          <template #default="{ row }">
            <div class="control-cell">
              <strong>{{ controlName(row.componentId) }}</strong>
              <span class="control-id">{{ row.componentId }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="90" align="center">
          <template #default="{ row }">
            <el-tag size="small" effect="plain" :type="isTable(row) ? 'warning' : 'info'">
              {{ isTable(row) ? '表格' : '字段' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="业务字段" min-width="200">
          <template #default="{ row, $index }">
            <el-select
              :model-value="row.fieldKey"
              clearable
              filterable
              placeholder="选择业务字段"
              class="field-select"
              @update:model-value="fieldChanged($index, $event)"
            >
              <el-option v-for="field in allowed(row)" :key="field.key" :label="field.label" :value="field.key" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="动态表列映射" min-width="340">
          <template #default="{ row, $index }">
            <div v-if="tableColumns(row.componentId).length" class="column-list">
              <div v-for="column in tableColumns(row.componentId)" :key="column" class="column-row">
                <span class="column-name">{{ column }}</span>
                <el-icon class="column-arrow"><Right /></el-icon>
                <el-select
                  :model-value="row.columns[column]"
                  clearable
                  filterable
                  placeholder="选择表字段"
                  class="column-select"
                  @update:model-value="columnChanged($index, column, $event)"
                >
                  <el-option
                    v-for="field in fields.find((item) => item.key === row.fieldKey)?.columns ?? []"
                    :key="field.key"
                    :label="field.label"
                    :value="field.key"
                  />
                </el-select>
              </div>
            </div>
            <span v-else-if="isTable(row)" class="column-empty">平台模板尚未配置表格列，请在官方编辑器添加。</span>
            <span v-else class="column-none">—</span>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { Connection, Right } from '@element-plus/icons-vue'
import type { TemplateMapping, TemplateControl, SigningField } from '@/types/api/signing'

const props = defineProps<{ modelValue: TemplateMapping[]; controls: TemplateControl[]; fields: SigningField[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: TemplateMapping[]] }>()

const mappedCount = computed(() => props.modelValue.filter((mapping) => mapping.fieldKey).length)
const mappedPercent = computed(() =>
  props.modelValue.length ? Math.round((mappedCount.value / props.modelValue.length) * 100) : 0
)

function isTable(mapping: TemplateMapping) {
  return mapping.componentType === '18'
}
function controlName(id: string) {
  const control = props.controls.find((item) => item.componentId === id)
  return control?.componentName || control?.componentKey || id
}
function allowed(mapping: TemplateMapping) {
  return props.fields.filter((field) => (isTable(mapping) ? field.type === 'TABLE' : field.type !== 'TABLE'))
}
function rowClassName({ row }: { row: TemplateMapping }) {
  return row.fieldKey ? '' : 'is-unmapped'
}
function fieldChanged(index: number, fieldKey: string) {
  emit(
    'update:modelValue',
    props.modelValue.map((value, at) => (at === index ? { ...value, fieldKey, columns: {} } : value))
  )
}
function columnChanged(index: number, column: string, key: string) {
  emit(
    'update:modelValue',
    props.modelValue.map((value, at) => {
      if (at !== index) return value
      const columns = { ...value.columns }
      if (key) {
        columns[column] = key
      } else {
        delete columns[column]
      }
      return { ...value, columns }
    })
  )
}
function tableColumns(id: string): string[] {
  const control = props.controls.find((item) => item.componentId === id)
  const special = control?.componentSpecialAttribute as Record<string, unknown> | undefined
  const content = special?.tableContent
  if (!Array.isArray(content)) return []
  const columns = new Set<string>()
  for (const entry of content) {
    const row = (entry as { row?: Record<string, unknown> }).row
    if (row) {
      Object.keys(row).forEach((key) => columns.add(key))
    }
  }
  return [...columns]
}
</script>
<style scoped lang="scss">
.mapping-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  color: var(--el-text-color-regular);
  font-size: 13px;
}

.mapping-summary strong {
  color: var(--el-color-primary);
}

.summary-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 200px;
}

.summary-track {
  flex: 1;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--el-fill-color-light);
}

.summary-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--el-color-primary-light-5), var(--el-color-primary));
  transition: width 0.3s ease;
}

.summary-text {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.control-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.control-cell strong {
  overflow-wrap: anywhere;
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 500;
}

.control-id {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

.field-select {
  width: 100%;
}

.mapping-table :deep(.el-table__row.is-unmapped) {
  --el-table-tr-bg-color: var(--el-color-warning-light-9);
}

.column-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 0;
}

.column-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.column-name {
  flex: 0 0 96px;
  overflow: hidden;
  color: var(--el-text-color-regular);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.column-arrow {
  flex: 0 0 auto;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}

.column-select {
  flex: 1;
  min-width: 0;
}

.column-empty {
  color: var(--el-color-warning);
  font-size: 12px;
  line-height: 1.6;
}

.column-none {
  color: var(--el-text-color-placeholder);
}

.mapping-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 28px 16px;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  text-align: center;
}

.mapping-empty strong {
  color: var(--el-text-color-primary);
  font-size: 14px;
}

.mapping-empty > span:not(.empty-icon) {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.empty-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
}
</style>

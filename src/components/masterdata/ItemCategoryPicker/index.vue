<template>
  <div class="category-picker">
    <el-tree-select
      v-bind="$attrs"
      :model-value="modelValue ?? undefined"
      :data="displayTree"
      node-key="id"
      check-strictly
      filterable
      :clearable="clearable"
      :disabled="inheritedDisabled"
      :loading="loading"
      :placeholder="placeholder"
      :validate-event="false"
      style="width: 100%; min-width: 0"
      @change="choose"
      @visible-change="ensureLoaded"
    >
      <template #default="{ data }">
        <span>{{ data.shortLabel }}</span>
      </template>
    </el-tree-select>
    <el-button v-if="failed" text type="danger" :disabled="inheritedDisabled || loading" @click="reload">
      重试
    </el-button>
  </div>
</template>
<script setup lang="ts" name="ItemCategoryPicker">
import { computed } from 'vue'
import { useFormDisabled, useFormItem } from 'element-plus'
import { getCategoryReferences } from '@/api/masterdata/reference'
import type { CategoryTreeNode } from '@/types/api/masterdata/item-category'
import type { CategoryReference } from '@/types/api/masterdata/reference'
import type { ItemCategoryPickerProps } from './types'
import { useReferenceOptions } from '../shared/useReferenceOptions'
defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<ItemCategoryPickerProps>(), {
  disabled: undefined,
  clearable: true,
  placeholder: '请选择分类'
})
const emit = defineEmits<{ 'update:modelValue': [id: number | null]; change: [records: CategoryReference[]] }>()
const inheritedDisabled = useFormDisabled()
const { formItem } = useFormItem()
const { options, loading, failed, reload, ensureLoaded } = useReferenceOptions(
  computed(() => props.options),
  getCategoryReferences
)
type DisplayNode = Omit<CategoryTreeNode, 'children'> & { shortLabel: string; children: DisplayNode[] }
const indexed = computed(() => {
  const index = new Map<number, CategoryReference>()
  function visit(nodes: CategoryTreeNode[], parent = '') {
    for (const n of nodes) {
      const path = parent ? `${parent} / ${n.label}` : n.label
      index.set(n.id, { ...n, path })
      visit(n.children, path)
    }
  }
  visit(options.value)
  return index
})
const displayTree = computed(() => {
  function convert(nodes: CategoryTreeNode[]): DisplayNode[] {
    return nodes.map((n) => ({
      ...n,
      label: `${indexed.value.get(n.id)?.path ?? n.label}${n.disabled ? '（停用）' : ''}`,
      shortLabel: `${n.label}${n.disabled ? '（停用）' : ''}`,
      children: convert(n.children)
    }))
  }
  const tree = convert(options.value)
  if (props.modelValue != null && !indexed.value.has(props.modelValue))
    tree.push({
      id: props.modelValue,
      label: `#${props.modelValue}（已失效）`,
      shortLabel: `#${props.modelValue}（已失效）`,
      disabled: true,
      children: []
    })
  return tree
})
function choose(value: unknown) {
  if (inheritedDisabled.value) return
  const id = typeof value === 'number' ? value : null
  const node = id != null ? indexed.value.get(id) : undefined
  if (id != null && (!node || node.disabled)) return
  emit('update:modelValue', id)
  emit('change', node ? [node] : [])
  void formItem?.validate('change').catch(() => {})
}
</script>
<style scoped>
.category-picker {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
}
</style>

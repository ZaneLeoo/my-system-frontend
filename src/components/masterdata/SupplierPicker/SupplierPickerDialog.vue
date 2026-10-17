<template>
  <el-dialog
    :model-value="modelValue"
    title="选择供应商"
    width="min(960px, 96vw)"
    append-to-body
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form inline :model="draft" @submit.prevent="search">
      <el-form-item label="编码 / 名称">
        <el-input v-model="draft.keyword" clearable placeholder="搜索供应商" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" native-type="submit">查询</el-button>
        <el-button @click="reset">重置</el-button>
      </el-form-item>
    </el-form>
    <vxe-table
      ref="table"
      :data="rows"
      border
      show-overflow
      max-height="420"
      :row-config="{ keyField: 'supplierId', isHover: true }"
      :radio-config="{ checkMethod: selectable }"
      :column-config="{ resizable: true }"
      :sort-config="{ remote: true }"
      @radio-change="selectRow"
      @sort-change="sort"
      @cell-dblclick="doubleClick"
    >
      <vxe-column type="radio" width="54" />
      <vxe-column field="supplierCode" title="供应商编码" min-width="160" sortable />
      <vxe-column field="supplierName" title="供应商名称" min-width="180" sortable />
      <vxe-column field="shortName" title="简称" min-width="120" />
      <vxe-column field="contactName" title="主要联系人" min-width="120" />
      <vxe-column field="contactPhone" title="联系电话" min-width="180" />
      <vxe-column field="status" title="状态" width="100">
        <template #default="{ row }">{{ row.status === '0' ? '启用' : '停用' }}</template>
      </vxe-column>
    </vxe-table>
    <el-pagination
      v-model:current-page="page"
      v-model:page-size="size"
      :total="filtered.length"
      :page-sizes="[20, 50, 100]"
      layout="total, sizes, prev, pager, next"
      @size-change="page = 1"
    />
    <template #footer>
      <span class="selection">
        {{ selected ? `${selected.supplierCode} / ${selected.supplierName}` : '尚未选择供应商' }}
      </span>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :disabled="!selected || selected.status !== '0'" @click="confirm">确认选择</el-button>
    </template>
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import type { VxeTableInstance, VxeTableDefines } from 'vxe-table'
import { useVxe } from '@/plugins/vxe'
import type { SupplierReference } from './types'
useVxe()
const props = defineProps<{ modelValue: boolean; options: SupplierReference[]; selectedId: number | null }>()
const emit = defineEmits<{ 'update:modelValue': [open: boolean]; confirm: [row: SupplierReference] }>()
const draft = reactive({ keyword: '' })
const applied = ref('')
const page = ref(1),
  size = ref(20),
  chosen = ref<number | null>(null)
const table = ref<VxeTableInstance<SupplierReference>>()
const sortField = ref<'supplierCode' | 'supplierName'>('supplierCode'),
  direction = ref<'asc' | 'desc'>('asc')
const selected = computed(() => props.options.find((u) => u.supplierId === chosen.value))
const filtered = computed(() =>
  props.options
    .filter((u) => `${u.supplierCode} ${u.supplierName} ${u.shortName}`.toLocaleLowerCase().includes(applied.value))
    .slice()
    .sort(
      (a, b) =>
        a[sortField.value].localeCompare(b[sortField.value], 'zh-CN') * (direction.value === 'asc' ? 1 : -1) ||
        a.supplierId - b.supplierId
    )
)
const rows = computed(() => filtered.value.slice((page.value - 1) * size.value, page.value * size.value))
function selectable({ row }: { row: SupplierReference }) {
  return row.status === '0'
}
function search() {
  applied.value = draft.keyword.trim().toLocaleLowerCase()
  page.value = 1
}
function reset() {
  draft.keyword = ''
  applied.value = ''
  page.value = 1
  sortField.value = 'supplierCode'
  direction.value = 'asc'
  void table.value?.clearSort()
}
function sort({ field, order }: VxeTableDefines.SortChangeEventParams<SupplierReference>) {
  if (field === 'supplierCode' || field === 'supplierName') {
    sortField.value = order ? field : 'supplierCode'
    direction.value = order || 'asc'
    page.value = 1
  }
}
function selectRow({ row }: VxeTableDefines.RadioChangeEventParams<SupplierReference>) {
  chosen.value = row.supplierId
}
function doubleClick({ row }: VxeTableDefines.CellDblclickEventParams<SupplierReference>) {
  if (row.status === '0') {
    chosen.value = row.supplierId
    confirm()
  }
}
function confirm() {
  if (!selected.value || selected.value.status !== '0') return
  emit('confirm', selected.value)
  emit('update:modelValue', false)
}
watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return
    reset()
    chosen.value = props.selectedId
    await nextTick()
    const row = rows.value.find((u) => u.supplierId === chosen.value)
    if (row) await table.value?.setRadioRow(row)
    else await table.value?.clearRadioRow()
  }
)
watch(rows, async () => {
  await nextTick()
  const row = rows.value.find((u) => u.supplierId === chosen.value)
  if (row) await table.value?.setRadioRow(row)
})
</script>
<style scoped>
.el-pagination {
  margin-top: 16px;
  flex-wrap: wrap;
}
.selection {
  margin-right: 16px;
  color: var(--el-text-color-secondary);
}
</style>

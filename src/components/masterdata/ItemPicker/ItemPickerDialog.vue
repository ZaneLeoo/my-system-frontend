<template>
  <el-dialog
    :model-value="modelValue"
    title="选择料品"
    width="min(1120px, 96vw)"
    append-to-body
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="reference-layout">
      <aside class="reference-tree">
        <el-input v-model="categoryKeyword" placeholder="搜索分类" clearable :validate-event="false" />
        <el-button text @click="selectCategory(null)">全部料品</el-button>
        <el-tree
          ref="tree"
          :data="categories"
          node-key="id"
          :props="{ label: 'label', children: 'children', disabled: 'neverDisabled' }"
          :filter-node-method="filterCategory"
          highlight-current
          :expand-on-click-node="false"
          @node-click="categoryClicked"
        />
        <el-button v-if="categoryFailed" text type="danger" @click="loadCategories">重试分类</el-button>
      </aside>
      <div class="reference-content">
        <el-form inline :model="draft" @submit.prevent="search">
          <el-form-item>
            <el-input
              v-model="draft.keyword"
              placeholder="编码 / 名称 / 规格"
              maxlength="200"
              clearable
              :validate-event="false"
            />
          </el-form-item>
          <el-form-item>
            <el-checkbox v-model="draft.purchaseOnly" :disabled="purchaseOnly">仅允许采购</el-checkbox>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" native-type="submit" :loading="loading">查询</el-button>
            <el-button :disabled="loading" @click="reset">重置</el-button>
            <el-button v-if="failed" text type="danger" @click="load()">重试</el-button>
          </el-form-item>
        </el-form>
        <vxe-table
          ref="table"
          :data="rows"
          :loading="loading"
          border
          show-overflow
          max-height="440"
          :row-config="{ keyField: 'itemId', isHover: true }"
          :column-config="{ resizable: true }"
          :sort-config="{ remote: true }"
          @sort-change="sort"
          @checkbox-change="checkboxChanged"
          @checkbox-all="checkboxAll"
          @radio-change="radioChanged"
          @cell-dblclick="doubleClick"
        >
          <vxe-column v-if="multiple" type="checkbox" width="54" />
          <vxe-column v-else type="radio" width="54" />
          <vxe-column field="itemCode" title="料品编码" min-width="150" sortable />
          <vxe-column field="itemName" title="料品名称" min-width="160" sortable />
          <vxe-column field="specification" title="规格型号" min-width="150" sortable />
          <vxe-column field="baseUnitName" title="库存单位" width="110" />
          <vxe-column field="purchaseUnitName" title="采购单位" width="110">
            <template #default="{ row }">{{ row.purchaseUnitName || '—' }}</template>
          </vxe-column>
        </vxe-table>
        <el-pagination
          v-model:current-page="pager.pageNum"
          v-model:page-size="pager.pageSize"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          :disabled="loading"
          @change="paginate"
        />
      </div>
    </div>
    <div class="selected-list">
      <span>已选 {{ selection.size }} 项</span>
      <el-tag v-for="[id, row] in selection" :key="id" closable @close="remove(id)">
        {{ row ? `${row.itemCode} ${row.itemName}${row.status !== '0' ? '（停用）' : ''}` : `#${id}（已失效）` }}
      </el-tag>
    </div>
    <template #footer>
      <el-button :disabled="confirming" @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="confirming" :disabled="!selection.size || loading" @click="confirm">
        确认选择{{ multiple ? `（${selection.size}）` : '' }}
      </el-button>
    </template>
  </el-dialog>
</template>
<script setup lang="ts">
import { nextTick, reactive, ref, shallowRef, watch, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import type { TreeInstance } from 'element-plus/es/components/tree'
import type { VxeTableDefines, VxeTableInstance } from 'vxe-table'
import { getItemReferenceCategories, resolveItemReferences, searchItemReferences } from '@/api/masterdata/reference'
import type { ItemReference, ItemReferenceQuery } from '@/types/api/masterdata/reference'
import type { CategoryTreeNode } from '@/types/api/masterdata/item-category'
import { useVxe } from '@/plugins/vxe'
useVxe()
const props = defineProps<{
  modelValue: boolean
  multiple: boolean
  purchaseOnly: boolean
  selectedIds: number[]
  selectedRecords: ItemReference[]
}>()
const emit = defineEmits<{ 'update:modelValue': [open: boolean]; confirm: [records: ItemReference[]] }>()
const table = ref<VxeTableInstance<ItemReference>>(),
  tree = ref<TreeInstance>()
const rows = shallowRef<ItemReference[]>([]),
  categories = shallowRef<CategoryTreeNode[]>([])
const selection = shallowRef(new Map<number, ItemReference | undefined>())
const draft = reactive({ keyword: '', purchaseOnly: false }),
  categoryKeyword = ref('')
const applied = ref<ItemReferenceQuery>({ pageNum: 1, pageSize: 20 })
const pager = reactive({ pageNum: 1, pageSize: 20 })
const total = ref(0),
  loading = ref(false),
  failed = ref(false),
  categoryFailed = ref(false),
  confirming = ref(false)
let sequence = 0,
  session = 0,
  alive = true
let original = new Set<number>()
function filterCategory(value: string, data: CategoryTreeNode) {
  return data.label.toLocaleLowerCase().includes(value.trim().toLocaleLowerCase())
}
watch(categoryKeyword, (value) => tree.value?.filter(value))
async function loadCategories() {
  const current = session
  try {
    const { data } = await getItemReferenceCategories()
    if (!alive || current !== session) return
    categories.value = data
    categoryFailed.value = false
  } catch {
    if (alive && current === session) categoryFailed.value = true
  }
}
async function syncSelection() {
  await nextTick()
  if (!props.modelValue) return
  if (props.multiple) {
    await table.value?.clearCheckboxRow()
    const visible = rows.value.filter((row) => selection.value.has(row.itemId))
    if (visible.length) await table.value?.setCheckboxRow(visible, true)
  } else {
    await table.value?.clearRadioRow()
    const row = rows.value.find((row) => selection.value.has(row.itemId))
    if (row) await table.value?.setRadioRow(row)
  }
}
async function load(query: ItemReferenceQuery = applied.value) {
  const current = ++sequence,
    requested = { ...query }
  loading.value = true
  try {
    const { data } = await searchItemReferences(requested)
    if (!alive || current !== sequence || !props.modelValue) return
    const last = Math.max(1, Math.ceil(data.total / requested.pageSize))
    if (requested.pageNum > last) {
      await load({ ...requested, pageNum: last })
      return
    }
    rows.value = data.rows
    total.value = data.total
    applied.value = requested
    Object.assign(pager, { pageNum: requested.pageNum, pageSize: requested.pageSize })
    draft.keyword = requested.keyword ?? ''
    draft.purchaseOnly = requested.purchaseOnly ?? false
    failed.value = false
    const chosen = new Map(selection.value)
    data.rows.forEach((row) => {
      if (chosen.has(row.itemId)) chosen.set(row.itemId, row)
    })
    selection.value = chosen
  } catch {
    if (alive && current === sequence) {
      failed.value = true
      Object.assign(pager, { pageNum: applied.value.pageNum, pageSize: applied.value.pageSize })
      draft.keyword = applied.value.keyword ?? ''
      draft.purchaseOnly = applied.value.purchaseOnly ?? false
      tree.value?.setCurrentKey(applied.value.categoryId)
    }
  } finally {
    if (alive && current === sequence) {
      loading.value = false
      await syncSelection()
      await nextTick()
      if (current === sequence) {
        if (applied.value.sortField) await table.value?.sort(applied.value.sortField, applied.value.sortDirection)
        else await table.value?.clearSort()
      }
    }
  }
}
function search() {
  void load({
    ...applied.value,
    keyword: draft.keyword.trim() || undefined,
    purchaseOnly: props.purchaseOnly || draft.purchaseOnly,
    pageNum: 1
  })
}
function selectCategory(id: number | null) {
  void load({ ...applied.value, categoryId: id ?? undefined, pageNum: 1 })
}
function categoryClicked(node: CategoryTreeNode) {
  selectCategory(node.id)
}
function reset() {
  categoryKeyword.value = ''
  tree.value?.setCurrentKey(undefined)
  void load({ pageNum: 1, pageSize: applied.value.pageSize, purchaseOnly: props.purchaseOnly })
}
function paginate(pageNum: number, pageSize: number) {
  void load({ ...applied.value, pageNum: pageSize !== applied.value.pageSize ? 1 : pageNum, pageSize })
}
function sort({ field, order }: VxeTableDefines.SortChangeEventParams<ItemReference>) {
  if (field !== 'itemCode' && field !== 'itemName' && field !== 'specification') return
  void load({ ...applied.value, sortField: order ? field : undefined, sortDirection: order || undefined, pageNum: 1 })
}
function checkboxChanged({ row, checked }: VxeTableDefines.CheckboxChangeEventParams<ItemReference>) {
  const next = new Map(selection.value)
  if (checked) {
    if (!next.has(row.itemId) && next.size >= 100) {
      ElMessage.warning('每次最多选择 100 个料品')
      void syncSelection()
      return
    }
    next.set(row.itemId, row)
  } else next.delete(row.itemId)
  selection.value = next
}
function checkboxAll({ checked }: VxeTableDefines.CheckboxAllEventParams<ItemReference>) {
  const next = new Map(selection.value)
  rows.value.forEach((row) => {
    if (checked) next.set(row.itemId, row)
    else next.delete(row.itemId)
  })
  if (next.size > 100) {
    ElMessage.warning('每次最多选择 100 个料品')
    void syncSelection()
    return
  }
  selection.value = next
}
function radioChanged({ row }: VxeTableDefines.RadioChangeEventParams<ItemReference>) {
  selection.value = new Map([[row.itemId, row]])
}
function doubleClick({ row }: VxeTableDefines.CellDblclickEventParams<ItemReference>) {
  if (!props.multiple) {
    selection.value = new Map([[row.itemId, row]])
    void confirm()
  }
}
function remove(id: number) {
  const next = new Map(selection.value)
  next.delete(id)
  selection.value = next
  void syncSelection()
}
async function confirm() {
  if (confirming.value || !selection.value.size) return
  const current = session,
    ids = [...selection.value.keys()]
  confirming.value = true
  try {
    const { data } = await resolveItemReferences(ids)
    if (!alive || current !== session || !props.modelValue) return
    if (data.length !== ids.length) {
      ElMessage.warning('选中料品已失效，请移除后重新选择')
      return
    }
    if (
      data.some(
        (row) =>
          !original.has(row.itemId) &&
          (row.status !== '0' || ((props.purchaseOnly || applied.value.purchaseOnly) && !row.purchaseEnabled))
      )
    ) {
      ElMessage.warning('料品状态已变化，请重新选择')
      return
    }
    emit('confirm', data)
    emit('update:modelValue', false)
  } catch {
    /* 请求层显示错误，保留全部草稿选择。 */
  } finally {
    if (current === session) confirming.value = false
  }
}
watch(
  () => props.modelValue,
  (open) => {
    session++
    sequence++
    confirming.value = false
    if (!open) {
      loading.value = false
      return
    }
    original = new Set(props.selectedIds)
    const index = new Map(props.selectedRecords.map((row) => [row.itemId, row] as const))
    selection.value = new Map(props.selectedIds.map((id) => [id, index.get(id)]))
    categoryKeyword.value = ''
    applied.value = { pageNum: 1, pageSize: 20, purchaseOnly: props.purchaseOnly }
    Object.assign(pager, { pageNum: 1, pageSize: 20 })
    draft.keyword = ''
    draft.purchaseOnly = props.purchaseOnly
    void load()
    void loadCategories()
  }
)
onBeforeUnmount(() => {
  alive = false
  session++
  sequence++
})
</script>
<style scoped>
.reference-layout {
  display: grid;
  grid-template-columns: 210px minmax(0, 1fr);
  gap: 20px;
}
.reference-tree {
  min-width: 0;
  border-right: 1px solid var(--el-border-color);
  padding-right: 16px;
  max-height: 530px;
  overflow: auto;
}
.reference-content {
  min-width: 0;
}
.selected-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  max-height: 120px;
  overflow: auto;
  margin-top: 16px;
}
.el-pagination {
  margin-top: 16px;
  flex-wrap: wrap;
}
@media (max-width: 700px) {
  .reference-layout {
    grid-template-columns: 1fr;
  }
  .reference-tree {
    max-height: 180px;
    border-right: none;
    padding-right: 0;
  }
}
</style>

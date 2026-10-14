<template>
  <div class="app-container vxe-demo" @keydown="guardComposition">
    <div class="demo-heading">
      <div>
        <h2>VXE 组件验证</h2>
        <p>真实组件 · 本地模拟数据 · 刷新后重置，不写入业务数据库</p>
      </div>
      <el-tag>开源核心</el-tag>
    </div>
    <el-tabs v-model="activeTab">
      <el-tab-pane label="档案列表" name="list" lazy>
        <el-form :inline="true" @submit.prevent="searchItems">
          <el-form-item label="编码 / 名称">
            <el-input v-model="keyword" placeholder="请输入关键词" clearable @keyup.enter="searchItems" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="searchItems">查询</el-button>
            <el-button @click="resetSearch">重置</el-button>
          </el-form-item>
        </el-form>
        <div class="demo-toolbar">
          <span>共 {{ filteredItems.length }} 条 · 已选 {{ selectedCount }} 条</span>
          <el-button @click="exportCurrentPage">导出当前页 CSV</el-button>
        </div>
        <vxe-grid
          id="vxe-demo-items"
          ref="listRef"
          v-bind="listOptions"
          :data="pageItems"
          :pager-config="{ currentPage, pageSize, total: filteredItems.length, pageSizes: [10, 20, 50] }"
          @page-change="changePage"
          @sort-change="sortItems"
          @filter-change="filterItems"
          @checkbox-change="updateSelection"
          @checkbox-all="updateSelection"
        >
          <template #status="{ row }">
            <el-tag :type="row.status === '0' ? 'success' : 'info'">{{ row.status === '0' ? '启用' : '停用' }}</el-tag>
          </template>
        </vxe-grid>
      </el-tab-pane>
      <el-tab-pane label="存货分类树" name="tree" lazy>
        <div class="demo-toolbar">
          <span>树形分类 · 编码独立于层级位置</span>
          <div>
            <el-button @click="treeRef?.setAllTreeExpand(true)">全部展开</el-button>
            <el-button @click="treeRef?.clearTreeExpand()">全部收起</el-button>
          </div>
        </div>
        <vxe-table
          ref="treeRef"
          :data="categories"
          border
          stripe
          :row-config="{ keyField: 'id' }"
          :tree-config="{ transform: true, rowField: 'id', parentField: 'parentId', expandAll: true }"
        >
          <vxe-column field="name" title="分类名称" tree-node min-width="240" />
          <vxe-column field="code" title="分类编码" min-width="150" />
          <vxe-column field="status" title="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.status === '0' ? 'success' : 'info'">
                {{ row.status === '0' ? '启用' : '停用' }}
              </el-tag>
            </template>
          </vxe-column>
        </vxe-table>
      </el-tab-pane>
      <el-tab-pane label="单据明细" name="lines" lazy>
        <div class="demo-toolbar">
          <div class="demo-actions">
            <el-button type="primary" @click="addLine">增行</el-button>
            <el-button @click="removeSelectedLines">删除选中行</el-button>
            <el-button @click="validateLines">校验明细</el-button>
          </div>
          <div class="demo-actions">
            <span>演示行数</span>
            <el-select v-model="lineCount" aria-label="演示行数" style="width: 100px" @change="resetLines">
              <el-option v-for="count in [10, 100, 500]" :key="count" :value="count" :label="`${count} 行`" />
            </el-select>
            <el-button @click="resetLines">重置明细</el-button>
          </div>
        </div>
        <p class="demo-hint">
          点击单元格编辑，使用 Enter / Tab 连续录入；拖动行号旁的手柄调整顺序。{{
            detailSorted ? '当前存在排序，行拖拽已暂停。' : ''
          }}
        </p>
        <vxe-table
          ref="linesRef"
          :data="lines"
          height="480"
          border
          stripe
          show-footer
          :footer-data="lineFooter"
          :row-config="{ keyField: 'id', drag: !detailSorted }"
          :row-drag-config="{ trigger: 'cell' }"
          :column-config="{ resizable: true, drag: true }"
          :column-drag-config="{ trigger: 'cell' }"
          :edit-config="{ trigger: 'click', mode: 'cell', showStatus: true }"
          :edit-rules="lineRules"
          :keyboard-config="{ isEdit: true, isArrow: true, isEnter: true, isTab: true }"
          :mouse-config="{ selected: true }"
          @cell-selected="editSelectedCell"
          @sort-change="detailSorted = Boolean($event.order)"
          @row-dragend="syncLineOrder"
        >
          <vxe-column type="checkbox" width="45" fixed="left" />
          <vxe-column type="seq" title="行号" width="80" fixed="left" :drag-sort="!detailSorted" />
          <vxe-column field="code" title="存货编码" width="145" :edit-render="{ name: 'ElInput' }" />
          <vxe-column field="name" title="存货名称" min-width="180" :edit-render="{ name: 'ElInput' }" />
          <vxe-column
            field="quantity"
            title="数量"
            width="155"
            sortable
            :edit-render="{ name: 'ElInputNumber', props: { min: 0, precision: 3, controls: false } }"
          />
          <vxe-column
            field="price"
            title="不含税单价"
            width="160"
            :edit-render="{ name: 'ElInputNumber', props: { min: 0, precision: 4, controls: false } }"
          />
          <vxe-column field="amount" title="不含税金额" width="150" align="right">
            <template #default="{ row }">{{ money(lineAmount(row)) }}</template>
          </vxe-column>
          <vxe-column
            field="deliveryDate"
            title="交货日期"
            width="180"
            :edit-render="{ name: 'ElDatePicker', props: { type: 'date', valueFormat: 'YYYY-MM-DD' } }"
          />
          <vxe-column field="remark" title="备注" min-width="180" :edit-render="{ name: 'ElInput' }" />
        </vxe-table>
        <p class="demo-hint" role="status">
          {{ validationMessage || `当前 ${lines.length} 行，合计 ¥ ${money(totalAmount)}` }}
        </p>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts" name="VxeDemo">
import { computed, nextTick, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  VxeGrid,
  VxeTable,
  VxeColumn,
  type VxeGridInstance,
  type VxeGridProps,
  type VxeTableInstance,
  type VxeTableDefines,
  type VxeTablePropTypes
} from 'vxe-table'
import { useVxe } from '@/plugins/vxe'
import {
  categories,
  createItems,
  createLines,
  lineAmount,
  type DemoItem,
  type DemoLine,
  type DemoCategory
} from './data'

useVxe()
const activeTab = ref('list')
const listRef = ref<VxeGridInstance<DemoItem>>()
const treeRef = ref<VxeTableInstance<DemoCategory>>()
const linesRef = ref<VxeTableInstance<DemoLine>>()
const items = createItems()
const keyword = ref('')
const appliedKeyword = ref('')
const statusValues = ref<string[]>([])
const currentPage = ref(1)
const pageSize = ref(10)
const selectedCount = ref(0)
const sortField = ref('')
const sortOrder = ref<string | null>(null)
const filteredItems = computed(() => {
  const term = appliedKeyword.value.toLowerCase()
  const result = items.filter(
    (row) =>
      (!term || `${row.code} ${row.name}`.toLowerCase().includes(term)) &&
      (!statusValues.value.length || statusValues.value.includes(row.status))
  )
  if (sortOrder.value && ['code', 'name'].includes(sortField.value)) {
    const field = sortField.value as 'code' | 'name'
    result.sort((a, b) => a[field].localeCompare(b[field], 'zh-CN') * (sortOrder.value === 'asc' ? 1 : -1))
  }
  return result
})
const pageItems = computed(() =>
  filteredItems.value.slice((currentPage.value - 1) * pageSize.value, currentPage.value * pageSize.value)
)
const listOptions: VxeGridProps<DemoItem> = {
  border: true,
  stripe: true,
  height: 460,
  rowConfig: { keyField: 'id' },
  columnConfig: { resizable: true, drag: true },
  columnDragConfig: { trigger: 'cell' },
  sortConfig: { remote: true },
  filterConfig: { remote: true },
  customConfig: { storage: true },
  toolbarConfig: { custom: true, zoom: true },
  columns: [
    { type: 'checkbox', width: 45, fixed: 'left' },
    { field: 'code', title: '存货编码', width: 150, fixed: 'left', sortable: true },
    { field: 'name', title: '存货名称', minWidth: 180, sortable: true },
    { field: 'specification', title: '规格型号', minWidth: 160 },
    { field: 'unit', title: '单位', width: 80 },
    { field: 'category', title: '分类', minWidth: 150 },
    {
      field: 'status',
      title: '状态',
      width: 110,
      filters: [
        { label: '启用', value: '0' },
        { label: '停用', value: '1' }
      ],
      slots: { default: 'status' }
    }
  ]
}

function searchItems() {
  appliedKeyword.value = keyword.value.trim()
  currentPage.value = 1
  selectedCount.value = 0
  listRef.value?.clearCheckboxRow()
}
function resetSearch() {
  keyword.value = ''
  statusValues.value = []
  sortField.value = ''
  sortOrder.value = null
  listRef.value?.clearFilter()
  listRef.value?.clearSort()
  searchItems()
}
function changePage(page: { currentPage: number; pageSize: number }) {
  currentPage.value = page.currentPage
  pageSize.value = page.pageSize
  selectedCount.value = 0
  void listRef.value?.clearCheckboxRow()
}
function sortItems(sort: { field: string; order: string | null }) {
  sortField.value = sort.field
  sortOrder.value = sort.order
  currentPage.value = 1
  selectedCount.value = 0
  void listRef.value?.clearCheckboxRow()
}
function filterItems(filter: { values: string[] }) {
  statusValues.value = filter.values
  currentPage.value = 1
  selectedCount.value = 0
  void listRef.value?.clearCheckboxRow()
}
function updateSelection() {
  selectedCount.value = listRef.value?.getCheckboxRecords().length ?? 0
}
async function exportCurrentPage() {
  await listRef.value?.exportData({ type: 'csv', filename: 'VXE存货列表演示', mode: 'current', isHeader: true })
}

const lineCount = ref(10)
const lines = ref<DemoLine[]>(createLines())
let nextId = 1001
const detailSorted = ref(false)
const validationMessage = ref('')
const money = (value: number) => value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const totalAmount = computed(() => lines.value.reduce((sum, row) => sum + Math.round(lineAmount(row) * 100), 0) / 100)
const lineFooter = computed(() => [{ code: '合计', amount: money(totalAmount.value) }])
const lineRules: VxeTablePropTypes.EditRules<DemoLine> = {
  code: [{ required: true, message: '请填写存货编码' }],
  name: [{ required: true, message: '请填写存货名称' }],
  quantity: [{ required: true, type: 'number', min: 0.001, message: '数量必须大于 0' }],
  price: [{ required: true, type: 'number', min: 0, message: '单价不能为负数' }],
  deliveryDate: [{ required: true, message: '请选择交货日期' }]
}
async function addLine() {
  const row: DemoLine = { id: nextId++, code: '', name: '', quantity: 1, price: 0, deliveryDate: '', remark: '' }
  lines.value.push(row)
  validationMessage.value = ''
  await nextTick()
  await linesRef.value?.setEditCell(row, 'code')
}
function removeSelectedLines() {
  const selected = new Set(linesRef.value?.getCheckboxRecords().map((row) => row.id))
  if (!selected.size) {
    ElMessage.info('请先选择要删除的明细')
    return
  }
  lines.value = lines.value.filter((row) => !selected.has(row.id))
  validationMessage.value = ''
}
async function resetLines() {
  await linesRef.value?.clearEdit()
  await linesRef.value?.clearValidate()
  lines.value = createLines(lineCount.value)
  detailSorted.value = false
  validationMessage.value = ''
  await linesRef.value?.clearSort()
  await nextTick()
  await linesRef.value?.reloadData(lines.value)
  await linesRef.value?.scrollTo(0, 0)
}
async function validateLines() {
  await linesRef.value?.clearEdit()
  if (!lines.value.length) {
    validationMessage.value = '至少需要一行明细'
    return
  }
  const errors = await linesRef.value?.fullValidate(true)
  validationMessage.value = errors ? '校验未通过，请检查标记的单元格' : '全部明细校验通过（演示数据未保存）'
}
function syncLineOrder() {
  const tableData = linesRef.value?.getTableData()
  if (tableData) lines.value = [...tableData.fullData]
}

function editSelectedCell({ row, column }: { row: DemoLine; column: VxeTableDefines.ColumnInfo }) {
  if (column.editRender) void linesRef.value?.setEditCell(row, column.field)
}

function guardComposition(event: KeyboardEvent) {
  if (event.isComposing) event.stopPropagation()
}
</script>

<style scoped lang="scss">
.vxe-demo {
  .demo-heading,
  .demo-toolbar,
  .demo-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .demo-heading,
  .demo-toolbar {
    justify-content: space-between;
    margin-bottom: 16px;
  }
  h2 {
    margin: 0 0 8px;
    font-size: 20px;
  }
  p,
  .demo-toolbar {
    color: var(--el-text-color-secondary);
  }
  .demo-hint {
    font-size: 13px;
    line-height: 1.7;
  }
  :deep(.vxe-body--column .el-input-number),
  :deep(.vxe-body--column .el-date-editor) {
    width: 100%;
  }
}
</style>

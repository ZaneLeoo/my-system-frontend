<template>
  <div class="app-container item-page">
    <el-form :model="query" inline class="query-form" @submit.prevent="searchItems">
      <el-form-item label="料品编码">
        <el-input v-model="query.itemCode" placeholder="请输入编码" clearable maxlength="64" />
      </el-form-item>
      <el-form-item label="料品名称">
        <el-input v-model="query.itemName" placeholder="请输入名称" clearable maxlength="200" />
      </el-form-item>
      <el-form-item label="分类">
        <el-tree-select
          v-model="query.categoryId"
          :data="filterCategories"
          node-key="id"
          check-strictly
          filterable
          clearable
          placeholder="全部分类"
          style="width: 200px"
        />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.status" placeholder="全部状态" clearable style="width: 130px">
          <el-option label="启用" value="0" />
          <el-option label="停用" value="1" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" native-type="submit" :loading="loading">查询</el-button>
        <el-button icon="Refresh" :disabled="loading" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>
    <div class="table-toolbar">
      <span class="result-count">共 {{ total }} 个料品</span>
      <div>
        <el-button v-if="canCreate" type="primary" icon="Plus" :disabled="loading" @click="openDrawer('create')">
          新增料品
        </el-button>
        <el-button text icon="Refresh" :disabled="loading" @click="loadItems()">刷新</el-button>
      </div>
    </div>
    <vxe-table
      ref="tableRef"
      :data="rows"
      :loading="loading"
      border
      stripe
      show-overflow
      max-height="640"
      :column-config="{ resizable: true, drag: true }"
      :column-drag-config="{ trigger: 'default', showIcon: true }"
      :row-config="{ keyField: 'itemId', isHover: true }"
      :sort-config="{ remote: true, multiple: false, allowClear: true }"
      :filter-config="{ remote: true }"
      @sort-change="handleSort"
      @filter-change="handleColumnFilter"
      @filter-visible="handleFilterVisible"
    >
      <vxe-column
        field="itemCode"
        title="料品编码"
        min-width="180"
        fixed="left"
        sortable
        :filters="columnFilters('itemCode')"
        :filter-multiple="false"
      >
        <template #filter="params">
          <form class="column-text-filter" @submit.prevent="applyTextFilter($event, params)">
            <el-input v-model="filterDraft.itemCode" placeholder="包含料品编码" clearable aria-label="料品编码列筛选" />
            <div class="filter-actions">
              <el-button size="small" @click="applyTextFilter($event, params, true)">清除</el-button>
              <el-button size="small" type="primary" native-type="submit">筛选</el-button>
            </div>
          </form>
        </template>
        <template #default="{ row }">
          <el-button v-if="canQuery" link type="primary" @click="openDrawer('detail', row)">
            {{ row.itemCode }}
          </el-button>
          <span v-else>{{ row.itemCode }}</span>
        </template>
      </vxe-column>
      <vxe-column
        field="itemName"
        title="料品名称"
        min-width="200"
        fixed="left"
        sortable
        :filters="columnFilters('itemName')"
        :filter-multiple="false"
      >
        <template #filter="params">
          <form class="column-text-filter" @submit.prevent="applyTextFilter($event, params)">
            <el-input v-model="filterDraft.itemName" placeholder="包含料品名称" clearable aria-label="料品名称列筛选" />
            <div class="filter-actions">
              <el-button size="small" @click="applyTextFilter($event, params, true)">清除</el-button>
              <el-button size="small" type="primary" native-type="submit">筛选</el-button>
            </div>
          </form>
        </template>
      </vxe-column>
      <vxe-column
        field="specification"
        title="规格型号"
        min-width="180"
        sortable
        :filters="columnFilters('specification')"
        :filter-multiple="false"
      >
        <template #filter="params">
          <form class="column-text-filter" @submit.prevent="applyTextFilter($event, params)">
            <el-input
              v-model="filterDraft.specification"
              placeholder="包含规格型号"
              clearable
              aria-label="规格型号列筛选"
            />
            <div class="filter-actions">
              <el-button size="small" @click="applyTextFilter($event, params, true)">清除</el-button>
              <el-button size="small" type="primary" native-type="submit">筛选</el-button>
            </div>
          </form>
        </template>
      </vxe-column>

      <vxe-column
        field="categoryId"
        title="分类路径"
        min-width="220"
        :filters="columnFilters('categoryId')"
        :filter-multiple="false"
      >
        <template #default="{ row }">{{ row.categoryPath }}</template>
      </vxe-column>
      <vxe-column
        v-for="u in unitFields"
        :key="u.field"
        :field="u.field"
        :title="u.title"
        min-width="180"
        :filters="columnFilters(u.field)"
        :filter-multiple="false"
      >
        <template #default="{ row }">
          {{
            u.field === 'baseUnitId'
              ? row.baseUnitName
              : u.field === 'purchaseUnitId'
                ? row.purchaseUnitName || '—'
                : row.salesUnitName || '—'
          }}
        </template>
      </vxe-column>
      <vxe-column field="status" title="状态" width="110" :filters="columnFilters('status')" :filter-multiple="false">
        <template #default="{ row }">
          <el-tag :type="row.status === '0' ? 'success' : 'info'" effect="plain">
            {{ row.status === '0' ? '启用' : '停用' }}
          </el-tag>
        </template>
      </vxe-column>
      <vxe-column
        field="purchaseEnabled"
        title="允许采购"
        width="130"
        :filters="columnFilters('purchaseEnabled')"
        :filter-multiple="false"
      >
        <template #default="{ row }">{{ row.purchaseEnabled ? '是' : '否' }}</template>
      </vxe-column>
      <vxe-column field="defaultTaxRate" title="默认税率" width="130">
        <template #default="{ row }">{{ row.defaultTaxRate == null ? '未设置' : `${row.defaultTaxRate}%` }}</template>
      </vxe-column>
      <vxe-column field="remark" title="备注" min-width="220" />
      <vxe-column field="updateTime" title="最后修改时间" width="200" sortable />
      <vxe-column title="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button v-if="canQuery" link type="primary" @click="openDrawer('detail', row)">详情</el-button>
          <el-button v-if="canEdit" link type="primary" @click="openDrawer('edit', row)">编辑</el-button>
          <el-button
            v-if="canRemove"
            link
            type="danger"
            :disabled="loading || deletingId !== undefined"
            @click="removeItem(row)"
          >
            删除
          </el-button>
        </template>
      </vxe-column>
      <template #empty><el-empty description="暂无符合条件的料品" :image-size="80" /></template>
    </vxe-table>
    <el-pagination
      v-model:current-page="pagination.pageNum"
      v-model:page-size="pagination.pageSize"
      class="item-pagination"
      background
      layout="total, sizes, prev, pager, next, jumper"
      :total="total"
      :page-sizes="[10, 20, 50, 100]"
      :disabled="loading"
      @change="changePage"
    />
    <el-drawer
      v-model="drawerOpen"
      :title="drawerTitle"
      size="min(860px, 100vw)"
      append-to-body
      destroy-on-close
      :before-close="beforeClose"
    >
      <div v-loading="drawerLoading || optionsLoading">
        <el-form
          v-if="!drawerLoading && optionsReady"
          ref="formRef"
          :model="form"
          :rules="rules"
          label-position="top"
          :disabled="readonly || saving || drawerLoading || !optionsReady"
        >
          <el-tabs v-model="activeTab">
            <el-tab-pane label="基本信息" name="basic">
              <div class="form-grid">
                <el-form-item label="料品编码" prop="itemCode">
                  <el-input v-model="form.itemCode" maxlength="64" show-word-limit placeholder="请输入料品编码" />
                </el-form-item>
                <el-form-item label="料品名称" prop="itemName">
                  <el-input v-model="form.itemName" maxlength="200" show-word-limit placeholder="请输入料品名称" />
                </el-form-item>
              </div>
              <el-form-item label="规格型号" prop="specification">
                <el-input v-model="form.specification" maxlength="200" show-word-limit />
              </el-form-item>
              <el-form-item label="料品分类" prop="categoryId">
                <el-tree-select
                  v-model="form.categoryId"
                  :data="categoryOptions"
                  node-key="id"
                  check-strictly
                  filterable
                  placeholder="请选择启用分类（可选择任意层级）"
                  style="width: 100%"
                />
              </el-form-item>
              <el-form-item label="状态" prop="status">
                <el-radio-group v-model="form.status">
                  <el-radio value="0">启用</el-radio>
                  <el-radio value="1">停用</el-radio>
                </el-radio-group>
              </el-form-item>
              <el-form-item label="备注" prop="remark">
                <el-input v-model="form.remark" type="textarea" :rows="3" maxlength="500" show-word-limit />
              </el-form-item>
            </el-tab-pane>
            <el-tab-pane label="单位设置" name="units">
              <el-form-item v-for="u in unitFields" :key="u.field" :label="u.title" :prop="u.field">
                <el-select
                  :model-value="form[u.field] ?? undefined"
                  clearable
                  filterable
                  style="width: 100%"
                  :placeholder="u.field === 'baseUnitId' ? '请选择库存单位' : '可不设置'"
                  @update:model-value="updateUnit(u.field, $event)"
                >
                  <el-option
                    v-for="option in unitOptions"
                    :key="option.unitId"
                    :value="option.unitId"
                    :label="`${option.unitCode} / ${option.unitName}${option.status === '1' ? '（停用）' : ''}`"
                    :disabled="option.status === '1'"
                  />
                </el-select>
              </el-form-item>
            </el-tab-pane>
            <el-tab-pane label="采购设置" name="purchase">
              <el-form-item label="允许采购"><el-switch v-model="form.purchaseEnabled" /></el-form-item>
              <el-form-item label="默认采购税率（%）">
                <el-input-number
                  :model-value="form.defaultTaxRate ?? undefined"
                  :min="0"
                  :max="100"
                  :precision="2"
                  :step="1"
                  :controls="false"
                  placeholder="未设置"
                  @update:model-value="updateTaxRate"
                />
                <span class="field-hint tax-hint">留空表示未设置，0 表示零税率。</span>
              </el-form-item>
            </el-tab-pane>
          </el-tabs>
        </el-form>
        <el-descriptions v-if="detail" title="维护记录" :column="2" border class="audit-info">
          <el-descriptions-item label="创建人">{{ detail.createBy }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ detail.createTime }}</el-descriptions-item>
          <el-descriptions-item label="修改人">{{ detail.updateBy || '—' }}</el-descriptions-item>
          <el-descriptions-item label="修改时间">{{ detail.updateTime || '—' }}</el-descriptions-item>
        </el-descriptions>
      </div>
      <template #footer>
        <el-button :disabled="saving" @click="beforeClose(() => (drawerOpen = false))">
          {{ readonly ? '关闭' : '取消' }}
        </el-button>
        <el-button
          v-if="!readonly"
          type="primary"
          :loading="saving"
          :disabled="drawerLoading || optionsLoading || !optionsReady"
          @click="saveItem"
        >
          保存
        </el-button>
        <el-button v-else-if="canEdit" type="primary" :disabled="drawerLoading" @click="openDrawer('edit', detail)">
          编辑
        </el-button>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts" name="MasterDataItem">
import type { CategoryTreeNode } from '@/types/api/masterdata/item-category'
import type { UnitOption, ItemSortField } from '@/types/api/masterdata/item'
import { computed, nextTick, onMounted, reactive, ref, shallowRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus/es/components/form'
import type { VxeColumnPropTypes, VxeColumnSlotTypes, VxeTableDefines, VxeTableInstance } from 'vxe-table'
import {
  createItem,
  deleteItem,
  getItem,
  listItems,
  updateItem,
  getCategoryOptions,
  getUnitOptions
} from '@/api/masterdata/item'
import { useVxe } from '@/plugins/vxe'
import auth from '@/plugins/auth'
import { EnableStatus } from '@/types/api/common'
import type { SaveItemRequest, Item, ItemQuery } from '@/types/api/masterdata/item'

useVxe()

type DrawerMode = 'create' | 'edit' | 'detail'
type ItemFilters = Omit<ItemQuery, 'pageNum' | 'pageSize' | 'sortField' | 'sortDirection'>
const filterFields = [
  'itemCode',
  'itemName',
  'specification',
  'categoryId',
  'baseUnitId',
  'purchaseUnitId',
  'salesUnitId',
  'purchaseEnabled',
  'status'
] as const
const textFields = ['itemCode', 'itemName', 'specification'] as const
const unitFields = [
  { field: 'baseUnitId', title: '库存单位（基本单位）' },
  { field: 'purchaseUnitId', title: '默认采购单位' },
  { field: 'salesUnitId', title: '默认销售单位' }
] as const
const categoryOptions = ref<CategoryTreeNode[]>([])
const unitOptions = ref<UnitOption[]>([])
const optionsLoading = ref(false)
const optionsReady = ref(false)
function updateUnit(field: 'baseUnitId' | 'purchaseUnitId' | 'salesUnitId', value: unknown) {
  const id = typeof value === 'number' ? value : undefined
  if (field === 'baseUnitId') unitChanged(id)
  else form.value[field] = id ?? null
}
function updateTaxRate(value: number | null | undefined) {
  form.value.defaultTaxRate = value ?? null
}
const activeTab = ref('basic')
let initialUnitSelected = false
const filterCategories = computed(() => selectableCategories(categoryOptions.value))
function selectableCategories(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
  return nodes.map((n) => ({ ...n, disabled: false, children: selectableCategories(n.children) }))
}
async function loadOptions() {
  optionsLoading.value = true
  try {
    const [c, u] = await Promise.all([getCategoryOptions(), getUnitOptions()])
    categoryOptions.value = c.data
    unitOptions.value = u.data
    optionsReady.value = true
  } finally {
    optionsLoading.value = false
  }
}
function unitChanged(value: number | undefined) {
  if (mode.value === 'create' && !initialUnitSelected && value) {
    initialUnitSelected = true
    if (form.value.purchaseUnitId == null) form.value.purchaseUnitId = value
    if (form.value.salesUnitId == null) form.value.salesUnitId = value
  }
  form.value.baseUnitId = value
}
const tableRef = ref<VxeTableInstance<Item>>()
const rows = shallowRef<Item[]>([])
const total = ref(0)
const query = reactive<ItemFilters>({})
const appliedQuery = ref<ItemQuery>({ pageNum: 1, pageSize: 20 })
const pagination = reactive({ pageNum: 1, pageSize: 20 })
const filterDraft = reactive({ itemCode: '', itemName: '', specification: '' })
function buildColumnFilters(field: keyof ItemFilters): VxeColumnPropTypes.Filters {
  if (field === 'status') return statusFilters.value
  if (field === 'purchaseEnabled')
    return [true, false].map((v) => ({
      label: v ? '允许' : '不允许',
      value: v,
      checked: appliedQuery.value.purchaseEnabled === v
    }))
  if (textFields.some((f) => f === field)) return textFilters(String(appliedQuery.value[field] ?? ''))
  const options =
    field === 'categoryId'
      ? flattenCategories(categoryOptions.value)
      : unitOptions.value.map((u) => ({ value: u.unitId, label: `${u.unitCode} / ${u.unitName}` }))
  return options.map((o) => ({ ...o, checked: appliedQuery.value[field] === o.value }))
}
function flattenCategories(nodes: CategoryTreeNode[], parent = ''): { value: number; label: string }[] {
  return nodes.flatMap((n) => {
    const label = parent ? `${parent} / ${n.label}` : n.label
    return [{ value: n.id, label }, ...flattenCategories(n.children, label)]
  })
}
const statusFilters = computed<VxeColumnPropTypes.Filters>(() => [
  { label: '启用', value: EnableStatus.Enabled, checked: appliedQuery.value.status === EnableStatus.Enabled },
  { label: '停用', value: EnableStatus.Disabled, checked: appliedQuery.value.status === EnableStatus.Disabled }
])
// VXE 会维护筛选项状态，保持每次查询之间的数组引用稳定，避免列配置反复重建。
const filtersByField = computed(
  () =>
    Object.fromEntries(filterFields.map((field) => [field, buildColumnFilters(field)])) as Record<
      keyof ItemFilters,
      VxeColumnPropTypes.Filters
    >
)
function columnFilters(field: keyof ItemFilters): VxeColumnPropTypes.Filters {
  return filtersByField.value[field]
}
const loading = ref(false)
const deletingId = ref<number>()
const drawerOpen = ref(false)
const drawerLoading = ref(false)
const saving = ref(false)
const mode = ref<DrawerMode>('create')
const detail = ref<Item>()
const formRef = ref<FormInstance>()
const form = ref<SaveItemRequest>(emptyForm())
let savedSnapshot = ''
let listSequence = 0
let drawerSequence = 0

const canQuery = computed(() => auth.hasPermi('masterdata:item:query'))
const canCreate = computed(() => auth.hasPermi('masterdata:item:add'))
const canEdit = computed(() => canQuery.value && auth.hasPermi('masterdata:item:edit'))
const canRemove = computed(() => auth.hasPermi('masterdata:item:remove'))
const readonly = computed(() => mode.value === 'detail')
const drawerTitle = computed(() => ({ create: '新增料品', edit: '编辑料品', detail: '料品详情' })[mode.value])
const rules: FormRules<SaveItemRequest> = {
  itemCode: [{ required: true, whitespace: true, message: '请输入料品编码', trigger: 'blur' }],
  itemName: [{ required: true, whitespace: true, message: '请输入料品名称', trigger: 'blur' }],
  categoryId: [{ required: true, message: '请选择分类', trigger: 'change' }],
  baseUnitId: [{ required: true, message: '请选择库存单位', trigger: 'change' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }]
}

function emptyForm(): SaveItemRequest {
  return {
    itemCode: '',
    itemName: '',
    specification: '',
    categoryId: undefined,
    baseUnitId: undefined,
    purchaseUnitId: null,
    salesUnitId: null,
    purchaseEnabled: true,
    defaultTaxRate: null,
    status: EnableStatus.Enabled,
    remark: ''
  }
}

/** 审计和删除标记不发送给服务端。 */
function toForm(item: Item): SaveItemRequest {
  return {
    itemId: item.itemId,
    itemCode: item.itemCode,
    itemName: item.itemName,
    specification: item.specification,
    categoryId: item.categoryId,
    baseUnitId: item.baseUnitId,
    purchaseUnitId: item.purchaseUnitId,
    salesUnitId: item.salesUnitId,
    purchaseEnabled: item.purchaseEnabled,
    defaultTaxRate: item.defaultTaxRate,
    status: item.status,
    remark: item.remark,
    version: item.version
  }
}

/** 仅提交最新结果；失败时恢复已生效的分页、排序和筛选指示。 */
async function loadItems(filters: ItemQuery = appliedQuery.value): Promise<void> {
  const sequence = ++listSequence
  const requested = { ...filters }
  loading.value = true
  try {
    const { data } = await listItems(requested)
    if (sequence !== listSequence) return
    const lastPage = Math.max(1, Math.ceil(data.total / requested.pageSize))
    if (requested.pageNum > lastPage && data.total > 0) {
      await loadItems({ ...requested, pageNum: lastPage })
      return
    }
    if (!data.total && requested.pageNum > 1) requested.pageNum = 1
    rows.value = data.rows
    total.value = data.total
    appliedQuery.value = requested
    Object.assign(query, filtersOf(requested))
    Object.assign(pagination, { pageNum: requested.pageNum, pageSize: requested.pageSize })
    await syncSort(sequence)
  } catch {
    if (sequence !== listSequence) return
    appliedQuery.value = { ...appliedQuery.value }
    Object.assign(pagination, { pageNum: appliedQuery.value.pageNum, pageSize: appliedQuery.value.pageSize })
    Object.assign(query, filtersOf(appliedQuery.value))
    await syncSort(sequence)
  } finally {
    if (sequence === listSequence) loading.value = false
  }
}

/** 使用不会触发查询事件的 VXE 方法同步排序，避免失败恢复递归请求。 */
async function syncSort(sequence: number) {
  await nextTick()
  if (sequence !== listSequence) return
  const applied = appliedQuery.value
  if (applied.sortField) await tableRef.value?.sort(applied.sortField, applied.sortDirection)
  else await tableRef.value?.clearSort()
}

function filtersOf(source: ItemFilters): ItemFilters {
  return Object.fromEntries(filterFields.map((f) => [f, source[f]])) as ItemFilters
}
function searchItems() {
  void loadItems({
    ...appliedQuery.value,
    itemCode: query.itemCode?.trim() || undefined,
    itemName: query.itemName?.trim() || undefined,
    categoryId: query.categoryId || undefined,
    status: query.status || undefined,
    pageNum: 1
  })
}

function changePage(pageNum: number, pageSize: number) {
  void loadItems({ ...appliedQuery.value, pageNum: pageSize !== appliedQuery.value.pageSize ? 1 : pageNum, pageSize })
}

function handleSort({ field, order }: VxeTableDefines.SortChangeEventParams<Item>) {
  if (!['itemCode', 'itemName', 'specification', 'updateTime'].includes(field)) return
  void loadItems({
    ...appliedQuery.value,
    pageNum: 1,
    sortField: order ? (field as ItemSortField) : undefined,
    sortDirection: order || undefined
  })
}

function textFilters(value?: string): VxeColumnPropTypes.Filters<string> {
  return [{ label: '包含', value: 'contains', data: value ?? '', checked: Boolean(value) }]
}

async function applyTextFilter(event: Event, params: VxeColumnSlotTypes.FilterSlotParams<Item>, clear = false) {
  const field = params.column.field
  if (field !== 'itemCode' && field !== 'itemName' && field !== 'specification') return
  await tableRef.value?.setFilterByEvent(event, params.column, textFilters(clear ? '' : filterDraft[field].trim()))
  await tableRef.value?.closeFilter()
}

function handleFilterVisible({ field, visible }: VxeTableDefines.FilterVisibleEventParams<Item>) {
  if (visible && (field === 'itemCode' || field === 'itemName' || field === 'specification'))
    filterDraft[field] = appliedQuery.value[field] ?? ''
}

/** 列筛选和顶部表单使用同一组已提交条件。 */
function handleColumnFilter({ filterList }: VxeTableDefines.FilterChangeEventParams<Item>) {
  const filters: ItemFilters = filtersOf({})
  for (const filter of filterList) {
    if (filter.field === 'itemCode' || filter.field === 'itemName' || filter.field === 'specification') {
      const value: unknown = filter.datas[0]
      filters[filter.field] = typeof value === 'string' ? value.trim() || undefined : undefined
    } else if (filter.field === 'status') {
      const value: unknown = filter.values[0]
      if (value === '0' || value === '1') filters.status = value
    } else if (filter.field === 'purchaseEnabled') {
      const value: unknown = filter.values[0]
      if (typeof value === 'boolean') filters.purchaseEnabled = value
    } else if (
      filter.field === 'categoryId' ||
      filter.field === 'baseUnitId' ||
      filter.field === 'purchaseUnitId' ||
      filter.field === 'salesUnitId'
    ) {
      const value: unknown = filter.values[0]
      if (typeof value === 'number') filters[filter.field] = value
    }
  }
  Object.assign(query, filters)
  void loadItems({ ...appliedQuery.value, ...filters, pageNum: 1 })
}

async function resetQuery() {
  Object.assign(query, filtersOf({}))
  await tableRef.value?.closeFilter()
  await loadItems({ pageNum: 1, pageSize: appliedQuery.value.pageSize })
}

/** 编辑前读取最新详情与版本，忽略关闭或切换抽屉后的迟到响应。 */
async function openDrawer(nextMode: DrawerMode, row?: Item) {
  if (nextMode !== 'create' && !row) return
  const sequence = ++drawerSequence
  mode.value = nextMode
  initialUnitSelected = nextMode !== 'create'
  activeTab.value = 'basic'
  drawerLoading.value = true
  drawerOpen.value = true
  detail.value = undefined
  form.value = emptyForm()
  savedSnapshot = JSON.stringify(form.value)
  try {
    await loadOptions()
    if (sequence !== drawerSequence) return
    if (nextMode !== 'create' && row) {
      const { data } = await getItem(row.itemId)
      if (sequence !== drawerSequence) return
      detail.value = data
      form.value = toForm(data)
    }
    savedSnapshot = JSON.stringify(form.value)
    await nextTick()
    if (sequence === drawerSequence) formRef.value?.clearValidate()
  } catch {
    if (sequence === drawerSequence) drawerOpen.value = false
  } finally {
    if (sequence === drawerSequence) drawerLoading.value = false
  }
}

async function beforeClose(done: () => void) {
  if (saving.value) return
  if (!readonly.value && JSON.stringify(form.value) !== savedSnapshot) {
    try {
      await ElMessageBox.confirm('尚有未保存的修改，是否放弃？', '关闭编辑', {
        type: 'warning',
        confirmButtonText: '放弃修改',
        cancelButtonText: '继续编辑'
      })
    } catch {
      return
    }
  }
  drawerSequence++
  done()
}

async function saveItem() {
  if (saving.value || drawerLoading.value || !formRef.value) return
  saving.value = true
  try {
    if (!(await formRef.value.validate().catch(() => false))) {
      activeTab.value =
        !form.value.itemCode.trim() || !form.value.itemName.trim() || !form.value.categoryId ? 'basic' : 'units'
      return
    }
    const data = {
      ...form.value,
      itemCode: form.value.itemCode.trim(),
      itemName: form.value.itemName.trim(),
      specification: form.value.specification.trim(),
      purchaseUnitId: form.value.purchaseUnitId || null,
      salesUnitId: form.value.salesUnitId || null,
      defaultTaxRate: form.value.defaultTaxRate ?? null,
      remark: form.value.remark.trim()
    }
    if (mode.value === 'create') await createItem(data)
    else await updateItem(data)
    ElMessage.success(mode.value === 'create' ? '料品新增成功' : '料品修改成功')
    drawerSequence++
    drawerOpen.value = false
    await loadItems()
  } catch {
    // 请求层显示错误，保留表单供用户修正或刷新版本。
  } finally {
    saving.value = false
  }
}

async function removeItem(row: Item) {
  if (deletingId.value !== undefined) return
  deletingId.value = row.itemId
  try {
    try {
      await ElMessageBox.confirm(`确认删除“${row.itemName}”（${row.itemCode}）？删除后编码仍保留占用。`, '删除料品', {
        type: 'warning',
        confirmButtonText: '确认删除',
        cancelButtonText: '取消'
      })
    } catch {
      return
    }
    await deleteItem(row.itemId, row.version)
    ElMessage.success('料品已删除')
    await loadItems()
  } catch {
    // 版本冲突及服务端规则错误由请求层显示，列表保留原数据。
  } finally {
    deletingId.value = undefined
  }
}

onMounted(() => {
  void loadItems()
  void loadOptions().catch(() => {
    /* 请求层显示错误，打开抽屉可重试。 */
  })
})
</script>
<style scoped lang="scss">
.query-form {
  margin-bottom: 4px;
}
.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.result-count,
.field-hint {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.field-hint {
  margin-top: 6px;
  line-height: 1.6;
}
.item-pagination {
  margin-top: 16px;
  justify-content: flex-end;
  flex-wrap: wrap;
  row-gap: 8px;
}
.audit-info {
  margin-top: 24px;
}
.column-text-filter {
  width: 240px;
  padding: 12px;
}
.filter-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}
.tax-hint {
  margin-left: 12px;
}
@media (max-width: 600px) {
  .form-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>

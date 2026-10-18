<template>
  <div class="app-container">
    <el-form inline @submit.prevent="search">
      <el-form-item label="料品"><el-input v-model="draft.keyword" placeholder="编码或名称" clearable /></el-form-item>
      <el-form-item label="仓库编码">
        <el-input v-model="draft.warehouseCode" placeholder="完整编码，精确匹配" clearable />
      </el-form-item>
      <el-form-item label="货位编码">
        <el-input v-model="draft.locationCode" placeholder="完整编码，精确匹配" clearable />
      </el-form-item>
      <el-form-item><el-checkbox v-model="draft.onlyPositive">仅有库存</el-checkbox></el-form-item>
      <el-form-item>
        <el-button type="primary" native-type="submit" :loading="loading">查询</el-button>
        <el-button :disabled="loading" @click="reset">重置</el-button>
      </el-form-item>
    </el-form>
    <div class="toolbar">
      <span>共 {{ total }} 条记录</span>
      <el-button :disabled="loading" @click="load()">刷新</el-button>
    </div>
    <el-alert
      v-if="failed"
      title="查询失败，已保留上次结果及生效条件，可刷新重试。"
      type="warning"
      :closable="false"
      show-icon
      style="margin-bottom: 12px"
    />
    <vxe-table
      ref="table"
      :data="rows"
      :loading="loading"
      border
      stripe
      show-overflow
      max-height="640"
      :row-config="{ keyField: 'balanceId', isHover: true }"
      :column-config="{ resizable: true, drag: true }"
      :column-drag-config="{ trigger: 'default', showIcon: true }"
      :sort-config="{ remote: true, allowClear: true }"
      :filter-config="{ remote: true }"
      @sort-change="sort"
      @filter-change="filter"
      @filter-visible="filterVisible"
    >
      <vxe-column
        field="itemCode"
        title="料品编码"
        width="170"
        fixed="left"
        :filters="keywordFilters"
        :filter-multiple="false"
      >
        <template #filter="params">
          <form class="column-filter" @submit.prevent="applyKeyword($event, params)">
            <el-input v-model="keywordDraft" placeholder="料品编码或名称" clearable />
            <div>
              <el-button size="small" @click="applyKeyword($event, params, true)">清除</el-button>
              <el-button size="small" type="primary" native-type="submit">筛选</el-button>
            </div>
          </form>
        </template>
      </vxe-column>
      <vxe-column field="itemName" title="料品名称" min-width="180" />
      <vxe-column field="specification" title="规格" min-width="160" />
      <vxe-column field="warehouseCode" title="仓库编码" width="140" />
      <vxe-column field="warehouseName" title="仓库名称" min-width="160" />
      <vxe-column field="locationCode" title="货位编码" width="140">
        <template #default="{ row }">{{ row.locationCode || '—' }}</template>
      </vxe-column>
      <vxe-column field="locationName" title="货位名称" width="140">
        <template #default="{ row }">{{ row.locationName || '—' }}</template>
      </vxe-column>
      <vxe-column field="unitName" title="库存单位" width="100" />
      <vxe-column field="quantity" title="库存数量" width="150" align="right" sortable fixed="right" />
      <vxe-column title="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="auth.hasPermi('inventory:transaction:list')"
            link
            type="primary"
            @click="showTransactions(row)"
          >
            查看流水
          </el-button>
        </template>
      </vxe-column>
      <template #empty><el-empty description="暂无符合条件的库存记录" :image-size="80" /></template>
    </vxe-table>
    <el-pagination
      v-model:current-page="pager.pageNum"
      v-model:page-size="pager.pageSize"
      :total="total"
      :page-sizes="[10, 20, 50, 100]"
      :disabled="loading"
      layout="total,sizes,prev,pager,next,jumper"
      background
      class="pagination"
      @change="paginate"
    />
  </div>
</template>
<script setup lang="ts" name="InventoryBalance">
import { computed, nextTick, onActivated, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import type { VxeTableInstance, VxeTableDefines, VxeColumnPropTypes, VxeColumnSlotTypes } from 'vxe-table'
import { listBalances } from '@/api/inventory'

import type { Balance, InventoryQuery } from '@/types/api/inventory'
import auth from '@/plugins/auth'
import { useVxe } from '@/plugins/vxe'
useVxe()
const router = useRouter()
const table = ref<VxeTableInstance<Balance>>(),
  rows = shallowRef<Balance[]>([]),
  total = ref(0),
  loading = ref(false),
  failed = ref(false)
const draft = reactive({
  keyword: '',
  warehouseCode: '',
  locationCode: '',
  onlyPositive: true,
  receiptNo: '',
  businessType: undefined as InventoryQuery['businessType']
})
const dates = ref<[string, string] | null>(null),
  pager = reactive({ pageNum: 1, pageSize: 20 }),
  applied = ref<InventoryQuery>({ pageNum: 1, pageSize: 20, onlyPositive: true }),
  keywordDraft = ref('')
const keywordFilters = computed<VxeColumnPropTypes.Filters>(() => [
  { label: '包含', value: 'contains', data: applied.value.keyword ?? '', checked: Boolean(applied.value.keyword) }
])
let sequence = 0,
  activated = false

function context(): Partial<InventoryQuery> {
  return {}
}
function restore() {
  Object.assign(draft, {
    keyword: applied.value.keyword ?? '',
    warehouseCode: applied.value.warehouseCode ?? '',
    locationCode: applied.value.locationCode ?? '',
    onlyPositive: applied.value.onlyPositive ?? true,
    receiptNo: applied.value.receiptNo ?? '',
    businessType: applied.value.businessType
  })
  dates.value =
    applied.value.beginTime && applied.value.endTime ? [applied.value.beginTime, applied.value.endTime] : null
}
async function sync(current: number) {
  await nextTick()
  if (current !== sequence) return
  if (applied.value.sortField) await table.value?.sort(applied.value.sortField, applied.value.sortDirection)
  else await table.value?.clearSort()
}
async function load(q: InventoryQuery = applied.value) {
  const current = ++sequence,
    requested = { ...q }
  loading.value = true
  try {
    const { data } = await listBalances(requested)
    if (current !== sequence) return
    const last = Math.max(1, Math.ceil(data.total / requested.pageSize))
    if (requested.pageNum > last) {
      await load({ ...requested, pageNum: last })
      return
    }
    rows.value = data.rows
    total.value = data.total
    applied.value = requested
    Object.assign(pager, { pageNum: requested.pageNum, pageSize: requested.pageSize })
    restore()
    failed.value = false
    await sync(current)
  } catch {
    if (current !== sequence) return
    failed.value = true
    applied.value = { ...applied.value }
    Object.assign(pager, { pageNum: applied.value.pageNum, pageSize: applied.value.pageSize })
    restore()
    await sync(current)
  } finally {
    if (current === sequence) loading.value = false
  }
}
function search() {
  void load({
    ...applied.value,
    ...context(),
    pageNum: 1,
    keyword: draft.keyword.trim() || undefined,
    warehouseCode: draft.warehouseCode.trim() || undefined,
    locationCode: draft.locationCode.trim() || undefined,
    onlyPositive: draft.onlyPositive
  })
}
function reset() {
  void load({ pageNum: 1, pageSize: applied.value.pageSize, ...context(), onlyPositive: true })
}
function paginate(pageNum: number, pageSize: number) {
  void load({ ...applied.value, pageNum: pageSize === applied.value.pageSize ? pageNum : 1, pageSize })
}
function sort({ field, order }: VxeTableDefines.SortChangeEventParams<Balance>) {
  if (field !== 'quantity') return
  void load({ ...applied.value, pageNum: 1, sortField: order ? field : undefined, sortDirection: order || undefined })
}
function filterVisible({ visible }: VxeTableDefines.FilterVisibleEventParams<Balance>) {
  if (visible) keywordDraft.value = applied.value.keyword ?? ''
}
async function applyKeyword(event: Event, params: VxeColumnSlotTypes.FilterSlotParams<Balance>, clear = false) {
  const value = clear ? '' : keywordDraft.value.trim()
  await table.value?.setFilterByEvent(event, params.column, [
    { label: '包含', value: 'contains', data: value, checked: Boolean(value) }
  ])
  await table.value?.closeFilter()
}
function filter({ filterList }: VxeTableDefines.FilterChangeEventParams<Balance>) {
  const value: unknown = filterList.find((row) => row.field === 'itemCode')?.datas[0]
  void load({
    ...applied.value,
    pageNum: 1,
    keyword: typeof value === 'string' ? value.trim() || undefined : undefined
  })
}
function showTransactions(row: Balance) {
  void router.push({
    path: '/inventory/transaction',
    query: {
      warehouseId: row.warehouseId,
      itemId: row.itemId,
      ...(row.locationId ? { locationId: row.locationId } : { withoutLocation: 'true' })
    }
  })
}
onMounted(() => void load({ ...applied.value, ...context() }))
onActivated(() => {
  if (activated) void load()
  activated = true
})
onBeforeUnmount(() => {
  sequence++
})
</script>
<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  color: var(--el-text-color-secondary);
}
.pagination {
  margin-top: 16px;
  justify-content: flex-end;
  flex-wrap: wrap;
}
.column-filter {
  padding: 12px;
  width: 240px;
}
.column-filter > div:last-child {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>

<template>
  <div class="app-container">
    <el-alert
      v-if="hasContext"
      title="当前按所选库存维度查看流水"
      type="info"
      show-icon
      style="margin-bottom: 16px"
      @close="router.replace('/inventory/transaction')"
    />
    <el-form inline @submit.prevent="search">
      <el-form-item label="料品"><el-input v-model="draft.keyword" placeholder="编码或名称" clearable /></el-form-item>
      <el-form-item label="仓库编码">
        <el-input v-model="draft.warehouseCode" placeholder="完整编码，精确匹配" clearable />
      </el-form-item>
      <el-form-item label="货位编码">
        <el-input v-model="draft.locationCode" placeholder="完整编码，精确匹配" clearable />
      </el-form-item>
      <el-form-item label="入库单号"><el-input v-model="draft.receiptNo" clearable /></el-form-item>
      <el-form-item label="业务类型">
        <el-select v-model="draft.businessType" clearable style="width: 180px">
          <el-option v-for="(label, value) in inventoryBusinessLabels" :key="value" :label="label" :value="value" />
        </el-select>
      </el-form-item>
      <el-form-item label="记账时间">
        <el-date-picker
          v-model="dates"
          type="datetimerange"
          value-format="YYYY-MM-DD HH:mm:ss"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
        />
      </el-form-item>
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
      :row-config="{ keyField: 'transactionId', isHover: true }"
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
      <vxe-column field="businessType" title="业务类型" width="150">
        <template #default="{ row }">{{ businessLabel(row.businessType) }}</template>
      </vxe-column>
      <vxe-column field="quantityChange" title="增减数量" width="150" align="right" fixed="right" />
      <vxe-column field="quantityBefore" title="变动前余额" width="160" align="right" />
      <vxe-column field="quantityAfter" title="变动后余额" width="160" align="right" />
      <vxe-column field="receiptNo" title="业务单号" width="240">
        <template #default="{ row }">
          <el-button
            v-if="auth.hasPermi('purchase:receipt:query')"
            link
            type="primary"
            @click="router.push(`/purchase/receipt-document/${row.receiptId}/detail`)"
          >
            {{ row.receiptNo }}
          </el-button>
          <span v-else>{{ row.receiptNo }}</span>
        </template>
      </vxe-column>
      <vxe-column field="businessDate" title="业务日期" width="140" />
      <vxe-column field="postedTime" title="实际记账时间" width="200" sortable />
      <vxe-column field="createBy" title="操作者" width="120" />
      <vxe-column field="reversalOf" title="原流水 ID" width="130" />
      <vxe-column field="remark" title="说明" min-width="180" />
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
<script setup lang="ts" name="InventoryTransaction">
import { computed, nextTick, onActivated, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { VxeTableInstance, VxeTableDefines, VxeColumnPropTypes, VxeColumnSlotTypes } from 'vxe-table'
import { listInventoryTransactions } from '@/api/inventory'
import { inventoryBusinessLabels } from '@/types/api/inventory'
import type { InventoryTransaction, InventoryQuery } from '@/types/api/inventory'
import auth from '@/plugins/auth'
import { useVxe } from '@/plugins/vxe'
useVxe()
const route = useRoute(),
  router = useRouter()
const table = ref<VxeTableInstance<InventoryTransaction>>(),
  rows = shallowRef<InventoryTransaction[]>([]),
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
  applied = ref<InventoryQuery>({ pageNum: 1, pageSize: 20, sortDirection: 'desc' }),
  keywordDraft = ref('')
const hasContext = computed(() =>
  Boolean(route.query.itemId || route.query.warehouseId || route.query.locationId || route.query.withoutLocation)
)
const keywordFilters = computed<VxeColumnPropTypes.Filters>(() => [
  { label: '包含', value: 'contains', data: applied.value.keyword ?? '', checked: Boolean(applied.value.keyword) }
])
let sequence = 0,
  activated = false
function businessLabel(type: keyof typeof inventoryBusinessLabels) {
  return inventoryBusinessLabels[type]
}
function context(): Partial<InventoryQuery> {
  const result: Partial<InventoryQuery> = {}
  for (const key of ['warehouseId', 'locationId', 'itemId'] as const) {
    const n = Number(route.query[key])
    if (Number.isSafeInteger(n) && n > 0) result[key] = n
  }
  if (route.query.withoutLocation === 'true') result.withoutLocation = true
  return result
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
    const { data } = await listInventoryTransactions(requested)
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
    receiptNo: draft.receiptNo.trim() || undefined,
    businessType: draft.businessType,
    beginTime: dates.value?.[0],
    endTime: dates.value?.[1]
  })
}
function reset() {
  void load({ pageNum: 1, pageSize: applied.value.pageSize, ...context(), sortDirection: 'desc' })
}
function paginate(pageNum: number, pageSize: number) {
  void load({ ...applied.value, pageNum: pageSize === applied.value.pageSize ? pageNum : 1, pageSize })
}
function sort({ field, order }: VxeTableDefines.SortChangeEventParams<InventoryTransaction>) {
  if (field !== 'postedTime') return
  void load({ ...applied.value, pageNum: 1, sortField: order ? field : undefined, sortDirection: order || undefined })
}
function filterVisible({ visible }: VxeTableDefines.FilterVisibleEventParams<InventoryTransaction>) {
  if (visible) keywordDraft.value = applied.value.keyword ?? ''
}
async function applyKeyword(
  event: Event,
  params: VxeColumnSlotTypes.FilterSlotParams<InventoryTransaction>,
  clear = false
) {
  const value = clear ? '' : keywordDraft.value.trim()
  await table.value?.setFilterByEvent(event, params.column, [
    { label: '包含', value: 'contains', data: value, checked: Boolean(value) }
  ])
  await table.value?.closeFilter()
}
function filter({ filterList }: VxeTableDefines.FilterChangeEventParams<InventoryTransaction>) {
  const value: unknown = filterList.find((row) => row.field === 'itemCode')?.datas[0]
  void load({
    ...applied.value,
    pageNum: 1,
    keyword: typeof value === 'string' ? value.trim() || undefined : undefined
  })
}

watch(
  () => route.fullPath,
  () => void load({ pageNum: 1, pageSize: applied.value.pageSize, ...context(), sortDirection: 'desc' })
)
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

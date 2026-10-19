<template>
  <div class="app-container">
    <QueryPanel
      :metadata="queryDefinition.metadata.value"
      :applied-values="configuredValues"
      :applied-advanced="applied.advanced"
      :busy="loading"
      @submit="searchConfigured"
      @reload="reloadDefinition"
    />
    <div class="toolbar">
      <span>共 {{ total }} 张订单</span>
      <div>
        <el-button
          v-if="can('add')"
          type="primary"
          :disabled="loading"
          @click="router.push('/purchase/order-document/create')"
        >
          新增采购订单
        </el-button>
        <el-button :disabled="loading" @click="load()">刷新</el-button>
      </div>
    </div>
    <vxe-table
      ref="table"
      :data="rows"
      :loading="loading"
      border
      stripe
      show-overflow
      max-height="640"
      :row-config="{ keyField: 'orderId', isHover: true }"
      :column-config="{ resizable: true, drag: true }"
      :column-drag-config="{ trigger: 'default', showIcon: true }"
      :sort-config="{ remote: true, allowClear: true }"
      :filter-config="{ remote: true }"
      @sort-change="sort"
      @filter-change="filter"
      @filter-visible="filterVisible"
    >
      <vxe-column
        field="orderNo"
        title="订单号"
        width="250"
        :sortable="queryDefinition.canSort('orderNo')"
        :filters="queryDefinition.canColumnFilter('orderNo') ? numberFilters : undefined"
        :filter-multiple="false"
      >
        <template #default="{ row }">
          <el-button v-if="can('query')" link type="primary" @click="open(row)">{{ row.orderNo }}</el-button>
          <span v-else>{{ row.orderNo }}</span>
        </template>
        <template #filter="params">
          <form class="number-filter" @submit.prevent="applyNumber($event, params)">
            <el-input v-model="numberDraft" :placeholder="`${columnOperator()}订单号`" maxlength="64" clearable />
            <div>
              <el-button size="small" @click="applyNumber($event, params, true)">清除</el-button>
              <el-button size="small" type="primary" native-type="submit">筛选</el-button>
            </div>
          </form>
        </template>
      </vxe-column>
      <vxe-column field="orderDate" title="订单日期" width="140" :sortable="queryDefinition.canSort('orderDate')" />
      <vxe-column field="supplierName" title="供应商" min-width="220" />
      <vxe-column
        field="status"
        title="状态"
        width="120"
        :filters="queryDefinition.canColumnFilter('status') ? statusFilters : undefined"
        :filter-multiple="false"
      >
        <template #default="{ row }">
          <el-tag :type="row.status === 'DRAFT' ? 'info' : row.status === 'APPROVED' ? 'success' : 'primary'">
            {{ statusLabel(row.status) }}
          </el-tag>
        </template>
      </vxe-column>
      <vxe-column field="buyerName" title="采购员" width="120" />
      <vxe-column field="arrivalProgress" title="到货进度" width="120">
        <template #default="{ row }">{{ progressLabel(row.arrivalProgress) }}</template>
      </vxe-column>
      <vxe-column field="receiptProgress" title="入库进度" width="120">
        <template #default="{ row }">{{ receiptProgressLabel(row.receiptProgress) }}</template>
      </vxe-column>
      <vxe-column field="deptName" title="采购部门" width="150" />
      <vxe-column field="lineCount" title="明细行数" width="100" align="right" />
      <vxe-column field="netAmount" title="未税金额" width="160" align="right" />
      <vxe-column field="tax" title="税额" width="150" align="right" />
      <vxe-column
        field="grossAmount"
        title="价税合计"
        width="170"
        align="right"
        :sortable="queryDefinition.canSort('grossAmount')"
      />
      <vxe-column
        field="updateTime"
        title="最后修改时间"
        width="200"
        :sortable="queryDefinition.canSort('updateTime')"
      />
      <vxe-column title="操作" width="190" fixed="right">
        <template #default="{ row }">
          <el-button v-if="can('query')" link type="primary" @click="open(row)">详情</el-button>
          <el-button
            v-if="row.status === 'DRAFT' && can('edit') && can('query')"
            link
            type="primary"
            @click="open(row, true)"
          >
            编辑
          </el-button>
          <el-button
            v-if="row.status === 'DRAFT' && can('remove')"
            link
            type="danger"
            :disabled="loading || removing !== null"
            @click="remove(row)"
          >
            删除
          </el-button>
        </template>
      </vxe-column>
      <template #empty><el-empty description="暂无符合条件的采购订单" :image-size="80" /></template>
    </vxe-table>
    <el-pagination
      v-model:current-page="page.pageNum"
      v-model:page-size="page.pageSize"
      :total="total"
      :page-sizes="[10, 20, 50, 100]"
      :disabled="loading"
      background
      layout="total, sizes, prev, pager, next, jumper"
      class="pagination"
      @change="changePage"
    />
  </div>
</template>
<script setup lang="ts" name="PurchaseOrder">
import { computed, nextTick, onActivated, onMounted, reactive, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { VxeTableInstance, VxeTableDefines, VxeColumnPropTypes, VxeColumnSlotTypes } from 'vxe-table'
import { deleteOrder } from '@/api/purchase/order'
import { orderStatusLabels, arrivalProgressLabels, receiptProgressLabels } from '@/types/api/purchase/order'
import type { Order, OrderQuery, OrderSortField, OrderStatus, ArrivalProgress } from '@/types/api/purchase/order'
import { useVxe } from '@/plugins/vxe'
import type { ReceiptProgress } from '@/types/api/purchase/arrival'
import auth from '@/plugins/auth'
useVxe()
import QueryPanel from '@/components/query/QueryPanel.vue'
import { useQueryDefinition, buildRequest, operatorLabels } from '@/components/query/useQueryDefinition'
import { searchBusiness } from '@/api/system/query'
import type { QueryExtras, QuerySelection } from '@/types/api/system/query'
type OrderListQuery = OrderQuery & QueryExtras
const queryDefinition = useQueryDefinition('purchase.order')
const orderBaseKeys = ['orderNo', 'supplierId', 'status'] as const
const configuredValues = computed(() => queryDefinition.values(applied.value, orderBaseKeys))
async function reloadDefinition() {
  try {
    await queryDefinition.ensure(true)
  } catch {
    /* 保留成功结果。 */
  }
}
function searchConfigured(selection: QuerySelection) {
  const known = Object.fromEntries(orderBaseKeys.map((key) => [key, selection.values[key]])) as Pick<
    OrderQuery,
    'orderNo' | 'supplierId' | 'status'
  >
  void load({
    ...applied.value,
    ...known,
    values: queryDefinition.extras(selection.values, orderBaseKeys),
    advanced: selection.advanced,
    beginDate: undefined,
    endDate: undefined,
    pageNum: 1
  })
}
const router = useRouter(),
  table = ref<VxeTableInstance<Order>>()
const rows = shallowRef<Order[]>([]),
  total = ref(0),
  loading = ref(false),
  removing = ref<number | null>(null)
const draft = reactive<{ orderNo: string; supplierId: number | null; status: OrderStatus | undefined }>({
  orderNo: '',
  supplierId: null,
  status: undefined
})
const dates = ref<[string, string] | null>(null),
  page = reactive({ pageNum: 1, pageSize: 20 })
const applied = ref<OrderListQuery>({ pageNum: 1, pageSize: 20 }),
  numberDraft = ref('')
let sequence = 0,
  activated = false
const can = (suffix: string) => auth.hasPermi(`purchase:order:${suffix}`)
function statusLabel(status: OrderStatus) {
  return orderStatusLabels[status]
}
function receiptProgressLabel(progress: ReceiptProgress) {
  return receiptProgressLabels[progress]
}
function progressLabel(progress: ArrivalProgress) {
  return arrivalProgressLabels[progress]
}
function columnOperator() {
  return (
    operatorLabels[
      queryDefinition.metadata.value?.fields.find((f) => f.fieldKey === 'orderNo')?.defaultOperator || 'like'
    ] || '包含'
  )
}
const numberFilters = computed<VxeColumnPropTypes.Filters>(() => [
  {
    label: columnOperator(),
    value: 'contains',
    data: applied.value.orderNo ?? '',
    checked: Boolean(applied.value.orderNo)
  }
])
const statusFilters = computed<VxeColumnPropTypes.Filters>(() =>
  Object.entries(orderStatusLabels).map(([value, label]) => ({ label, value, checked: applied.value.status === value }))
)
function open(row: Order, edit = false) {
  void router.push(`/purchase/order-document/${row.orderId}/${edit ? 'edit' : 'detail'}`)
}
function restoreDraft() {
  draft.orderNo = applied.value.orderNo ?? ''
  draft.supplierId = applied.value.supplierId ?? null
  draft.status = applied.value.status
  dates.value =
    applied.value.beginDate && applied.value.endDate ? [applied.value.beginDate, applied.value.endDate] : null
}
async function syncSort(current: number) {
  await nextTick()
  if (current !== sequence) return
  if (applied.value.sortField) await table.value?.sort(applied.value.sortField, applied.value.sortDirection)
  else await table.value?.clearSort()
}
async function load(query: OrderListQuery = applied.value) {
  const current = ++sequence,
    requested = { ...query }
  loading.value = true
  try {
    const metadata = await queryDefinition.ensure()
    const request = buildRequest(
      metadata,
      requested,
      queryDefinition.values(requested, orderBaseKeys),
      requested.advanced
    )
    const { data } = await searchBusiness<Order>('/purchase/order/search', request)
    if (current !== sequence) return
    const last = Math.max(1, Math.ceil(data.total / requested.pageSize))
    if (requested.pageNum > last && data.total > 0) {
      await load({ ...requested, pageNum: last })
      return
    }
    if (!data.total) requested.pageNum = 1
    rows.value = data.rows
    total.value = data.total
    applied.value = requested
    Object.assign(page, { pageNum: requested.pageNum, pageSize: requested.pageSize })
    await syncSort(current)
  } catch {
    if (current !== sequence) return
    applied.value = { ...applied.value }
    Object.assign(page, { pageNum: applied.value.pageNum, pageSize: applied.value.pageSize })
    restoreDraft()
    await syncSort(current)
  } finally {
    if (current === sequence) loading.value = false
  }
}
function changePage(pageNum: number, pageSize: number) {
  void load({ ...applied.value, pageNum: pageSize === applied.value.pageSize ? pageNum : 1, pageSize })
}
function sort({ field, order }: VxeTableDefines.SortChangeEventParams<Order>) {
  const allowed: OrderSortField[] = ['orderNo', 'orderDate', 'updateTime', 'grossAmount']
  if (!allowed.includes(field as OrderSortField)) return
  void load({
    ...applied.value,
    pageNum: 1,
    sortField: order ? (field as OrderSortField) : undefined,
    sortDirection: order || undefined
  })
}
function filterVisible({ field, visible }: VxeTableDefines.FilterVisibleEventParams<Order>) {
  if (field === 'orderNo' && visible) numberDraft.value = applied.value.orderNo ?? ''
}
async function applyNumber(event: Event, params: VxeColumnSlotTypes.FilterSlotParams<Order>, clear = false) {
  const text = clear ? '' : numberDraft.value.trim()
  await table.value?.setFilterByEvent(event, params.column, [
    { label: columnOperator(), value: 'contains', data: text, checked: Boolean(text) }
  ])
  await table.value?.closeFilter()
}
function filter({ filterList }: VxeTableDefines.FilterChangeEventParams<Order>) {
  const query: OrderListQuery = { ...applied.value, pageNum: 1, orderNo: undefined, status: undefined }
  for (const item of filterList) {
    if (item.field === 'orderNo') {
      const data: unknown = item.datas[0]
      query.orderNo = typeof data === 'string' ? data.trim() || undefined : undefined
    } else if (item.field === 'status') {
      const value: unknown = item.values[0]
      if (typeof value === 'string' && value in orderStatusLabels) query.status = value as OrderStatus
    }
  }
  draft.orderNo = query.orderNo ?? ''
  draft.status = query.status
  void load(query)
}
async function remove(row: Order) {
  if (removing.value !== null) return
  removing.value = row.orderId
  try {
    await ElMessageBox.confirm(`确认删除采购订单“${row.orderNo}”？`, '删除草稿', {
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '取消'
    })
    await deleteOrder(row.orderId, row.version)
    ElMessage.success('订单已删除')
    await load()
  } catch {
    /* 请求层展示业务错误；取消不改变列表。 */
  } finally {
    removing.value = null
  }
}
onMounted(() => void load())
onActivated(() => {
  if (activated) void load()
  activated = true
})
</script>
<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
  flex-wrap: wrap;
  color: var(--el-text-color-secondary);
}
.pagination {
  margin-top: 16px;
  justify-content: flex-end;
  flex-wrap: wrap;
  row-gap: 8px;
}
.number-filter {
  width: 240px;
  padding: 12px;
}
.number-filter > div:last-child {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>

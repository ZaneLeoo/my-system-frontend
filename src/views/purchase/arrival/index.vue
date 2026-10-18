<template>
  <div class="app-container">
    <el-alert
      v-if="orderContext"
      :title="`当前显示来源采购订单 #${orderContext} 的到货单`"
      type="info"
      show-icon
      style="margin-bottom: 16px"
      @close="router.replace('/purchase/arrival')"
    />
    <el-form inline :model="draft" @submit.prevent="search">
      <el-form-item label="到货单号">
        <el-input v-model="draft.arrivalNo" clearable maxlength="64" placeholder="请输入到货单号" />
      </el-form-item>
      <el-form-item label="供应商"><SupplierPicker v-model="draft.supplierId" style="width: 260px" /></el-form-item>
      <el-form-item label="收货仓库"><WarehousePicker v-model="draft.warehouseId" style="width: 230px" /></el-form-item>
      <el-form-item label="状态">
        <el-select v-model="draft.status" clearable placeholder="全部状态" style="width: 140px">
          <el-option v-for="(label, value) in arrivalStatusLabels" :key="value" :label="label" :value="value" />
        </el-select>
      </el-form-item>
      <el-form-item label="到货日期">
        <el-date-picker
          v-model="dates"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" native-type="submit" :loading="loading">查询</el-button>
        <el-button :disabled="loading" @click="reset">重置</el-button>
      </el-form-item>
    </el-form>
    <div class="toolbar">
      <span>共 {{ total }} 张到货单</span>
      <div>
        <el-button
          v-if="can('add')"
          type="primary"
          :disabled="loading"
          @click="router.push('/purchase/arrival-document/create')"
        >
          新增采购到货单
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
      :row-config="{ keyField: 'arrivalId', isHover: true }"
      :column-config="{ resizable: true, drag: true }"
      :column-drag-config="{ trigger: 'default', showIcon: true }"
      :sort-config="{ remote: true, allowClear: true }"
      :filter-config="{ remote: true }"
      @sort-change="sort"
      @filter-change="filter"
      @filter-visible="filterVisible"
    >
      <vxe-column
        field="arrivalNo"
        title="到货单号"
        width="250"
        sortable
        :filters="numberFilters"
        :filter-multiple="false"
      >
        <template #default="{ row }">
          <el-button v-if="can('query')" link type="primary" @click="open(row)">{{ row.arrivalNo }}</el-button>
          <span v-else>{{ row.arrivalNo }}</span>
        </template>
        <template #filter="params">
          <form class="number-filter" @submit.prevent="applyNumber($event, params)">
            <el-input v-model="numberDraft" placeholder="包含到货单号" maxlength="64" clearable />
            <div>
              <el-button size="small" @click="applyNumber($event, params, true)">清除</el-button>
              <el-button size="small" type="primary" native-type="submit">筛选</el-button>
            </div>
          </form>
        </template>
      </vxe-column>
      <vxe-column field="arrivalDate" title="到货日期" width="140" sortable />
      <vxe-column field="supplierName" title="供应商" min-width="220" />
      <vxe-column field="status" title="状态" width="120" :filters="statusFilters" :filter-multiple="false">
        <template #default="{ row }">
          <el-tag :type="row.status === 'DRAFT' ? 'info' : row.status === 'APPROVED' ? 'success' : 'primary'">
            {{ statusLabel(row.status) }}
          </el-tag>
        </template>
      </vxe-column>
      <vxe-column field="receiptProgress" title="入库进度" width="120">
        <template #default="{ row }">{{ progressLabel(row.receiptProgress) }}</template>
      </vxe-column>
      <vxe-column field="warehouseName" title="收货仓库" min-width="160" />
      <vxe-column field="supplierDeliveryNo" title="供应商送货单号" min-width="170" />
      <vxe-column field="receiverName" title="收货经办人" width="120" />
      <vxe-column field="deptName" title="经办部门" width="150" />
      <vxe-column field="lineCount" title="明细行数" width="100" align="right" />
      <vxe-column field="updateTime" title="最后修改时间" width="200" sortable />
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
      <template #empty><el-empty description="暂无符合条件的采购到货单" :image-size="80" /></template>
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
<script setup lang="ts" name="PurchaseArrival">
import { computed, nextTick, onActivated, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { VxeTableInstance, VxeTableDefines, VxeColumnPropTypes, VxeColumnSlotTypes } from 'vxe-table'
import WarehousePicker from '@/components/masterdata/WarehousePicker/index.vue'
import SupplierPicker from '@/components/masterdata/SupplierPicker/index.vue'
import { listArrivals, deleteArrival } from '@/api/purchase/arrival'
import { arrivalStatusLabels, receiptProgressLabels } from '@/types/api/purchase/arrival'
import type { Arrival, ArrivalQuery, ArrivalSortField, ArrivalStatus } from '@/types/api/purchase/arrival'
import { useVxe } from '@/plugins/vxe'
import auth from '@/plugins/auth'
useVxe()
const route = useRoute()
const orderContext = computed(() => {
  const id = Number(route.query.orderId)
  return Number.isSafeInteger(id) && id > 0 ? id : undefined
})
const router = useRouter(),
  table = ref<VxeTableInstance<Arrival>>()
const rows = shallowRef<Arrival[]>([]),
  total = ref(0),
  loading = ref(false),
  removing = ref<number | null>(null)
const draft = reactive<{
  arrivalNo: string
  supplierId: number | null
  warehouseId: number | null
  status: ArrivalStatus | undefined
}>({
  arrivalNo: '',
  supplierId: null,
  warehouseId: null,
  status: undefined
})
const dates = ref<[string, string] | null>(null),
  page = reactive({ pageNum: 1, pageSize: 20 })
const applied = ref<ArrivalQuery>({ pageNum: 1, pageSize: 20, orderId: orderContext.value }),
  numberDraft = ref('')
let sequence = 0,
  activated = false
const can = (suffix: string) => auth.hasPermi(`purchase:arrival:${suffix}`)
function progressLabel(value: keyof typeof receiptProgressLabels) {
  return receiptProgressLabels[value]
}
function statusLabel(status: ArrivalStatus) {
  return arrivalStatusLabels[status]
}
const numberFilters = computed<VxeColumnPropTypes.Filters>(() => [
  { label: '包含', value: 'contains', data: applied.value.arrivalNo ?? '', checked: Boolean(applied.value.arrivalNo) }
])
const statusFilters = computed<VxeColumnPropTypes.Filters>(() =>
  Object.entries(arrivalStatusLabels).map(([value, label]) => ({
    label,
    value,
    checked: applied.value.status === value
  }))
)
function open(row: Arrival, edit = false) {
  void router.push(`/purchase/arrival-document/${row.arrivalId}/${edit ? 'edit' : 'detail'}`)
}
function restoreDraft() {
  draft.arrivalNo = applied.value.arrivalNo ?? ''
  draft.supplierId = applied.value.supplierId ?? null
  draft.warehouseId = applied.value.warehouseId ?? null
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
async function load(query: ArrivalQuery = applied.value) {
  const current = ++sequence,
    requested = { ...query }
  loading.value = true
  try {
    const { data } = await listArrivals(requested)
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
function search() {
  void load({
    ...applied.value,
    pageNum: 1,
    arrivalNo: draft.arrivalNo.trim() || undefined,
    supplierId: draft.supplierId ?? undefined,
    warehouseId: draft.warehouseId ?? undefined,
    status: draft.status,
    beginDate: dates.value?.[0],
    endDate: dates.value?.[1]
  })
}
async function reset() {
  draft.arrivalNo = ''
  draft.supplierId = null
  draft.warehouseId = null
  draft.status = undefined
  dates.value = null
  await table.value?.closeFilter()
  await load({ pageNum: 1, pageSize: applied.value.pageSize, orderId: orderContext.value })
}
function changePage(pageNum: number, pageSize: number) {
  void load({ ...applied.value, pageNum: pageSize === applied.value.pageSize ? pageNum : 1, pageSize })
}
function sort({ field, order }: VxeTableDefines.SortChangeEventParams<Arrival>) {
  const allowed: ArrivalSortField[] = ['arrivalNo', 'arrivalDate', 'updateTime']
  if (!allowed.includes(field as ArrivalSortField)) return
  void load({
    ...applied.value,
    pageNum: 1,
    sortField: order ? (field as ArrivalSortField) : undefined,
    sortDirection: order || undefined
  })
}
function filterVisible({ field, visible }: VxeTableDefines.FilterVisibleEventParams<Arrival>) {
  if (field === 'arrivalNo' && visible) numberDraft.value = applied.value.arrivalNo ?? ''
}
async function applyNumber(event: Event, params: VxeColumnSlotTypes.FilterSlotParams<Arrival>, clear = false) {
  const text = clear ? '' : numberDraft.value.trim()
  await table.value?.setFilterByEvent(event, params.column, [
    { label: '包含', value: 'contains', data: text, checked: Boolean(text) }
  ])
  await table.value?.closeFilter()
}
function filter({ filterList }: VxeTableDefines.FilterChangeEventParams<Arrival>) {
  const query: ArrivalQuery = { ...applied.value, pageNum: 1, arrivalNo: undefined, status: undefined }
  for (const item of filterList) {
    if (item.field === 'arrivalNo') {
      const data: unknown = item.datas[0]
      query.arrivalNo = typeof data === 'string' ? data.trim() || undefined : undefined
    } else if (item.field === 'status') {
      const value: unknown = item.values[0]
      if (typeof value === 'string' && value in arrivalStatusLabels) query.status = value as ArrivalStatus
    }
  }
  draft.arrivalNo = query.arrivalNo ?? ''
  draft.status = query.status
  void load(query)
}
async function remove(row: Arrival) {
  if (removing.value !== null) return
  removing.value = row.arrivalId
  try {
    await ElMessageBox.confirm(`确认删除采购到货单“${row.arrivalNo}”？`, '删除草稿', {
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '取消'
    })
    await deleteArrival(row.arrivalId, row.version)
    ElMessage.success('到货单已删除')
    await load()
  } catch {
    /* 请求层展示业务错误；取消不改变列表。 */
  } finally {
    removing.value = null
  }
}
watch(orderContext, (id) => void load({ ...applied.value, orderId: id, pageNum: 1 }))
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

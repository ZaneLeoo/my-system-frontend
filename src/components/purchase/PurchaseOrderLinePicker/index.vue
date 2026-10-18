<template>
  <el-dialog
    :model-value="modelValue"
    title="参照采购订单"
    width="min(1280px, 96vw)"
    :close-on-click-modal="false"
    :close-on-press-escape="!confirming"
    :show-close="!confirming"
    @update:model-value="close"
  >
    <el-form inline @submit.prevent="search">
      <el-form-item label="订单／料品">
        <el-input
          v-model="keyword"
          placeholder="订单号、料品编码、名称或规格"
          clearable
          style="width: 320px"
          @keyup.enter="search"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="loading" @click="search">查询</el-button>
        <el-button :disabled="loading" @click="reset">重置</el-button>
      </el-form-item>
    </el-form>
    <el-alert
      v-if="failed"
      title="查询失败，已保留上次结果与选择，请重试。"
      type="warning"
      :closable="false"
      show-icon
      style="margin-bottom: 12px"
    />
    <vxe-table
      ref="table"
      show-overflow
      :data="rows"
      :loading="loading"
      border
      stripe
      height="400"
      :row-config="{ keyField: 'orderLineId', isHover: true }"
      :column-config="{ resizable: true }"
      :checkbox-config="{ trigger: 'row', checkMethod: selectable }"
      :sort-config="{ remote: true, trigger: 'cell' }"
      @checkbox-change="checkboxChanged"
      @checkbox-all="checkboxAll"
      @sort-change="sort"
    >
      <vxe-column type="checkbox" width="50" fixed="left" />
      <vxe-column field="orderNo" title="采购订单号" width="230" sortable />
      <vxe-column field="orderLineNo" title="来源行号" width="90" />
      <vxe-column field="itemCode" title="料品编码" width="160" sortable />
      <vxe-column field="itemName" title="料品名称" min-width="170" sortable />
      <vxe-column field="specification" title="规格" width="160" />
      <vxe-column field="unitName" title="单位" width="90" />
      <vxe-column field="orderQuantity" title="订单数量" width="140" align="right" />
      <vxe-column field="arrivedQuantity" title="已确认到货" width="140" align="right" />
      <vxe-column field="pendingArrivalQuantity" title="待审核到货" width="140" align="right" />
      <vxe-column field="availableQuantity" title="可新增到货" width="140" align="right" />
      <vxe-column field="expectedDate" title="预计到货日期" width="140" />
      <template #empty><el-empty description="没有符合条件且可新增到货的订单行" :image-size="70" /></template>
    </vxe-table>
    <el-pagination
      v-model:current-page="pager.pageNum"
      v-model:page-size="pager.pageSize"
      :total="total"
      :page-sizes="[10, 20, 50, 100]"
      :disabled="loading || confirming"
      layout="total, sizes, prev, pager, next"
      style="margin-top: 16px"
      @change="paginate"
    />
    <div class="selected-list">
      <span>已选 {{ selection.size }} / {{ limit }} 行（支持跨页选择）</span>
      <el-tag
        v-for="row in selection.values()"
        :key="row.orderLineId"
        closable
        :disable-transitions="true"
        @close="remove(row.orderLineId)"
      >
        {{ row.orderNo }} · {{ row.orderLineNo }} · {{ row.itemCode }}
      </el-tag>
    </div>
    <template #footer>
      <el-button :disabled="confirming" @click="close(false)">取消</el-button>
      <el-button type="primary" :loading="confirming" :disabled="loading || !selection.size" @click="confirm">
        确认选择
      </el-button>
    </template>
  </el-dialog>
</template>
<script setup lang="ts" name="PurchaseOrderLinePicker">
import { computed, nextTick, onBeforeUnmount, reactive, ref, shallowRef, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { VxeTableDefines, VxeTableInstance } from 'vxe-table'
import { searchOrderLineReferences, resolveOrderLineReferences } from '@/api/purchase/arrival'
import type { OrderLineReferenceQuery } from '@/types/api/purchase/arrival'
import type { PurchaseOrderLinePickerProps, OrderLineReference } from './types'
import { useVxe } from '@/plugins/vxe'
useVxe()
const props = withDefaults(defineProps<PurchaseOrderLinePickerProps>(), { excludedIds: () => [], maxSelection: 100 })
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; confirm: [records: OrderLineReference[]] }>()
const table = ref<VxeTableInstance<OrderLineReference>>()
const rows = shallowRef<OrderLineReference[]>([]),
  selection = shallowRef(new Map<number, OrderLineReference>())
const keyword = ref(''),
  total = ref(0),
  loading = ref(false),
  confirming = ref(false),
  failed = ref(false)
const pager = reactive({ pageNum: 1, pageSize: 20 })
const applied = ref<OrderLineReferenceQuery>({ pageNum: 1, pageSize: 20, supplierId: 0 })
const limit = computed(() => Math.max(0, Math.min(100, props.maxSelection)))
let sequence = 0,
  session = 0,
  alive = true
function selectable({ row }: { row: OrderLineReference }) {
  return !props.excludedIds.includes(row.orderLineId) && !confirming.value && !loading.value
}
async function sync() {
  await nextTick()
  if (!props.modelValue) return
  await table.value?.clearCheckboxRow()
  const chosen = rows.value.filter((row) => selection.value.has(row.orderLineId))
  if (chosen.length) await table.value?.setCheckboxRow(chosen, true)
}
async function load(query: OrderLineReferenceQuery = applied.value) {
  const current = ++sequence,
    requested = { ...query }
  loading.value = true
  try {
    const { data } = await searchOrderLineReferences(requested)
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
    keyword.value = requested.keyword ?? ''
    failed.value = false
    const next = new Map(selection.value)
    data.rows.forEach((row) => {
      if (next.has(row.orderLineId)) next.set(row.orderLineId, row)
    })
    selection.value = next
  } catch {
    if (alive && current === sequence) {
      failed.value = true
      keyword.value = applied.value.keyword ?? ''
      Object.assign(pager, { pageNum: applied.value.pageNum, pageSize: applied.value.pageSize })
    }
  } finally {
    if (alive && current === sequence) {
      loading.value = false
      await sync()
      if (current === sequence) {
        if (applied.value.sortField) await table.value?.sort(applied.value.sortField, applied.value.sortDirection)
        else await table.value?.clearSort()
      }
    }
  }
}
function search() {
  if (!confirming.value) void load({ ...applied.value, keyword: keyword.value.trim() || undefined, pageNum: 1 })
}
function reset() {
  if (!confirming.value) void load({ pageNum: 1, pageSize: applied.value.pageSize, supplierId: props.supplierId ?? 0 })
}
function paginate(pageNum: number, pageSize: number) {
  void load({ ...applied.value, pageNum: pageSize !== applied.value.pageSize ? 1 : pageNum, pageSize })
}
function sort({ field, order }: VxeTableDefines.SortChangeEventParams<OrderLineReference>) {
  if (field !== 'orderNo' && field !== 'itemCode' && field !== 'itemName') return
  void load({ ...applied.value, pageNum: 1, sortField: order ? field : undefined, sortDirection: order || undefined })
}
function checkboxChanged({ row, checked }: VxeTableDefines.CheckboxChangeEventParams<OrderLineReference>) {
  const next = new Map(selection.value)
  if (checked && selectable({ row })) next.set(row.orderLineId, row)
  else next.delete(row.orderLineId)
  if (next.size > limit.value) {
    ElMessage.warning(`每次最多选择 ${limit.value} 行`)
    void sync()
    return
  }
  selection.value = next
}
function checkboxAll({ checked }: VxeTableDefines.CheckboxAllEventParams<OrderLineReference>) {
  const next = new Map(selection.value)
  rows.value
    .filter((row) => selectable({ row }))
    .forEach((row) => {
      if (checked) next.set(row.orderLineId, row)
      else next.delete(row.orderLineId)
    })
  if (next.size > limit.value) {
    ElMessage.warning(`每次最多选择 ${limit.value} 行`)
    void sync()
    return
  }
  selection.value = next
}
function remove(id: number) {
  if (confirming.value) return
  const next = new Map(selection.value)
  next.delete(id)
  selection.value = next
  void sync()
}
function close(value: boolean) {
  if (!confirming.value) emit('update:modelValue', value)
}
async function confirm() {
  if (confirming.value || !selection.value.size) return
  const current = session,
    ids = [...selection.value.keys()]
  confirming.value = true
  try {
    const { data } = await resolveOrderLineReferences(ids)
    if (!alive || current !== session || !props.modelValue) return
    if (
      data.length !== ids.length ||
      data.some((row) => row.supplierId !== props.supplierId || props.excludedIds.includes(row.orderLineId))
    ) {
      ElMessage.warning('来源订单状态或可用数量已变化，请重新选择')
      return
    }
    const index = new Map(data.map((row) => [row.orderLineId, row]))
    emit(
      'confirm',
      ids.map((id) => index.get(id)!)
    )
    emit('update:modelValue', false)
  } catch {
    /* 失败保留跨页选择，允许重试。 */
  } finally {
    if (current === session) confirming.value = false
  }
}
watch(
  () => [props.modelValue, props.supplierId] as const,
  ([open, supplierId]) => {
    session++
    sequence++
    loading.value = false
    confirming.value = false
    if (!open) return
    selection.value = new Map()
    rows.value = []
    total.value = 0
    keyword.value = ''
    failed.value = false
    Object.assign(pager, { pageNum: 1, pageSize: 20 })
    applied.value = { pageNum: 1, pageSize: 20, supplierId: supplierId ?? 0 }
    if (supplierId) void load()
  }
)
onBeforeUnmount(() => {
  alive = false
  sequence++
  session++
})
</script>
<style scoped>
.selected-list {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 120px;
  overflow: auto;
  margin-top: 16px;
}
</style>

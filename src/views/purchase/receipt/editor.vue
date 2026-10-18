<template>
  <div v-loading="loading" class="app-container receipt-editor">
    <div class="document-bar">
      <div>
        <strong>{{ saved?.receiptNo ?? '新增采购入库单' }}</strong>
        <el-tag>{{ receiptStatusLabels[saved?.status ?? 'DRAFT'] }}</el-tag>
      </div>
      <div>
        <el-button :disabled="busy" @click="router.push('/purchase/receipt')">返回列表</el-button>
        <el-button :disabled="busy" @click="reload">重新加载</el-button>
        <el-button v-if="loaded && !readonly" type="primary" :loading="busy" @click="save">保存草稿</el-button>
        <el-button
          v-if="saved?.status === 'DRAFT' && readonly && can('edit') && can('query')"
          type="primary"
          :disabled="busy"
          @click="router.push(`/purchase/receipt-document/${saved.receiptId}/edit`)"
        >
          编辑
        </el-button>
        <el-button
          v-for="action in actions"
          :key="action"
          :type="action === 'reject' || action === 'void' ? 'danger' : 'primary'"
          :disabled="busy"
          @click="execute(action)"
        >
          {{ receiptActionLabels[action] }}
        </el-button>
      </div>
    </div>
    <el-result v-if="!loading && !loaded" icon="warning" title="入库单加载失败或无权访问">
      <template #extra><el-button @click="load">重试</el-button></template>
    </el-result>
    <template v-if="loaded">
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" :disabled="readonly || busy">
        <div class="header-grid">
          <el-form-item label="入库日期" prop="receiptDate">
            <el-date-picker v-model="form.receiptDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
          </el-form-item>
          <el-form-item label="供应商" prop="supplierId">
            <el-input :model-value="contextNames.supplier" readonly placeholder="参照到货单后带入" />
          </el-form-item>
          <el-form-item label="收货经办人"><el-input :model-value="defaults?.receiverName" disabled /></el-form-item>
          <el-form-item label="经办部门"><el-input :model-value="defaults?.deptName" disabled /></el-form-item>
        </div>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <div class="line-toolbar">
        <el-button
          v-if="!readonly"
          type="primary"
          plain
          :disabled="busy || rows.length >= 200 || !canReference"
          @click="sourceOpen = true"
        >
          参照采购到货单
        </el-button>
        <el-button v-if="!readonly && rows.length" :disabled="busy" @click="changeContext">更换供应商</el-button>
        <span>{{ rows.length }} / 200 行 · 预计入库仓库仅作默认值，实际仓库按行选择</span>
      </div>
      <el-alert
        v-if="sourceFailed"
        title="来源到货单带入失败，其他录入内容已保留，可重新带入或手动参照。"
        type="warning"
        :closable="false"
        show-icon
        class="source-alert"
      >
        <el-button text @click="prefill">重新带入</el-button>
      </el-alert>
      <vxe-table
        ref="table"
        :data="rows"
        border
        stripe
        show-overflow
        max-height="560"
        :row-config="{ keyField: 'rowKey', isHover: true, drag: !readonly && !busy }"
        :row-drag-config="{ trigger: 'default', showIcon: true }"
        :column-config="{ resizable: true, drag: true }"
        :column-drag-config="{ trigger: 'default', showIcon: true }"
        @row-dragend="reorder"
      >
        <vxe-column type="seq" title="行号" width="80" :drag-sort="!readonly && !busy" fixed="left" />
        <vxe-column field="itemCode" title="料品编码" width="150" fixed="left" />
        <vxe-column field="itemName" title="料品名称" min-width="180" />
        <vxe-column field="specification" title="规格" min-width="150" />
        <vxe-column field="unitName" title="单位" width="100" />
        <vxe-column field="warehouseName" title="实际入库仓库" width="290">
          <template #default="{ row }">
            <span v-if="readonly">{{ row.warehouseCode }} / {{ row.warehouseName }}</span>
            <WarehousePicker
              v-else
              v-model="row.warehouseId"
              :disabled="busy"
              @change="warehouseChanged(row, $event)"
            />
          </template>
        </vxe-column>
        <vxe-column v-if="rows.some((row) => row.locationEnabled)" field="locationName" title="入库货位" width="260">
          <template #default="{ row }">
            <span v-if="!row.locationEnabled">—</span>
            <span v-else-if="readonly">{{ row.locationCode }} / {{ row.locationName }}</span>
            <LocationPicker v-else v-model="row.locationId" :warehouse-id="row.warehouseId" :disabled="busy" />
          </template>
        </vxe-column>
        <vxe-column field="quantity" title="本次入库数量" width="170" align="right">
          <template #default="{ row, rowIndex }">
            <span v-if="readonly">{{ row.quantity }}</span>
            <el-input
              v-else
              v-model="row.quantity"
              :disabled="busy"
              inputmode="decimal"
              maxlength="16"
              :aria-label="`第${rowIndex + 1}行入库数量`"
            />
          </template>
        </vxe-column>
        <vxe-column field="arrivalNo" title="来源到货单号" width="235">
          <template #default="{ row }">
            <el-button
              v-if="canArrivalQuery"
              link
              type="primary"
              @click="router.push(`/purchase/arrival-document/${row.arrivalId}/detail`)"
            >
              {{ row.arrivalNo }}
            </el-button>
            <span v-else>{{ row.arrivalNo }}</span>
          </template>
        </vxe-column>
        <vxe-column field="arrivalLineNo" title="到货行号" width="100" />
        <vxe-column field="orderNo" title="来源订单号" width="235">
          <template #default="{ row }">
            <el-button
              v-if="canOrderQuery"
              link
              type="primary"
              @click="router.push(`/purchase/order-document/${row.orderId}/detail`)"
            >
              {{ row.orderNo }}
            </el-button>
            <span v-else>{{ row.orderNo }}</span>
          </template>
        </vxe-column>
        <vxe-column field="orderLineNo" title="订单行号" width="100" />
        <vxe-column field="arrivalQuantity" title="到货数量" width="140" align="right" />
        <vxe-column field="receivedQuantity" title="累计已入库" width="150" align="right" />
        <vxe-column field="pendingReceiptQuantity" title="待审核入库" width="150" align="right" />
        <vxe-column field="availableQuantity" title="当前可新增入库" width="160" align="right" />
        <vxe-column field="remark" title="行备注" min-width="200">
          <template #default="{ row }">
            <span v-if="readonly">{{ row.remark }}</span>
            <el-input v-else v-model="row.remark" :disabled="busy" maxlength="500" />
          </template>
        </vxe-column>
        <vxe-column v-if="!readonly" title="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link :disabled="busy || rows.length >= 200" @click="split(row)">拆分</el-button>
            <el-button link :disabled="busy" @click="move(row, -1)">上移</el-button>
            <el-button link :disabled="busy" @click="move(row, 1)">下移</el-button>
            <el-button link type="danger" :disabled="busy" @click="removeRow(row)">删除</el-button>
          </template>
        </vxe-column>
        <template #empty><el-empty description="请参照已审核的采购到货单行" :image-size="75" /></template>
      </vxe-table>
      <el-collapse v-if="readonly && saved" v-model="operationInfoOpen" class="audit-info">
        <el-collapse-item title="操作信息" name="audit">
          <el-descriptions :column="3" border>
            <el-descriptions-item label="创建人">{{ saved.createBy }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ saved.createTime }}</el-descriptions-item>
            <el-descriptions-item label="最后修改">{{ saved.updateBy }} {{ saved.updateTime }}</el-descriptions-item>
            <el-descriptions-item label="提交人">{{ saved.submittedBy || '—' }}</el-descriptions-item>
            <el-descriptions-item label="提交时间">{{ saved.submittedTime || '—' }}</el-descriptions-item>
            <el-descriptions-item label="版本">{{ saved.version }}</el-descriptions-item>
            <el-descriptions-item label="审核人">{{ saved.reviewedBy || '—' }}</el-descriptions-item>
            <el-descriptions-item label="审核时间">{{ saved.reviewedTime || '—' }}</el-descriptions-item>
            <el-descriptions-item label="审核意见">{{ saved.reviewRemark || '—' }}</el-descriptions-item>
            <el-descriptions-item v-if="saved.status === 'VOIDED'" label="作废人">
              {{ saved.voidedBy }}
            </el-descriptions-item>
            <el-descriptions-item v-if="saved.status === 'VOIDED'" label="作废时间">
              {{ saved.voidedTime }}
            </el-descriptions-item>
            <el-descriptions-item v-if="saved.status === 'VOIDED'" label="作废原因">
              {{ saved.voidReason }}
            </el-descriptions-item>
          </el-descriptions>
        </el-collapse-item>
      </el-collapse>
    </template>
    <PurchaseArrivalLinePicker
      v-model="sourceOpen"
      :supplier-id="form.supplierId"
      :excluded-ids="rows.map((row) => row.arrivalLineId)"
      :max-selection="200 - rows.length"
      @confirm="addSources"
    />
  </div>
</template>
<script setup lang="ts" name="PurchaseReceiptEditor">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus/es/components/form'
import type { VxeTableDefines, VxeTableInstance } from 'vxe-table'
import WarehousePicker from '@/components/masterdata/WarehousePicker/index.vue'
import type { WarehouseReference } from '@/types/api/masterdata/storage-reference'
import LocationPicker from '@/components/masterdata/LocationPicker/index.vue'

import PurchaseArrivalLinePicker from '@/components/purchase/PurchaseArrivalLinePicker/index.vue'
import {
  getReceipt,
  getReceiptDefaults,
  createReceipt,
  updateReceipt,
  actOnReceipt,
  searchArrivalLineReferences
} from '@/api/purchase/receipt'
import { receiptStatusLabels, receiptActionLabels, receiptStateActions } from '@/types/api/purchase/receipt'
import type {
  Receipt,
  ReceiptDefaults,
  ReceiptLine,
  ReceiptLineInput,
  ReceiptAction,
  ArrivalLineReference,
  SaveReceiptRequest
} from '@/types/api/purchase/receipt'
import auth from '@/plugins/auth'
import { useVxe } from '@/plugins/vxe'
useVxe()
type Header = Omit<SaveReceiptRequest, 'receiptId' | 'version' | 'lines'>
type LineDraft = Omit<ReceiptLine, 'lineId' | 'receiptId' | 'lineNo' | 'warehouseId'> & {
  lineId?: number
  rowKey: string
  warehouseId: number | null
}
const route = useRoute(),
  router = useRouter()
const formRef = ref<FormInstance>(),
  table = ref<VxeTableInstance<LineDraft>>()
const saved = shallowRef<Receipt>(),
  defaults = shallowRef<ReceiptDefaults>(),
  rows = ref<LineDraft[]>([])
const loading = ref(false),
  loaded = ref(false),
  busy = ref(false),
  sourceOpen = ref(false),
  sourceFailed = ref(false),
  baseline = ref(''),
  operationInfoOpen = ref('')
const form = reactive<Header>({
  receiptDate: today(),
  supplierId: null,
  remark: ''
})
const contextNames = reactive({ supplier: '' })
const can = (suffix: string) => auth.hasPermi(`purchase:receipt:${suffix}`)
const canReference = computed(() => auth.hasPermi('purchase:arrival:reference'))
const canOrderQuery = computed(() => auth.hasPermi('purchase:order:query'))
const canArrivalQuery = computed(() => auth.hasPermi('purchase:arrival:query'))
const readonly = computed(
  () =>
    route.name === 'PurchaseReceiptDetail' || (saved.value != null && (saved.value.status !== 'DRAFT' || !can('edit')))
)
const actions = computed(() => (saved.value && loaded.value ? receiptStateActions[saved.value.status].filter(can) : []))
const dirty = computed(() => loaded.value && !readonly.value && snapshot() !== baseline.value)
const rules: FormRules<Header> = {
  receiptDate: [{ required: true, message: '请选择入库日期', trigger: 'change' }],
  supplierId: [{ required: true, message: '请选择供应商', trigger: 'change' }]
}
let loadSequence = 0,
  prefillSequence = 0,
  allowNavigation = false
function today() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function cleanDecimal(text: string) {
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text
}
function inputs(): ReceiptLineInput[] {
  return rows.value.map(({ lineId, arrivalLineId, warehouseId, locationId, quantity, remark }) => ({
    lineId,
    arrivalLineId,
    warehouseId,
    locationId,
    quantity: quantity.trim(),
    remark: remark.trim()
  }))
}
function snapshot() {
  return JSON.stringify({ header: { ...form }, lines: inputs() })
}
function apply(view: Receipt) {
  contextNames.supplier = `${view.supplierCode} / ${view.supplierName}`
  saved.value = view
  defaults.value = view
  Object.assign(form, {
    receiptDate: view.receiptDate,
    supplierId: view.supplierId,
    remark: view.remark
  })
  rows.value = (view.lines ?? []).map((line) => ({
    ...line,
    rowKey: `line-${line.lineId}`,
    quantity: cleanDecimal(line.quantity)
  }))
  baseline.value = snapshot()
}
async function load() {
  const current = ++loadSequence
  prefillSequence++
  sourceOpen.value = false
  operationInfoOpen.value = ''
  sourceFailed.value = false
  loading.value = true
  loaded.value = false
  try {
    if (route.name === 'PurchaseReceiptCreate') {
      if (!can('add')) throw new Error('无新增权限')
      const { data } = await getReceiptDefaults()
      if (current !== loadSequence) return
      defaults.value = data
      saved.value = undefined
      rows.value = []
      contextNames.supplier = ''
      const supplierId = Number(route.query.supplierId)
      Object.assign(form, {
        receiptDate: today(),
        supplierId: Number.isSafeInteger(supplierId) && supplierId > 0 ? supplierId : null,
        remark: ''
      })
      baseline.value = snapshot()
      await prefill()
      if (current !== loadSequence) return
    } else {
      if (!can('query') || (route.name === 'PurchaseReceiptEdit' && !can('edit'))) throw new Error('无详情或编辑权限')
      const { data } = await getReceipt(Number(route.params.id))
      if (current !== loadSequence) return
      apply(data)
    }
    loaded.value = true
    await nextTick()
    formRef.value?.clearValidate()
  } catch {
    /* 请求层显示错误，重试前不允许编辑旧单。 */
  } finally {
    if (current === loadSequence) loading.value = false
  }
}
async function prefill() {
  const arrivalId = Number(route.query.arrivalId),
    supplierId = form.supplierId,
    current = ++prefillSequence
  if (saved.value || !Number.isSafeInteger(arrivalId) || arrivalId <= 0 || !canReference.value) return
  try {
    const first = (await searchArrivalLineReferences({ pageNum: 1, pageSize: 100, arrivalId })).data
    const found = [...first.rows]
    if (first.total > 100)
      found.push(...(await searchArrivalLineReferences({ pageNum: 2, pageSize: 100, arrivalId })).data.rows)
    if (current !== prefillSequence || supplierId !== form.supplierId || saved.value) return
    addSources(found)
    sourceFailed.value = false
    if (!found.length) ElMessage.info('来源到货单当前没有可新增入库的行')
  } catch {
    if (current === prefillSequence) sourceFailed.value = true
  }
}
function addSources(records: ArrivalLineReference[]) {
  if (busy.value || readonly.value) return
  const existing = new Set(rows.value.map((row) => row.arrivalLineId)),
    additions = records.filter((row) => !existing.has(row.arrivalLineId))
  if (rows.value.length + additions.length > 200) {
    ElMessage.warning('每张入库单最多 200 行')
    return
  }
  const first = records[0]
  if (!first) return
  if (
    records.some((record) => record.supplierId !== first.supplierId) ||
    (form.supplierId != null && first.supplierId !== form.supplierId)
  ) {
    ElMessage.warning('只能选择同供应商的到货行')
    return
  }
  form.supplierId = first.supplierId
  contextNames.supplier = `${first.supplierCode} / ${first.supplierName}`
  for (const source of additions)
    rows.value.push({
      ...source,
      rowKey: crypto.randomUUID(),
      quantity: cleanDecimal(source.availableQuantity),
      remark: '',
      locationId: null,
      locationCode: '',
      locationName: ''
    })
}
function warehouseChanged(row: LineDraft, selected: WarehouseReference[]) {
  const warehouse = selected[0]
  row.warehouseCode = warehouse?.warehouseCode ?? ''
  row.warehouseName = warehouse?.warehouseName ?? ''
  row.locationEnabled = warehouse?.locationEnabled ?? false
  row.locationId = null
  row.locationCode = ''
  row.locationName = ''
}
async function changeContext() {
  try {
    await ElMessageBox.confirm('更换供应商会清空当前明细，是否继续？', '更换供应商', {
      type: 'warning',
      confirmButtonText: '清空并更换',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }
  prefillSequence++
  rows.value = []
  form.supplierId = null
  contextNames.supplier = ''
  sourceFailed.value = false
}
function scaled(text: string): bigint {
  const [whole, fraction = ''] = text.split('.')
  return BigInt(whole || '0') * 1000000n + BigInt(fraction.padEnd(6, '0'))
}
function decimal(value: bigint): string {
  return cleanDecimal(`${value / 1000000n}.${String(value % 1000000n).padStart(6, '0')}`)
}
async function split(row: LineDraft) {
  if (busy.value || rows.value.length >= 200) return
  if (!/^\d{1,9}(\.\d{1,6})?$/.test(row.quantity.trim())) {
    ElMessage.warning('请先填写有效数量')
    return
  }
  try {
    const result = await ElMessageBox.prompt(
      '请输入拆分数量，拆分后可分别选择仓库和货位，原行保留剩余数量',
      '拆分入库行',
      {
        inputValidator: (value: string) => {
          if (!/^\d{1,9}(\.\d{1,6})?$/.test(value?.trim() ?? '')) return '请输入有效数量'
          const n = scaled(value.trim())
          return (
            (n > 0n &&
              n < scaled(row.quantity.trim()) &&
              (value.split('.')[1] ?? '').replace(/0+$/, '').length <= row.quantityDecimalPlaces) ||
            '拆分数量需小于原行数量并符合精度'
          )
        },
        confirmButtonText: '拆分',
        cancelButtonText: '取消'
      }
    )
    const amount = scaled(result.value.trim())
    const copy = {
      ...row,
      lineId: undefined,
      rowKey: crypto.randomUUID(),
      quantity: decimal(amount),
      locationId: null,
      locationCode: '',
      locationName: ''
    }
    row.quantity = decimal(scaled(row.quantity.trim()) - amount)
    rows.value.splice(rows.value.indexOf(row) + 1, 0, copy)
  } catch {
    /* 取消保留原行。 */
  }
}
function removeRow(row: LineDraft) {
  rows.value = rows.value.filter((value) => value.rowKey !== row.rowKey)
}
function move(row: LineDraft, offset: number) {
  const index = rows.value.findIndex((value) => value.rowKey === row.rowKey),
    target = index + offset
  if (target < 0 || target >= rows.value.length) return
  const next = [...rows.value]
  next.splice(index, 1)
  next.splice(target, 0, row)
  rows.value = next
}
function reorder({ dragRow, newRow, dragPos }: VxeTableDefines.RowDragendEventParams<LineDraft>) {
  const next = rows.value.filter((row) => row.rowKey !== dragRow.rowKey),
    index = next.findIndex((row) => row.rowKey === newRow.rowKey)
  if (index < 0) return
  next.splice(index + (dragPos === 'bottom' ? 1 : 0), 0, dragRow)
  rows.value = next
}
function inputError(): string | undefined {
  if (!rows.value.length) return '请至少参照一行采购到货单'
  const dimensions = new Set<string>()
  for (const [index, row] of rows.value.entries()) {
    if (!row.warehouseId) return `第 ${index + 1} 行：请选择实际入库仓库`
    if (row.locationEnabled && !row.locationId) return `第 ${index + 1} 行：请选择入库货位`
    const key = `${row.arrivalLineId}:${row.warehouseId}:${row.locationId ?? 0}`
    if (dimensions.has(key)) return `第 ${index + 1} 行：同一到货行不能重复使用相同仓库和货位`
    dimensions.add(key)
    const value = row.quantity.trim(),
      fraction = (value.split('.')[1] ?? '').replace(/0+$/, '')
    if (!/^\d{1,9}(\.\d{1,6})?$/.test(value) || !/[1-9]/.test(value) || fraction.length > row.quantityDecimalPlaces)
      return `第 ${index + 1} 行：数量必须大于零，且最多 ${row.quantityDecimalPlaces} 位小数`
  }
}
async function save() {
  if (busy.value || readonly.value || !formRef.value || !(await formRef.value.validate().catch(() => false))) return
  const error = inputError()
  if (error) {
    ElMessage.warning(error)
    return
  }
  busy.value = true
  try {
    const payload: SaveReceiptRequest = {
      ...form,
      remark: form.remark.trim(),
      receiptId: saved.value?.receiptId,
      version: saved.value?.version,
      lines: inputs()
    }
    const { data } = saved.value ? await updateReceipt(payload) : await createReceipt(payload)
    apply(data)
    ElMessage.success('采购入库单已保存')
    if (can('query')) {
      allowNavigation = true
      await router.replace(`/purchase/receipt-document/${data.receiptId}/${can('edit') ? 'edit' : 'detail'}`)
    }
  } catch {
    /* 失败保留表单及原版本，用户可修正后重试。 */
  } finally {
    busy.value = false
    allowNavigation = false
  }
}
async function execute(action: ReceiptAction) {
  if (!saved.value || busy.value) return
  if (dirty.value) {
    ElMessage.warning('请先保存草稿，再执行单据操作')
    return
  }
  let reason = ''
  try {
    if (action === 'reject' || action === 'void') {
      const result = await ElMessageBox.prompt(
        `请输入${action === 'reject' ? '驳回' : '作废'}原因`,
        receiptActionLabels[action],
        {
          inputType: 'textarea',
          inputValidator: (value: string) =>
            (Boolean(value?.trim()) && value.trim().length <= 500) || '请输入 1～500 字的原因',
          confirmButtonText: '确认',
          cancelButtonText: '取消'
        }
      )
      reason = result.value.trim()
    } else
      await ElMessageBox.confirm(
        `确认${receiptActionLabels[action]}“${saved.value.receiptNo}”？`,
        receiptActionLabels[action],
        { type: 'warning', confirmButtonText: '确认', cancelButtonText: '取消' }
      )
  } catch {
    return
  }
  busy.value = true
  try {
    const { data } = await actOnReceipt(saved.value.receiptId, action, saved.value.version, reason)
    apply(data)
    ElMessage.success('操作成功')
    allowNavigation = true
    if (can('query')) await router.replace(`/purchase/receipt-document/${data.receiptId}/detail`)
  } catch {
    /* 失败保留当前快照，服务端事务保证状态和数量同时回滚。 */
  } finally {
    busy.value = false
    allowNavigation = false
  }
}
async function mayLeave() {
  if (allowNavigation) return true
  if (busy.value) return false
  if (!dirty.value) return true
  try {
    await ElMessageBox.confirm('尚有未保存的修改，是否放弃？', '离开采购入库单', {
      type: 'warning',
      confirmButtonText: '放弃修改',
      cancelButtonText: '继续编辑'
    })
    return true
  } catch {
    return false
  }
}
async function reload() {
  if (await mayLeave()) await load()
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
onBeforeRouteLeave(mayLeave)
onBeforeRouteUpdate(mayLeave)
watch(
  () => route.fullPath,
  () => void load()
)
onMounted(() => {
  void load()
  window.addEventListener('beforeunload', beforeUnload)
})
onBeforeUnmount(() => {
  loadSequence++
  prefillSequence++
  window.removeEventListener('beforeunload', beforeUnload)
})
</script>
<style scoped>
.document-bar,
.document-bar > div,
.line-toolbar,
.supplier-field {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.document-bar {
  justify-content: space-between;
  margin-bottom: 24px;
}
.document-bar strong {
  font-size: 20px;
}
.header-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  column-gap: 20px;
}
.supplier-field {
  width: 100%;
  flex-wrap: nowrap;
  gap: 4px;
}
.supplier-field > :first-child {
  flex: 1;
  min-width: 0;
}
.line-toolbar {
  justify-content: space-between;
  margin: 20px 0 12px;
}
.line-toolbar > span {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.source-alert {
  margin-bottom: 12px;
}
.audit-info {
  margin-top: 28px;
}
@media (max-width: 1200px) {
  .header-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 600px) {
  .header-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

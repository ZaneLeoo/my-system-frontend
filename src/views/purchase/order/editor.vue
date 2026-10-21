<template>
  <div v-loading="loading" class="app-container order-editor">
    <div class="document-bar">
      <div class="document-heading">
        <strong>{{ saved?.orderNo ?? '新增采购订单' }}</strong>
        <el-tag>{{ orderStatusLabels[saved?.status ?? 'DRAFT'] }}</el-tag>
        <el-tag v-if="saved && readonly" type="info">{{ arrivalProgressLabels[saved.arrivalProgress] }}</el-tag>
        <el-tooltip v-if="saved && readonly" content="以订单各行订购数量判断入库进度，待审核入库不计入已入库">
          <el-tag type="info">{{ receiptProgressLabels[saved.receiptProgress] }}</el-tag>
        </el-tooltip>
      </div>
      <div class="document-actions">
        <div class="action-group action-group--navigation" aria-label="页面操作">
          <el-button :disabled="busy" @click="router.push('/purchase/order')">返回列表</el-button>
          <el-button :disabled="busy" @click="reload">重新加载</el-button>
        </div>
        <div v-if="saved && readonly" class="action-group action-group--related" aria-label="关联业务单据">
          <el-button
            v-if="auth.hasPermi('purchase:receipt:list')"
            :disabled="busy"
            @click="router.push({ path: '/purchase/receipt', query: { orderId: saved.orderId } })"
          >
            关联入库单
          </el-button>
          <el-button
            v-if="auth.hasPermi('purchase:arrival:list')"
            :disabled="busy"
            @click="router.push({ path: '/purchase/arrival', query: { orderId: saved.orderId } })"
          >
            关联到货单
          </el-button>
          <el-button
            v-if="
              saved.status === 'APPROVED' &&
              saved.arrivalProgress !== 'FULLY_ARRIVED' &&
              auth.hasPermi('purchase:arrival:add') &&
              auth.hasPermi('purchase:order:reference')
            "
            :disabled="busy"
            type="primary"
            plain
            @click="
              router.push({
                path: '/purchase/arrival-document/create',
                query: { orderId: saved.orderId, supplierId: saved.supplierId }
              })
            "
          >
            建立到货单
          </el-button>
        </div>
        <div class="action-group action-group--workflow" aria-label="单据流程操作">
          <el-button
            v-if="saved?.status === 'APPROVED' && readonly && auth.hasPermi('signing:task:start')"
            :disabled="busy || checkingSigningAvailability"
            :loading="checkingSigningAvailability"
            @click="startSigning"
          >
            发起签署
          </el-button>
          <el-button v-if="!readonly && loaded" type="primary" :loading="busy" @click="save">保存草稿</el-button>
          <el-button
            v-if="saved?.status === 'DRAFT' && readonly && can('edit') && can('query')"
            type="primary"
            :disabled="busy"
            @click="router.push(`/purchase/order-document/${saved.orderId}/edit`)"
          >
            编辑
          </el-button>
          <el-button
            v-for="action in actions"
            :key="action"
            :type="action === 'reject' ? 'danger' : 'primary'"
            :disabled="busy"
            @click="execute(action)"
          >
            {{ orderActionLabels[action] }}
          </el-button>
        </div>
      </div>
    </div>
    <el-result v-if="!loading && !loaded" icon="warning" title="订单加载失败或无权访问">
      <template #extra><el-button @click="load">重试</el-button></template>
    </el-result>
    <template v-if="loaded">
      <el-tabs v-model="activeDetailTab" class="order-detail-tabs" :class="{ 'has-detail-tabs': hasDetailTabs }">
        <el-tab-pane label="订单信息" name="order">
          <el-form ref="formRef" :model="form" :rules="rules" label-position="top" :disabled="readonly || busy">
            <div class="header-grid">
              <el-form-item label="订单日期" prop="orderDate">
                <el-date-picker v-model="form.orderDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
              </el-form-item>
              <el-form-item label="供应商" prop="supplierId">
                <el-input v-if="readonly" :model-value="`${saved?.supplierCode} / ${saved?.supplierName}`" />
                <SupplierPicker v-else v-model="form.supplierId" @change="supplierChanged" />
              </el-form-item>
              <el-form-item label="计价方式">
                <el-select v-model="form.priceTaxMode" :disabled="Boolean(saved)" style="width: 100%">
                  <el-option label="含税单价" value="TAX_INCLUDED" />
                  <el-option label="未税单价" value="TAX_EXCLUDED" />
                </el-select>
              </el-form-item>
              <el-form-item label="币种"><el-input model-value="人民币（CNY）" disabled /></el-form-item>
              <el-form-item label="采购员"><el-input :model-value="defaults?.buyerName" disabled /></el-form-item>
              <el-form-item label="采购部门"><el-input :model-value="defaults?.deptName" disabled /></el-form-item>
              <el-form-item label="联系人"><el-input v-model="form.contactName" maxlength="64" /></el-form-item>
              <el-form-item label="联系电话"><el-input v-model="form.contactPhone" maxlength="64" /></el-form-item>
            </div>
            <el-form-item label="联系地址"><el-input v-model="form.address" maxlength="500" /></el-form-item>
            <el-form-item label="备注">
              <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500" show-word-limit />
            </el-form-item>
          </el-form>
          <div class="line-toolbar">
            <div v-if="!readonly" class="line-add">
              <ItemPicker
                v-model="selectedIds"
                multiple
                purchase-only
                :disabled="busy"
                placeholder="选择料品，可批量添加"
                @change="addItems"
              />
              <el-button :disabled="busy || rows.length >= 200" @click="addBlank">增行</el-button>
              <el-button :disabled="busy || calculating" @click="queueCalculation">重新试算</el-button>
            </div>
            <span>
              {{ rows.length }} / 200 行 · 数量最多 {{ defaults?.quantityDecimalPlaces }} 位小数，单价最多
              {{ defaults?.priceDecimalPlaces }} 位小数
            </span>
          </div>
          <el-alert
            v-if="calculationError"
            :title="calculationError"
            type="warning"
            :closable="false"
            show-icon
            class="calculation-alert"
          />
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
            <vxe-column field="itemCode" title="料品编码" width="210" fixed="left">
              <template #default="{ row }">
                <ItemPicker
                  v-if="!row.itemId && !readonly"
                  :model-value="null"
                  purchase-only
                  :disabled="busy"
                  @change="setItem(row, $event)"
                />
                <span v-else>{{ row.itemCode }}</span>
              </template>
            </vxe-column>
            <vxe-column field="itemName" title="料品名称" min-width="180" />
            <vxe-column field="specification" title="规格型号" min-width="160" />
            <vxe-column field="unitName" title="单位" width="100" />
            <vxe-column v-if="readonly" field="arrivedQuantity" title="已确认到货" width="150" align="right" />
            <vxe-column v-if="readonly" field="pendingArrivalQuantity" title="待审核到货" width="150" align="right" />
            <vxe-column v-if="readonly" field="availableQuantity" title="可新增到货" width="150" align="right" />
            <vxe-column v-if="readonly" field="pendingReceiptQuantity" title="待审核入库" width="150" align="right" />
            <vxe-column v-if="readonly" field="receivedQuantity" title="累计已入库" width="150" align="right" />
            <vxe-column
              v-if="readonly"
              field="arrivedNotReceivedQuantity"
              title="已到货未入库"
              width="170"
              align="right"
            >
              <template #header>
                <el-tooltip content="累计已到货减累计已入库，包含待审核入库数量"><span>已到货未入库</span></el-tooltip>
              </template>
            </vxe-column>
            <vxe-column field="quantity" title="数量" width="160" align="right">
              <template #default="{ row, rowIndex }">
                <span v-if="readonly">{{ row.quantity }}</span>
                <el-input
                  v-else
                  v-model="row.quantity"
                  :disabled="busy"
                  inputmode="decimal"
                  maxlength="17"
                  :aria-label="`第${rowIndex + 1}行数量`"
                />
              </template>
            </vxe-column>
            <vxe-column field="netPrice" title="未税单价" width="170" align="right">
              <template #default="{ row, rowIndex }">
                <el-input
                  v-if="!readonly && form.priceTaxMode === 'TAX_EXCLUDED'"
                  v-model="row.unitPrice"
                  :disabled="busy"
                  inputmode="decimal"
                  maxlength="19"
                  :aria-label="`第${rowIndex + 1}行未税单价`"
                />
                <span v-else>{{ row.amounts?.netPrice ?? '—' }}</span>
              </template>
            </vxe-column>
            <vxe-column field="grossPrice" title="含税单价" width="170" align="right">
              <template #default="{ row, rowIndex }">
                <el-input
                  v-if="!readonly && form.priceTaxMode === 'TAX_INCLUDED'"
                  v-model="row.unitPrice"
                  :disabled="busy"
                  inputmode="decimal"
                  maxlength="19"
                  :aria-label="`第${rowIndex + 1}行含税单价`"
                />
                <span v-else>{{ row.amounts?.grossPrice ?? '—' }}</span>
              </template>
            </vxe-column>
            <vxe-column field="taxRate" title="税率（%）" width="130" align="right">
              <template #default="{ row, rowIndex }">
                <span v-if="readonly">{{ row.taxRate }}</span>
                <el-input
                  v-else
                  v-model="row.taxRate"
                  :disabled="busy"
                  inputmode="decimal"
                  maxlength="6"
                  placeholder="未设置"
                  :aria-label="`第${rowIndex + 1}行税率`"
                />
              </template>
            </vxe-column>
            <vxe-column field="netAmount" title="未税金额" width="170" align="right">
              <template #default="{ row }">{{ row.amounts?.netAmount ?? '—' }}</template>
            </vxe-column>
            <vxe-column field="tax" title="税额" width="150" align="right">
              <template #default="{ row }">{{ row.amounts?.tax ?? '—' }}</template>
            </vxe-column>
            <vxe-column field="grossAmount" title="价税合计" width="180" align="right">
              <template #default="{ row }">{{ row.amounts?.grossAmount ?? '—' }}</template>
            </vxe-column>
            <vxe-column field="expectedDate" title="预计到货日期" width="170">
              <template #default="{ row }">
                <span v-if="readonly">{{ row.expectedDate || '—' }}</span>
                <el-date-picker
                  v-else
                  v-model="row.expectedDate"
                  :disabled="busy"
                  type="date"
                  value-format="YYYY-MM-DD"
                  style="width: 145px"
                />
              </template>
            </vxe-column>
            <vxe-column field="remark" title="行备注" min-width="200">
              <template #default="{ row }">
                <span v-if="readonly">{{ row.remark }}</span>
                <el-input v-else v-model="row.remark" :disabled="busy" maxlength="500" />
              </template>
            </vxe-column>
            <vxe-column v-if="!readonly" title="操作" width="225" fixed="right">
              <template #default="{ row, rowIndex }">
                <el-button link :disabled="busy || rows.length >= 200" @click="copy(row)">复制</el-button>
                <el-button link :disabled="busy || rowIndex === 0" @click="move(row, -1)">上移</el-button>
                <el-button link :disabled="busy || rowIndex === rows.length - 1" @click="move(row, 1)">下移</el-button>
                <el-button link type="danger" :disabled="busy" @click="removeRow(row)">删除</el-button>
              </template>
            </vxe-column>
            <template #empty><el-empty description="请先选择采购料品" :image-size="70" /></template>
          </vxe-table>
          <div class="totals">
            <span v-if="calculating">金额计算中…</span>
            <span>
              未税金额
              <strong>{{ totals?.netAmount ?? '—' }}</strong>
            </span>
            <span>
              税额
              <strong>{{ totals?.tax ?? '—' }}</strong>
            </span>
            <span>
              价税合计
              <strong>{{ totals?.grossAmount ?? '—' }}</strong>
            </span>
          </div>
        </el-tab-pane>
        <el-tab-pane v-if="canShowSigningTab" label="电子签署" name="signing" lazy>
          <SigningHistory
            v-if="signingTabOpened"
            business-type="purchase.order"
            :business-id="String(saved?.orderId)"
          />
        </el-tab-pane>
        <el-tab-pane v-if="canShowOperationInfoTab" label="操作信息" name="operation-info">
          <el-descriptions class="audit-info" :column="2" border>
            <el-descriptions-item label="创建人">{{ saved?.createBy }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ saved?.createTime }}</el-descriptions-item>
            <el-descriptions-item label="修改人">{{ saved?.updateBy || '—' }}</el-descriptions-item>
            <el-descriptions-item label="修改时间">{{ saved?.updateTime || '—' }}</el-descriptions-item>
            <el-descriptions-item label="提交人／时间">
              {{ saved?.submittedBy || '—' }} {{ saved?.submittedTime }}
            </el-descriptions-item>
            <el-descriptions-item label="审核人／时间">
              {{ saved?.reviewedBy || '—' }} {{ saved?.reviewedTime }}
            </el-descriptions-item>
            <el-descriptions-item v-if="saved?.reviewRemark" label="审核意见" :span="2">
              {{ saved.reviewRemark }}
            </el-descriptions-item>
            <el-descriptions-item v-if="saved?.closedBy || saved?.closedTime" label="关闭人／时间" :span="2">
              {{ saved?.closedBy || '—' }} {{ saved?.closedTime }}
            </el-descriptions-item>
            <el-descriptions-item v-if="saved?.closeReason" label="关闭说明" :span="2">
              {{ saved?.closeReason }}
            </el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>
      </el-tabs>
    </template>
  </div>
</template>
<script setup lang="ts" name="PurchaseOrderEditor">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus/es/components/form'
import type { VxeTableInstance, VxeTableDefines } from 'vxe-table'
import SigningHistory from '@/components/signing/SigningHistory/index.vue'
import ItemPicker from '@/components/masterdata/ItemPicker/index.vue'
import SupplierPicker from '@/components/masterdata/SupplierPicker/index.vue'
import type { ItemReference } from '@/types/api/masterdata/reference'
import type { SupplierReference } from '@/types/api/masterdata/supplier'
import type {
  Order,
  OrderAction,
  OrderDefaults,
  OrderLineInput,
  SaveOrderRequest,
  LineAmounts,
  OrderCalculation
} from '@/types/api/purchase/order'
import {
  orderStatusLabels,
  orderActionLabels,
  orderStateActions,
  arrivalProgressLabels,
  receiptProgressLabels
} from '@/types/api/purchase/order'
import { getOrder, getOrderDefaults, createOrder, updateOrder, calculateOrder, actOnOrder } from '@/api/purchase/order'
import { beginBusinessSigning } from '@/integrations/signing/businesses'
import { useVxe } from '@/plugins/vxe'
import auth from '@/plugins/auth'
useVxe()
interface LineDraft extends OrderLineInput {
  rowKey: string
  itemCode: string
  itemName: string
  specification: string
  unitName: string
  amounts?: LineAmounts
}
type Header = Omit<SaveOrderRequest, 'orderId' | 'version' | 'lines'>
const route = useRoute(),
  router = useRouter(),
  formRef = ref<FormInstance>(),
  table = ref<VxeTableInstance<LineDraft>>()
const form = reactive<Header>({
  orderDate: today(),
  supplierId: null,
  priceTaxMode: 'TAX_INCLUDED',
  contactName: '',
  contactPhone: '',
  address: '',
  remark: ''
})
const saved = shallowRef<Order>(),
  defaults = shallowRef<OrderDefaults>(),
  rows = ref<LineDraft[]>([]),
  selectedIds = ref<number[]>([])
const loading = ref(true),
  loaded = ref(false),
  busy = ref(false),
  calculating = ref(false),
  checkingSigningAvailability = ref(false),
  calculationError = ref(''),
  totals = shallowRef<Pick<OrderCalculation, 'netAmount' | 'tax' | 'grossAmount'>>()
const can = (suffix: string) => auth.hasPermi(`purchase:order:${suffix}`)
const readonly = computed(
  () => route.name === 'PurchaseOrderDetail' || Boolean(saved.value && saved.value.status !== 'DRAFT')
)
const activeDetailTab = ref('order')
const signingTabOpened = ref(false)
const canShowSigningTab = computed(() => Boolean(saved.value && readonly.value && auth.hasPermi('signing:task:query')))
const canShowOperationInfoTab = computed(() => Boolean(saved.value && route.name === 'PurchaseOrderDetail'))
const hasDetailTabs = computed(() => canShowSigningTab.value || canShowOperationInfoTab.value)
const actions = computed(() =>
  saved.value ? orderStateActions[saved.value.status].filter((action) => can(action)) : []
)
const baseline = ref('')
let loadSequence = 0,
  calculationSequence = 0,
  timer: ReturnType<typeof setTimeout> | undefined,
  allowNavigation = false
const rules: FormRules<Header> = {
  orderDate: [{ required: true, message: '请选择订单日期', trigger: 'change' }],
  supplierId: [{ required: true, message: '请选择供应商', trigger: 'change' }]
}
function today() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function cleanDecimal(text: string) {
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text
}
function inputs(): OrderLineInput[] {
  return rows.value.map(({ lineId, itemId, unitId, quantity, unitPrice, taxRate, expectedDate, remark }) => ({
    lineId,
    itemId,
    unitId,
    quantity: quantity.trim(),
    unitPrice: unitPrice.trim(),
    taxRate: taxRate.trim(),
    expectedDate: expectedDate || null,
    remark: remark.trim()
  }))
}
function snapshot() {
  return JSON.stringify({ header: { ...form }, lines: inputs() })
}
const dirty = computed(() => loaded.value && !readonly.value && snapshot() !== baseline.value)
function blank(): LineDraft {
  return {
    rowKey: crypto.randomUUID(),
    itemId: null,
    unitId: null,
    itemCode: '',
    itemName: '',
    specification: '',
    unitName: '',
    quantity: '',
    unitPrice: '',
    taxRate: '',
    expectedDate: null,
    remark: ''
  }
}
function apply(view: Order) {
  saved.value = view
  defaults.value = view
  Object.assign(form, {
    orderDate: view.orderDate,
    supplierId: view.supplierId,
    priceTaxMode: view.priceTaxMode,
    contactName: view.contactName,
    contactPhone: view.contactPhone,
    address: view.address,
    remark: view.remark
  })
  rows.value = (view.lines ?? []).map((line) => ({
    ...line,
    rowKey: `line-${line.lineId}`,
    quantity: cleanDecimal(line.quantity),
    taxRate: cleanDecimal(line.taxRate),
    unitPrice: cleanDecimal(view.priceTaxMode === 'TAX_INCLUDED' ? line.grossPrice : line.netPrice),
    amounts: {
      netPrice: line.netPrice,
      grossPrice: line.grossPrice,
      netAmount: line.netAmount,
      tax: line.tax,
      grossAmount: line.grossAmount
    }
  }))
  totals.value = { netAmount: view.netAmount, tax: view.tax, grossAmount: view.grossAmount }
  calculationError.value = ''
  baseline.value = snapshot()
}
async function load() {
  const current = ++loadSequence
  loading.value = true
  loaded.value = false
  calculationSequence++
  clearTimeout(timer)
  try {
    if (route.name === 'PurchaseOrderCreate') {
      if (!can('add')) throw new Error('无新增权限')
      const { data } = await getOrderDefaults()
      if (current !== loadSequence) return
      saved.value = undefined
      defaults.value = data
      rows.value = []
      totals.value = undefined
      Object.assign(form, {
        orderDate: today(),
        supplierId: null,
        priceTaxMode: 'TAX_INCLUDED',
        contactName: '',
        contactPhone: '',
        address: '',
        remark: ''
      })
    } else {
      if (!can('query') || (route.name === 'PurchaseOrderEdit' && !can('edit'))) throw new Error('无详情或编辑权限')
      const { data } = await getOrder(Number(route.params.id))
      if (current !== loadSequence) return
      apply(data)
    }
    baseline.value = snapshot()
    loaded.value = true
    await nextTick()
    formRef.value?.clearValidate()
  } catch {
    /* 请求层展示错误，禁止编辑上一张单据的数据。 */
  } finally {
    if (current === loadSequence) loading.value = false
  }
}
async function startSigning() {
  const order = saved.value
  if (!order || checkingSigningAvailability.value) return
  checkingSigningAvailability.value = true
  try {
    await beginBusinessSigning(router, 'purchase.order', String(order.orderId))
  } catch {
    ElMessage.error('检查签署状态失败，请重试；为避免重复创建，本次未进入新建流程')
  } finally {
    checkingSigningAvailability.value = false
  }
}
function supplierChanged(records: SupplierReference[]) {
  const record = records[0]
  form.contactName = record?.contactName ?? ''
  form.contactPhone = record?.contactPhone ?? ''
  form.address = record?.address ?? ''
}
function fillItem(row: LineDraft, item: ItemReference) {
  row.itemId = item.itemId
  row.itemCode = item.itemCode
  row.itemName = item.itemName
  row.specification = item.specification
  row.unitId = item.baseUnitId
  row.unitName = item.baseUnitName
  row.taxRate = item.defaultTaxRate == null ? '' : String(item.defaultTaxRate)
  row.unitPrice = ''
  row.quantity = ''
  row.amounts = undefined
}
function setItem(row: LineDraft, records: ItemReference[]) {
  if (records[0]) fillItem(row, records[0])
}
function addItems(records: ItemReference[]) {
  if (busy.value || readonly.value) return
  if (rows.value.length + records.length > 200) {
    ElMessage.warning('每张订单最多 200 行')
    selectedIds.value = []
    return
  }
  for (const item of records) {
    const row = blank()
    fillItem(row, item)
    rows.value.push(row)
  }
  selectedIds.value = []
}
function addBlank() {
  if (rows.value.length < 200) rows.value.push(blank())
}
function copy(row: LineDraft) {
  if (rows.value.length >= 200) return
  const result = { ...row, rowKey: crypto.randomUUID(), lineId: undefined, amounts: undefined }
  const index = rows.value.findIndex((r) => r.rowKey === row.rowKey)
  rows.value.splice(index + 1, 0, result)
}
function removeRow(row: LineDraft) {
  rows.value = rows.value.filter((r) => r.rowKey !== row.rowKey)
}
function move(row: LineDraft, offset: number) {
  const index = rows.value.findIndex((r) => r.rowKey === row.rowKey),
    target = index + offset
  if (target < 0 || target >= rows.value.length) return
  const changed = [...rows.value]
  changed.splice(index, 1)
  changed.splice(target, 0, row)
  rows.value = changed
}
function reorder({ dragRow, newRow, dragPos }: VxeTableDefines.RowDragendEventParams<LineDraft>) {
  const next = rows.value.filter((row) => row.rowKey !== dragRow.rowKey)
  const index = next.findIndex((row) => row.rowKey === newRow.rowKey)
  if (index < 0) return
  next.splice(index + (dragPos === 'bottom' ? 1 : 0), 0, dragRow)
  rows.value = next
}
function decimalValid(value: string, places: number, positive = false) {
  const pattern = positive ? /^\d{1,9}(\.\d{1,6})?$/ : /^\d{1,12}(\.\d{1,6})?$/
  if (!pattern.test(value)) return false
  const fraction = (value.split('.')[1] ?? '').replace(/0+$/, '')
  return fraction.length <= places && (!positive || /[1-9]/.test(value))
}
function inputError(): { message: string; row?: LineDraft } | null {
  if (!rows.value.length) return { message: '请至少添加一行采购料品' }
  for (let index = 0; index < rows.value.length; index++) {
    const row = rows.value[index]
    let reason = ''
    if (!row.itemId || !row.unitId) reason = '请选择采购料品'
    else if (!decimalValid(row.quantity.trim(), defaults.value?.quantityDecimalPlaces ?? 6, true))
      reason = '数量须大于零且不能超过本单精度'
    else if (!decimalValid(row.unitPrice.trim(), defaults.value?.priceDecimalPlaces ?? 6))
      reason = '请填写符合本单精度的单价'
    else if (!/^\d{1,3}(\.\d{1,2})?$/.test(row.taxRate.trim()) || Number(row.taxRate) > 100)
      reason = '请填写 0～100 且最多两位小数的税率'
    else if (row.expectedDate && row.expectedDate < form.orderDate) reason = '预计到货日期不能早于订单日期'
    if (reason) return { message: `第 ${index + 1} 行：${reason}`, row }
  }
  return null
}
function queueCalculation() {
  const current = ++calculationSequence
  clearTimeout(timer)
  calculating.value = false
  if (loading.value || readonly.value || !loaded.value) return
  for (const row of rows.value) row.amounts = undefined
  totals.value = undefined
  const error = inputError()
  calculationError.value = rows.value.length ? (error?.message ?? '') : ''
  if (error) return
  calculating.value = true
  const request = {
    orderId: saved.value?.orderId,
    priceTaxMode: form.priceTaxMode,
    lines: inputs().map(({ quantity, unitPrice, taxRate }) => ({ quantity, unitPrice, taxRate }))
  }
  timer = setTimeout(async () => {
    try {
      const { data } = await calculateOrder(request)
      if (current !== calculationSequence) return
      rows.value.forEach((row, index) => {
        row.amounts = data.lines[index]
      })
      totals.value = data
      calculationError.value = ''
    } catch {
      if (current === calculationSequence)
        calculationError.value = '金额试算失败，录入内容已保留，可点击“重新试算”重试。'
    } finally {
      if (current === calculationSequence) calculating.value = false
    }
  }, 300)
}
watch(() => JSON.stringify({ mode: form.priceTaxMode, date: form.orderDate, lines: inputs() }), queueCalculation, {
  flush: 'sync'
})
async function save() {
  if (busy.value || readonly.value || !formRef.value) return
  if (!(await formRef.value.validate().catch(() => false))) return
  const error = inputError()
  if (error) {
    ElMessage.warning(error.message)
    if (error.row) await table.value?.scrollToRow(error.row)
    return
  }
  busy.value = true
  calculationSequence++
  clearTimeout(timer)
  try {
    const payload: SaveOrderRequest = {
      ...form,
      contactName: form.contactName.trim(),
      contactPhone: form.contactPhone.trim(),
      address: form.address.trim(),
      remark: form.remark.trim(),
      orderId: saved.value?.orderId,
      version: saved.value?.version,
      lines: inputs()
    }
    const { data } = saved.value ? await updateOrder(payload) : await createOrder(payload)
    loading.value = true
    apply(data)
    loading.value = false
    calculating.value = false
    ElMessage.success('采购订单已保存')
    allowNavigation = true
    await router.replace(`/purchase/order-document/${data.orderId}/edit`)
  } catch {
    /* 不清空表单，允许用户修正或重新加载版本。 */
  } finally {
    busy.value = false
    allowNavigation = false
  }
}
async function execute(action: OrderAction) {
  if (!saved.value || busy.value) return
  if (dirty.value) {
    ElMessage.warning('请先保存草稿，再执行单据操作')
    return
  }
  let reason = ''
  try {
    if (action === 'reject' || action === 'close') {
      const result = await ElMessageBox.prompt(
        `请输入${action === 'reject' ? '驳回' : '关闭'}原因`,
        orderActionLabels[action],
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
        `确认${orderActionLabels[action]}“${saved.value.orderNo}”？`,
        orderActionLabels[action],
        { confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning' }
      )
  } catch {
    return
  }
  busy.value = true
  calculationSequence++
  clearTimeout(timer)
  try {
    const { data } = await actOnOrder(saved.value.orderId, action, saved.value.version, reason)
    loading.value = true
    apply(data)
    loading.value = false
    ElMessage.success('操作成功')
    allowNavigation = true
    await router.replace(`/purchase/order-document/${data.orderId}/detail`)
  } catch {
    /* 保留本地快照，版本冲突由请求层提示。 */
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
    await ElMessageBox.confirm('尚有未保存的修改，是否放弃？', '离开采购订单', {
      confirmButtonText: '放弃修改',
      cancelButtonText: '继续编辑',
      type: 'warning'
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
  () => {
    activeDetailTab.value = 'order'
    signingTabOpened.value = false
    void load()
  }
)
watch(activeDetailTab, (tab) => {
  if (tab === 'signing') {
    signingTabOpened.value = true
  }
})
onMounted(() => {
  void load()
  window.addEventListener('beforeunload', beforeUnload)
})
onBeforeUnmount(() => {
  loadSequence++
  calculationSequence++
  clearTimeout(timer)
  window.removeEventListener('beforeunload', beforeUnload)
})
</script>
<style scoped>
.document-heading,
.document-actions,
.action-group,
.line-toolbar,
.line-add,
.totals {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.document-bar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}
.document-heading {
  min-height: 34px;
}
.document-heading strong {
  font-size: 20px;
}
.document-actions {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
  gap: 8px;
}
.action-group {
  min-height: 34px;
  gap: 8px;
}
.action-group + .action-group {
  padding-left: 12px;
  border-left: 1px solid var(--el-border-color);
}
.order-detail-tabs:not(.has-detail-tabs) :deep(.el-tabs__header) {
  display: none;
}
.order-detail-tabs :deep(.el-tabs__content) {
  overflow: visible;
}
.order-detail-tabs:not(.has-detail-tabs) :deep(.el-tabs__content) {
  padding-top: 0;
}
.header-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  column-gap: 20px;
}
.line-toolbar {
  justify-content: space-between;
  margin: 20px 0 12px;
}
.line-add {
  width: 480px;
  max-width: 100%;
  flex-wrap: nowrap;
}
.line-add > :first-child {
  flex: 1;
  min-width: 0;
}
.line-toolbar > span {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.totals {
  justify-content: flex-end;
  margin-top: 20px;
  gap: 24px;
}
.totals strong {
  margin-left: 8px;
  font-size: 18px;
}
.audit-info {
  margin-top: 8px;
}
.calculation-alert {
  margin-bottom: 12px;
}
@media (max-width: 1200px) {
  .header-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .action-group {
    flex-wrap: wrap;
  }
  .action-group + .action-group {
    padding-left: 0;
    border-left: 0;
  }
}
@media (max-width: 600px) {
  .header-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

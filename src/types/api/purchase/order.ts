import type { ReceiptProgress } from './arrival'
export { receiptProgressLabels } from './arrival'
import type { PageQuery } from '@/types/api/common'

export type PriceTaxMode = 'TAX_INCLUDED' | 'TAX_EXCLUDED'
export type OrderStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'CLOSED'
export type ArrivalProgress = 'NOT_ARRIVED' | 'PARTIALLY_ARRIVED' | 'FULLY_ARRIVED'
export const arrivalProgressLabels: Record<ArrivalProgress, string> = {
  NOT_ARRIVED: '未到货',
  PARTIALLY_ARRIVED: '部分到货',
  FULLY_ARRIVED: '全部到货'
}
export type OrderAction = 'submit' | 'withdraw' | 'approve' | 'reject' | 'close'
export const orderStatusLabels: Record<OrderStatus, string> = {
  DRAFT: '草稿',
  SUBMITTED: '已提交',
  APPROVED: '已审核',
  CLOSED: '已关闭'
}
export const orderActionLabels: Record<OrderAction, string> = {
  submit: '提交',
  withdraw: '撤回',
  approve: '审核通过',
  reject: '驳回',
  close: '关闭订单'
}
export const orderStateActions: Record<OrderStatus, OrderAction[]> = {
  DRAFT: ['submit'],
  SUBMITTED: ['withdraw', 'approve', 'reject'],
  APPROVED: ['close'],
  CLOSED: []
}
export interface LineAmounts {
  netPrice: string
  grossPrice: string
  netAmount: string
  tax: string
  grossAmount: string
}
export interface OrderLineInput {
  lineId?: number
  itemId: number | null
  unitId: number | null
  quantity: string
  unitPrice: string
  taxRate: string
  expectedDate: string | null
  remark: string
}
export interface OrderLine extends LineAmounts {
  pendingReceiptQuantity: string
  receivedQuantity: string
  arrivedNotReceivedQuantity: string
  pendingArrivalQuantity: string
  arrivedQuantity: string
  availableQuantity: string
  lineId: number
  orderId: number
  lineNo: number
  itemId: number
  itemCode: string
  itemName: string
  specification: string
  unitId: number
  unitName: string
  quantity: string
  taxRate: string
  expectedDate: string | null
  remark: string
}
export interface OrderDefaults {
  buyerId: number
  buyerName: string
  deptId: number
  deptName: string
  quantityDecimalPlaces: number
  priceDecimalPlaces: number
  amountDecimalPlaces: number
  roundingMode: 'HALF_UP'
}
export interface SaveOrderRequest {
  orderId?: number
  version?: number
  orderDate: string
  supplierId: number | null
  priceTaxMode: PriceTaxMode
  contactName: string
  contactPhone: string
  address: string
  remark: string
  lines: OrderLineInput[]
}
export interface Order extends OrderDefaults {
  receiptProgress: ReceiptProgress
  arrivalProgress: ArrivalProgress
  orderId: number
  orderNo: string
  orderDate: string
  supplierId: number
  supplierCode: string
  supplierName: string
  contactName: string
  contactPhone: string
  address: string
  currency: 'CNY'
  priceTaxMode: PriceTaxMode
  status: OrderStatus
  lineCount: number
  netAmount: string
  tax: string
  grossAmount: string
  remark: string
  version: number
  submittedBy: string | null
  submittedTime: string | null
  reviewedBy: string | null
  reviewedTime: string | null
  reviewRemark: string
  closedBy: string | null
  closedTime: string | null
  closeReason: string
  createBy: string
  createTime: string
  updateBy: string | null
  updateTime: string | null
  lines: OrderLine[] | null
}
export interface OrderCalculation {
  lines: LineAmounts[]
  netAmount: string
  tax: string
  grossAmount: string
}
export type OrderSortField = 'orderNo' | 'orderDate' | 'updateTime' | 'grossAmount'
export interface OrderQuery extends PageQuery {
  orderNo?: string
  supplierId?: number
  status?: OrderStatus
  beginDate?: string
  endDate?: string
  sortField?: OrderSortField
  sortDirection?: 'asc' | 'desc'
}
export interface CalculationRequest {
  orderId?: number
  priceTaxMode: PriceTaxMode
  lines: Pick<OrderLineInput, 'quantity' | 'unitPrice' | 'taxRate'>[]
}

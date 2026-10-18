import type { PageQuery } from '@/types/api/common'

export type ArrivalStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'VOIDED'
export type ArrivalAction = 'submit' | 'withdraw' | 'approve' | 'reject' | 'void'
export const arrivalStatusLabels: Record<ArrivalStatus, string> = {
  DRAFT: '草稿',
  SUBMITTED: '已提交',
  APPROVED: '已审核',
  VOIDED: '已作废'
}
export const arrivalActionLabels: Record<ArrivalAction, string> = {
  submit: '提交',
  withdraw: '撤回',
  approve: '审核通过',
  reject: '驳回',
  void: '作废'
}
export const arrivalStateActions: Record<ArrivalStatus, ArrivalAction[]> = {
  DRAFT: ['submit'],
  SUBMITTED: ['withdraw', 'approve', 'reject'],
  APPROVED: ['void'],
  VOIDED: []
}
export interface ArrivalDefaults {
  receiverId: number
  receiverName: string
  deptId: number
  deptName: string
}
export interface ArrivalQuantities {
  orderQuantity: string
  pendingArrivalQuantity: string
  arrivedQuantity: string
  availableQuantity: string
}
export interface OrderLineReference extends ArrivalQuantities {
  orderId: number
  orderLineId: number
  orderNo: string
  orderLineNo: number
  orderDate: string
  supplierId: number
  itemId: number
  itemCode: string
  itemName: string
  specification: string
  unitId: number
  unitName: string
  expectedDate: string | null
  quantityDecimalPlaces: number
}
export interface ArrivalLineInput {
  lineId?: number
  orderLineId: number
  quantity: string
  remark: string
}
export type ReceiptProgress = 'NOT_RECEIVED' | 'PARTIALLY_RECEIVED' | 'FULLY_RECEIVED'
export const receiptProgressLabels: Record<ReceiptProgress, string> = {
  NOT_RECEIVED: '未入库',
  PARTIALLY_RECEIVED: '部分入库',
  FULLY_RECEIVED: '全部入库'
}
export interface ArrivalLine extends ArrivalLineInput, ArrivalQuantities {
  pendingReceiptQuantity: string
  receivedQuantity: string
  availableReceiptQuantity: string
  lineId: number
  arrivalId: number
  lineNo: number
  orderId: number
  orderNo: string
  orderLineNo: number
  itemId: number
  itemCode: string
  itemName: string
  specification: string
  unitId: number
  unitName: string
  quantityDecimalPlaces: number
}
export interface SaveArrivalRequest {
  arrivalId?: number
  version?: number
  arrivalDate: string
  supplierId: number | null
  warehouseId: number | null
  supplierDeliveryNo: string
  remark: string
  lines: ArrivalLineInput[]
}
export interface Arrival extends ArrivalDefaults {
  receiptProgress: ReceiptProgress
  arrivalId: number
  arrivalNo: string
  arrivalDate: string
  supplierId: number
  supplierCode: string
  supplierName: string
  supplierDeliveryNo: string
  warehouseId: number | null
  warehouseCode: string
  warehouseName: string
  status: ArrivalStatus
  lineCount: number
  remark: string
  version: number
  submittedBy: string | null
  submittedTime: string | null
  reviewedBy: string | null
  reviewedTime: string | null
  reviewRemark: string
  voidedBy: string | null
  voidedTime: string | null
  voidReason: string
  createBy: string
  createTime: string
  updateBy: string | null
  updateTime: string | null
  lines: ArrivalLine[] | null
}
export type ArrivalSortField = 'arrivalNo' | 'arrivalDate' | 'updateTime'
export interface ArrivalQuery extends PageQuery {
  arrivalNo?: string
  supplierId?: number
  warehouseId?: number
  orderId?: number
  status?: ArrivalStatus
  beginDate?: string
  endDate?: string
  sortField?: ArrivalSortField
  sortDirection?: 'asc' | 'desc'
}
export interface OrderLineReferenceQuery extends PageQuery {
  supplierId: number
  orderId?: number
  keyword?: string
  sortField?: 'orderNo' | 'itemCode' | 'itemName'
  sortDirection?: 'asc' | 'desc'
}

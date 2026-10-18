import type { PageQuery } from '@/types/api/common'
import type { ArrivalStatus, ArrivalAction, ArrivalDefaults } from './arrival'
export {
  arrivalStatusLabels as receiptStatusLabels,
  arrivalActionLabels as receiptActionLabels,
  arrivalStateActions as receiptStateActions
} from './arrival'
export type ReceiptStatus = ArrivalStatus
export type ReceiptAction = ArrivalAction
export type ReceiptDefaults = ArrivalDefaults
export interface ReceiptQuantities {
  arrivalQuantity: string
  pendingReceiptQuantity: string
  receivedQuantity: string
  availableQuantity: string
}
export interface ArrivalLineReference extends ReceiptQuantities {
  arrivalId: number
  arrivalLineId: number
  arrivalNo: string
  arrivalLineNo: number
  arrivalDate: string
  supplierId: number
  supplierCode: string
  supplierName: string
  warehouseId: number | null
  warehouseCode: string
  warehouseName: string
  locationEnabled: boolean
  orderId: number
  orderLineId: number
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
export interface ReceiptLineInput {
  warehouseId: number | null
  lineId?: number
  arrivalLineId: number
  locationId: number | null
  quantity: string
  remark: string
}
export interface ReceiptLine extends ReceiptLineInput, ReceiptQuantities {
  warehouseId: number
  warehouseCode: string
  warehouseName: string
  locationEnabled: boolean
  lineId: number
  receiptId: number
  lineNo: number
  arrivalId: number
  arrivalNo: string
  arrivalLineNo: number
  orderId: number
  orderLineId: number
  orderNo: string
  orderLineNo: number
  itemId: number
  itemCode: string
  itemName: string
  specification: string
  unitId: number
  unitName: string
  quantityDecimalPlaces: number
  locationCode: string
  locationName: string
}
export interface SaveReceiptRequest {
  receiptId?: number
  version?: number
  receiptDate: string
  supplierId: number | null
  remark: string
  lines: ReceiptLineInput[]
}
export interface Receipt extends ReceiptDefaults {
  receiptId: number
  receiptNo: string
  receiptDate: string
  supplierId: number
  supplierCode: string
  supplierName: string
  warehouseNames: string[]
  status: ReceiptStatus
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
  lines: ReceiptLine[] | null
}
export type ReceiptSortField = 'receiptNo' | 'receiptDate' | 'updateTime'
export interface ReceiptQuery extends PageQuery {
  orderId?: number
  receiptNo?: string
  supplierId?: number
  warehouseId?: number
  arrivalId?: number
  status?: ReceiptStatus
  beginDate?: string
  endDate?: string
  sortField?: ReceiptSortField
  sortDirection?: 'asc' | 'desc'
}
export interface ArrivalLineReferenceQuery extends PageQuery {
  supplierId?: number
  warehouseId?: number
  arrivalId?: number
  keyword?: string
  sortField?: 'arrivalNo' | 'itemCode' | 'itemName'
  sortDirection?: 'asc' | 'desc'
}

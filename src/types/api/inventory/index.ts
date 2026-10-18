import type { PageQuery } from '@/types/api/common'
export interface InventoryQuery extends PageQuery {
  keyword?: string
  warehouseCode?: string
  locationCode?: string
  warehouseId?: number
  locationId?: number
  itemId?: number
  withoutLocation?: boolean
  onlyPositive?: boolean
  receiptNo?: string
  businessType?: 'PURCHASE_RECEIPT' | 'PURCHASE_RECEIPT_VOID'
  beginTime?: string
  endTime?: string
  sortField?: 'quantity' | 'postedTime'
  sortDirection?: 'asc' | 'desc'
}
export interface Balance {
  balanceId: number
  warehouseId: number
  locationId: number | null
  itemId: number
  unitId: number
  quantity: string
  version: number
  warehouseCode: string
  warehouseName: string
  locationCode: string | null
  locationName: string | null
  itemCode: string
  itemName: string
  specification: string
  unitName: string
}
export interface InventoryTransaction {
  transactionId: number
  balanceId: number
  businessType: 'PURCHASE_RECEIPT' | 'PURCHASE_RECEIPT_VOID'
  receiptId: number
  receiptNo: string
  receiptLineId: number
  warehouseId: number
  warehouseCode: string
  warehouseName: string
  locationId: number | null
  locationCode: string
  locationName: string
  itemId: number
  itemCode: string
  itemName: string
  specification: string
  unitId: number
  unitName: string
  quantityChange: string
  quantityBefore: string
  quantityAfter: string
  businessDate: string
  postedTime: string
  reversalOf: number | null
  remark: string
  createBy: string
}
export const inventoryBusinessLabels = { PURCHASE_RECEIPT: '采购入库', PURCHASE_RECEIPT_VOID: '入库作废冲销' } as const

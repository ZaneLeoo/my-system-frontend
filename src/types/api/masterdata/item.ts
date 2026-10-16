import type { EnableStatusCode, PageQuery } from '@/types/api/common'

export interface SaveItemRequest {
  itemId?: number
  itemCode: string
  itemName: string
  specification: string
  categoryId?: number
  baseUnitId?: number
  purchaseUnitId: number | null
  salesUnitId: number | null
  purchaseEnabled: boolean
  defaultTaxRate: number | null
  status: EnableStatusCode
  remark: string
  version?: number
}
export interface Item extends SaveItemRequest {
  itemId: number
  categoryId: number
  baseUnitId: number
  version: number
  categoryName: string
  categoryPath: string
  baseUnitName: string
  purchaseUnitName: string | null
  salesUnitName: string | null
  createBy: string
  createTime: string
  updateBy: string | null
  updateTime: string | null
}
export type ItemSortField = 'itemCode' | 'itemName' | 'specification' | 'updateTime'
export interface ItemQuery extends PageQuery {
  itemCode?: string
  itemName?: string
  specification?: string
  categoryId?: number
  baseUnitId?: number
  purchaseUnitId?: number
  salesUnitId?: number
  purchaseEnabled?: boolean
  status?: EnableStatusCode
  sortField?: ItemSortField
  sortDirection?: 'asc' | 'desc'
}
export interface UnitOption {
  unitId: number
  unitCode: string
  unitName: string
  status: EnableStatusCode
}

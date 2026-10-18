import type { EnableStatusCode, PageQuery } from '@/types/api/common'

export interface Warehouse {
  warehouseId: number
  warehouseCode: string
  warehouseName: string
  locationEnabled: boolean
  status: EnableStatusCode
  remark: string
  version: number
  createBy: string
  createTime: string
  updateBy: string | null
  updateTime: string | null
}

export type WarehouseSortField = 'warehouseCode' | 'warehouseName' | 'updateTime'

export interface WarehouseQuery extends PageQuery {
  keyword?: string
  warehouseCode?: string
  warehouseName?: string
  locationEnabled?: boolean
  status?: EnableStatusCode
  sortField?: WarehouseSortField
  sortDirection?: 'asc' | 'desc'
}

export interface SaveWarehouseRequest {
  warehouseId?: number
  warehouseCode: string
  warehouseName: string
  locationEnabled: boolean
  status: EnableStatusCode
  remark: string
  version?: number
}

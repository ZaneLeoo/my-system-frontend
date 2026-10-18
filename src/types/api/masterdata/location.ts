import type { EnableStatusCode, PageQuery } from '@/types/api/common'

export interface Location {
  warehouseId: number
  locationId: number
  locationCode: string
  locationName: string
  status: EnableStatusCode
  remark: string
  version: number
  createBy: string
  createTime: string
  updateBy: string | null
  updateTime: string | null
}

export type LocationSortField = 'locationCode' | 'locationName' | 'updateTime'

export interface LocationQuery extends PageQuery {
  keyword?: string
  warehouseId: number
  locationCode?: string
  locationName?: string
  status?: EnableStatusCode
  sortField?: LocationSortField
  sortDirection?: 'asc' | 'desc'
}

export interface SaveLocationRequest {
  warehouseId: number
  locationId?: number
  locationCode: string
  locationName: string
  status: EnableStatusCode
  remark: string
  version?: number
}

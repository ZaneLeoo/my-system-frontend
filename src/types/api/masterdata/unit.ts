import type { EnableStatusCode, PageQuery } from '@/types/api/common'

export interface Unit {
  unitId: number
  unitCode: string
  unitName: string
  status: EnableStatusCode
  remark: string
  version: number
  createBy: string
  createTime: string
  updateBy: string | null
  updateTime: string | null
}

export type UnitSortField = 'unitCode' | 'unitName' | 'updateTime'

export interface UnitQuery extends PageQuery {
  unitCode?: string
  unitName?: string
  status?: EnableStatusCode
  sortField?: UnitSortField
  sortDirection?: 'asc' | 'desc'
}

export interface SaveUnitRequest {
  unitId?: number
  unitCode: string
  unitName: string
  status: EnableStatusCode
  remark: string
  version?: number
}

import type { EnableStatusCode, PageQuery } from '@/types/api/common'

export interface Supplier {
  supplierId: number
  supplierCode: string
  supplierName: string
  shortName: string
  contactName: string
  contactPhone: string
  address: string
  status: EnableStatusCode
  remark: string
  version: number
  createBy: string
  createTime: string
  updateBy: string | null
  updateTime: string | null
}

export type SupplierSortField = 'supplierCode' | 'supplierName' | 'updateTime'

export interface SupplierQuery extends PageQuery {
  supplierCode?: string
  supplierName?: string
  status?: EnableStatusCode
  sortField?: SupplierSortField
  sortDirection?: 'asc' | 'desc'
}

export interface SaveSupplierRequest {
  supplierId?: number
  supplierCode: string
  supplierName: string
  shortName: string
  contactName: string
  contactPhone: string
  address: string
  status: EnableStatusCode
  remark: string
  version?: number
}

export type SupplierReference = Pick<
  Supplier,
  'supplierId' | 'supplierCode' | 'supplierName' | 'shortName' | 'contactName' | 'contactPhone' | 'address' | 'status'
>

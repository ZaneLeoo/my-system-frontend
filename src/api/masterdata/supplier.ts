import request from '@/utils/request'
import type { ApiResponse, PageResult } from '@/types/api/common'
import type { SaveSupplierRequest, Supplier, SupplierQuery, SupplierReference } from '@/types/api/masterdata/supplier'

const baseUrl = '/masterdata/supplier'

/** 查询接口分页、筛选和排序后的供应商列表。 */
export function listSuppliers(params: SupplierQuery): Promise<ApiResponse<PageResult<Supplier>>> {
  return request({ url: `${baseUrl}/list`, method: 'get', params })
}

/** 获取最新详情及编辑版本。 */
export function getSupplier(id: number): Promise<ApiResponse<Supplier>> {
  return request({ url: `${baseUrl}/${id}`, method: 'get' })
}

/** 新增供应商。 */
export function createSupplier(data: SaveSupplierRequest): Promise<ApiResponse<Supplier>> {
  return request({ url: baseUrl, method: 'post', data })
}

/** 按当前版本修改供应商。 */
export function updateSupplier(data: SaveSupplierRequest): Promise<ApiResponse<null>> {
  return request({ url: baseUrl, method: 'put', data })
}

/** 按当前版本逻辑删除供应商。 */
export function deleteSupplier(id: number, version: number): Promise<ApiResponse<null>> {
  return request({ url: `${baseUrl}/${id}`, method: 'delete', params: { version } })
}

/** 完整只读参照，使用独立权限，不受管理列表页大小限制。 */
export function getSupplierReferences(): Promise<ApiResponse<SupplierReference[]>> {
  return request({ url: '/masterdata/reference/suppliers', method: 'get' })
}

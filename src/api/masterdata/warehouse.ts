import request from '@/utils/request'
import type { ApiResponse, PageResult } from '@/types/api/common'
import type { SaveWarehouseRequest, Warehouse, WarehouseQuery } from '@/types/api/masterdata/warehouse'

const baseUrl = '/masterdata/warehouse'

/** 查询接口分页、筛选和排序后的仓库列表。 */
export function listWarehouses(params: WarehouseQuery): Promise<ApiResponse<PageResult<Warehouse>>> {
  return request({ url: `${baseUrl}/list`, method: 'get', params })
}

/** 获取最新详情及编辑版本。 */
export function getWarehouse(id: number): Promise<ApiResponse<Warehouse>> {
  return request({ url: `${baseUrl}/${id}`, method: 'get' })
}

/** 新增仓库。 */
export function createWarehouse(data: SaveWarehouseRequest): Promise<ApiResponse<Warehouse>> {
  return request({ url: baseUrl, method: 'post', data })
}

/** 按当前版本修改仓库。 */
export function updateWarehouse(data: SaveWarehouseRequest): Promise<ApiResponse<null>> {
  return request({ url: baseUrl, method: 'put', data })
}

/** 按当前版本逻辑删除仓库。 */
export function deleteWarehouse(id: number, version: number): Promise<ApiResponse<null>> {
  return request({ url: `${baseUrl}/${id}`, method: 'delete', params: { version } })
}

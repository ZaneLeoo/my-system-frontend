import request from '@/utils/request'
import type { ApiResponse, PageResult } from '@/types/api/common'
import type { SaveLocationRequest, Location, LocationQuery } from '@/types/api/masterdata/location'

const baseUrl = '/masterdata/location'

/** 查询接口分页、筛选和排序后的货位列表。 */
export function listLocations(params: LocationQuery): Promise<ApiResponse<PageResult<Location>>> {
  return request({ url: `${baseUrl}/list`, method: 'get', params })
}

/** 获取最新详情及编辑版本。 */
export function getLocation(id: number): Promise<ApiResponse<Location>> {
  return request({ url: `${baseUrl}/${id}`, method: 'get' })
}

/** 新增货位。 */
export function createLocation(data: SaveLocationRequest): Promise<ApiResponse<Location>> {
  return request({ url: baseUrl, method: 'post', data })
}

/** 按当前版本修改货位。 */
export function updateLocation(data: SaveLocationRequest): Promise<ApiResponse<null>> {
  return request({ url: baseUrl, method: 'put', data })
}

/** 按当前版本逻辑删除货位。 */
export function deleteLocation(id: number, version: number): Promise<ApiResponse<null>> {
  return request({ url: `${baseUrl}/${id}`, method: 'delete', params: { version } })
}

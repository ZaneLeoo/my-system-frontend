import request from '@/utils/request'
import type { ApiResponse, PageResult } from '@/types/api/common'
import type { SaveUnitRequest, Unit, UnitQuery } from '@/types/api/masterdata/unit'

const baseUrl = '/masterdata/unit'

/** 查询接口分页、筛选和排序后的单位列表。 */
export function listUnits(params: UnitQuery): Promise<ApiResponse<PageResult<Unit>>> {
  return request({ url: `${baseUrl}/list`, method: 'get', params })
}

/** 获取最新详情及编辑版本。 */
export function getUnit(id: number): Promise<ApiResponse<Unit>> {
  return request({ url: `${baseUrl}/${id}`, method: 'get' })
}

/** 新增单位。 */
export function createUnit(data: SaveUnitRequest): Promise<ApiResponse<Unit>> {
  return request({ url: baseUrl, method: 'post', data })
}

/** 按当前版本修改单位。 */
export function updateUnit(data: SaveUnitRequest): Promise<ApiResponse<null>> {
  return request({ url: baseUrl, method: 'put', data })
}

/** 按当前版本逻辑删除单位。 */
export function deleteUnit(id: number, version: number): Promise<ApiResponse<null>> {
  return request({ url: `${baseUrl}/${id}`, method: 'delete', params: { version } })
}

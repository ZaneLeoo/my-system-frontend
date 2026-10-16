import type { CategoryTreeNode } from '@/types/api/masterdata/item-category'
import type { UnitOption } from '@/types/api/masterdata/item'
import request from '@/utils/request'
import type { ApiResponse, PageResult } from '@/types/api/common'
import type { SaveItemRequest, Item, ItemQuery } from '@/types/api/masterdata/item'

const baseUrl = '/masterdata/item'

/** 查询接口分页、筛选和排序后的料品列表。 */
export function listItems(params: ItemQuery): Promise<ApiResponse<PageResult<Item>>> {
  return request({ url: `${baseUrl}/list`, method: 'get', params })
}

/** 获取最新详情及编辑版本。 */
export function getItem(id: number): Promise<ApiResponse<Item>> {
  return request({ url: `${baseUrl}/${id}`, method: 'get' })
}

/** 新增料品。 */
export function createItem(data: SaveItemRequest): Promise<ApiResponse<Item>> {
  return request({ url: baseUrl, method: 'post', data })
}

/** 按当前版本修改料品。 */
export function updateItem(data: SaveItemRequest): Promise<ApiResponse<null>> {
  return request({ url: baseUrl, method: 'put', data })
}

/** 按当前版本逻辑删除料品。 */
export function deleteItem(id: number, version: number): Promise<ApiResponse<null>> {
  return request({ url: `${baseUrl}/${id}`, method: 'delete', params: { version } })
}

/** 料品权限可读取选项，无需分类和单位维护权限。 */
export function getCategoryOptions(): Promise<ApiResponse<CategoryTreeNode[]>> {
  return request({ url: `${baseUrl}/category-options`, method: 'get' })
}
/** 返回包含停用单位的完整列表，不分页。 */
export function getUnitOptions(): Promise<ApiResponse<UnitOption[]>> {
  return request({ url: `${baseUrl}/unit-options`, method: 'get' })
}

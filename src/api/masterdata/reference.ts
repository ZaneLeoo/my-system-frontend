import request from '@/utils/request'
import type { ApiResponse, PageResult } from '@/types/api/common'
import type { CategoryTreeNode } from '@/types/api/masterdata/item-category'
import type { ItemReference, ItemReferenceQuery, UnitReference } from '@/types/api/masterdata/reference'

const base = '/masterdata/reference'
export function searchItemReferences(params: ItemReferenceQuery): Promise<ApiResponse<PageResult<ItemReference>>> {
  return request({ url: `${base}/items`, method: 'get', params })
}
export function resolveItemReferences(ids: number[]): Promise<ApiResponse<ItemReference[]>> {
  return request({ url: `${base}/items/resolve`, method: 'get', params: { ids: ids.join(',') } })
}
export function getItemReferenceCategories(): Promise<ApiResponse<CategoryTreeNode[]>> {
  return request({ url: `${base}/items/category-options`, method: 'get' })
}
export function getUnitReferences(): Promise<ApiResponse<UnitReference[]>> {
  return request({ url: `${base}/units`, method: 'get' })
}
export function getCategoryReferences(): Promise<ApiResponse<CategoryTreeNode[]>> {
  return request({ url: `${base}/categories`, method: 'get' })
}

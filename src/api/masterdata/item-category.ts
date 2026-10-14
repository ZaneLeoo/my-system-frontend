import request from '@/utils/request'
import type { AjaxResult } from '@/types/api/common'
import type {
  CategoryQuery,
  CategoryTreeNode,
  ItemCategory,
  SaveCategoryRequest
} from '@/types/api/masterdata/item-category'

const baseUrl = '/masterdata/item-category'

/** 查询分类以及用于维持层级的祖先节点。 */
export function listCategories(params: CategoryQuery): Promise<AjaxResult<ItemCategory[]>> {
  return request({ url: `${baseUrl}/list`, method: 'get', params })
}

/** 编辑时排除当前节点及后代。 */
export function getCategoryTree(excludedId?: number): Promise<AjaxResult<CategoryTreeNode[]>> {
  return request({ url: `${baseUrl}/tree`, method: 'get', params: { excludedId } })
}

export function getCategory(id: number): Promise<AjaxResult<ItemCategory>> {
  return request({ url: `${baseUrl}/${id}`, method: 'get' })
}

export function createCategory(data: SaveCategoryRequest): Promise<AjaxResult<ItemCategory>> {
  return request({ url: baseUrl, method: 'post', data })
}

export function updateCategory(data: SaveCategoryRequest): Promise<AjaxResult> {
  return request({ url: baseUrl, method: 'put', data })
}

export function deleteCategory(id: number, version: number): Promise<AjaxResult> {
  return request({ url: `${baseUrl}/${id}`, method: 'delete', params: { version } })
}

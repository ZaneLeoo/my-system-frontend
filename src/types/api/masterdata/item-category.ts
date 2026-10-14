/** 与后端 CategoryStatus 编码一致。 */
export const CategoryStatus = {
  Enabled: '0',
  Disabled: '1'
} as const

export type CategoryStatusCode = (typeof CategoryStatus)[keyof typeof CategoryStatus]

export interface ItemCategory {
  categoryId: number
  parentId: number
  categoryCode: string
  categoryName: string
  sortOrder: number
  status: CategoryStatusCode
  remark: string
  version: number
  createBy: string
  createTime: string
  updateBy: string | null
  updateTime: string | null
  /** false 表示筛选时仅为保留层级而返回的祖先。 */
  matched: boolean
}

export interface CategoryQuery {
  categoryCode?: string
  categoryName?: string
  status?: CategoryStatusCode
}

export interface SaveCategoryRequest {
  categoryId?: number
  parentId: number
  categoryCode: string
  categoryName: string
  sortOrder: number
  status: CategoryStatusCode
  remark: string
  version?: number
}

export interface CategoryTreeNode {
  id: number
  label: string
  disabled: boolean
  children: CategoryTreeNode[]
}

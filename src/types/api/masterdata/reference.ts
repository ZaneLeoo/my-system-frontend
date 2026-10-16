import type { Item } from './item'
import type { Unit } from './unit'
import type { CategoryTreeNode } from './item-category'
import type { PageQuery } from '../common'

export type ItemReference = Pick<
  Item,
  | 'itemId'
  | 'itemCode'
  | 'itemName'
  | 'specification'
  | 'categoryId'
  | 'categoryName'
  | 'categoryPath'
  | 'baseUnitId'
  | 'baseUnitName'
  | 'purchaseUnitId'
  | 'purchaseUnitName'
  | 'salesUnitId'
  | 'salesUnitName'
  | 'purchaseEnabled'
  | 'defaultTaxRate'
  | 'status'
>
export type UnitReference = Pick<Unit, 'unitId' | 'unitCode' | 'unitName' | 'status'>
export type CategoryReference = CategoryTreeNode & { path: string }
export interface ItemReferenceQuery extends PageQuery {
  keyword?: string
  categoryId?: number
  purchaseOnly?: boolean
  sortField?: 'itemCode' | 'itemName' | 'specification'
  sortDirection?: 'asc' | 'desc'
}

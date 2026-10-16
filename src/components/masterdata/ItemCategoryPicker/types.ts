import type { CategoryTreeNode } from '@/types/api/masterdata/item-category'
export interface ItemCategoryPickerProps {
  modelValue?: number | null
  options?: CategoryTreeNode[]
  disabled?: boolean
  clearable?: boolean
  placeholder?: string
}

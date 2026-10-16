import type { ItemReference } from '@/types/api/masterdata/reference'
export type ItemPickerValue<Multiple extends boolean> = Multiple extends true ? number[] : number | null
export interface ItemPickerProps<Multiple extends boolean = false> {
  modelValue?: ItemPickerValue<Multiple>
  multiple?: Multiple
  purchaseOnly?: boolean
  disabled?: boolean
  clearable?: boolean
  placeholder?: string
}
export type { ItemReference }

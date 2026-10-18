import type { LocationReference } from '@/types/api/masterdata/storage-reference'
export interface LocationPickerProps {
  modelValue?: number | null
  warehouseId: number | null
  disabled?: boolean
  clearable?: boolean
  placeholder?: string
}
export type { LocationReference }

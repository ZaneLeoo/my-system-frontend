import type { SupplierReference } from '@/types/api/masterdata/supplier'
export interface SupplierPickerProps {
  modelValue?: number | null
  options?: SupplierReference[]
  disabled?: boolean
  clearable?: boolean
  placeholder?: string
}
export type { SupplierReference }

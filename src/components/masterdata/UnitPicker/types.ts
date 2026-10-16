import type { UnitReference } from '@/types/api/masterdata/reference'
export interface UnitPickerProps {
  modelValue?: number | null
  options?: UnitReference[]
  disabled?: boolean
  clearable?: boolean
  placeholder?: string
}
export type { UnitReference }

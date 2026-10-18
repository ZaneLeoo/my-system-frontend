import type { ArrivalLineReference } from '@/types/api/purchase/receipt'

export interface PurchaseArrivalLinePickerProps {
  modelValue: boolean
  supplierId: number | null
  warehouseId?: number | null
  excludedIds?: number[]
  maxSelection?: number
}
export type { ArrivalLineReference }

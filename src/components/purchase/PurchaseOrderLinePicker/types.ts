import type { OrderLineReference } from '@/types/api/purchase/arrival'

export interface PurchaseOrderLinePickerProps {
  modelValue: boolean
  supplierId: number | null
  excludedIds?: number[]
  maxSelection?: number
}
export type { OrderLineReference }

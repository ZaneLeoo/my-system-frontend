import type { Warehouse, WarehouseQuery } from './warehouse'
import type { Location, LocationQuery } from './location'
export type WarehouseReference = Pick<
  Warehouse,
  'warehouseId' | 'warehouseCode' | 'warehouseName' | 'status' | 'locationEnabled'
>
export type LocationReference = Pick<
  Location,
  'locationId' | 'locationCode' | 'locationName' | 'warehouseId' | 'status'
>
export type WarehouseReferenceQuery = WarehouseQuery
export type LocationReferenceQuery = LocationQuery

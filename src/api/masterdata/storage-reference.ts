import request from '@/utils/request'
import type { ApiResponse, PageResult } from '@/types/api/common'
import type {
  WarehouseReference,
  LocationReference,
  WarehouseReferenceQuery,
  LocationReferenceQuery
} from '@/types/api/masterdata/storage-reference'
export function searchWarehouseReferences(
  params: WarehouseReferenceQuery
): Promise<ApiResponse<PageResult<WarehouseReference>>> {
  return request({ url: '/masterdata/reference/warehouses', method: 'get', params })
}
export function resolveWarehouseReferences(ids: number[]): Promise<ApiResponse<WarehouseReference[]>> {
  return request({ url: '/masterdata/reference/warehouses/resolve', method: 'get', params: { ids: ids.join(',') } })
}
export function searchLocationReferences(
  params: LocationReferenceQuery
): Promise<ApiResponse<PageResult<LocationReference>>> {
  return request({ url: '/masterdata/reference/locations', method: 'get', params })
}
export function resolveLocationReferences(
  warehouseId: number,
  ids: number[]
): Promise<ApiResponse<LocationReference[]>> {
  return request({
    url: '/masterdata/reference/locations/resolve',
    method: 'get',
    params: { warehouseId, ids: ids.join(',') }
  })
}
export function getLocationWarehouseContext(warehouseId: number): Promise<ApiResponse<WarehouseReference>> {
  return request({ url: '/masterdata/location/warehouse-context', method: 'get', params: { warehouseId } })
}

import request from '@/utils/request'
import type { ApiResponse, PageResult } from '@/types/api/common'
import type {
  Arrival,
  ArrivalDefaults,
  ArrivalQuery,
  ArrivalAction,
  SaveArrivalRequest,
  OrderLineReference,
  OrderLineReferenceQuery
} from '@/types/api/purchase/arrival'

const base = '/purchase/arrival'
/** 分页查询已保存的到货单。 */
export function listArrivals(params: ArrivalQuery): Promise<ApiResponse<PageResult<Arrival>>> {
  return request({ url: `${base}/list`, method: 'get', params })
}
/** 返回保存快照及来源行的当前执行数量。 */
export function getArrival(id: number): Promise<ApiResponse<Arrival>> {
  return request({ url: `${base}/${id}`, method: 'get' })
}
/** 获取当前收货经办人及部门。 */
export function getArrivalDefaults(): Promise<ApiResponse<ArrivalDefaults>> {
  return request({ url: `${base}/defaults`, method: 'get' })
}
/** 新增不占订单额度的整单草稿。 */
export function createArrival(data: SaveArrivalRequest): Promise<ApiResponse<Arrival>> {
  return request({ url: base, method: 'post', data })
}
/** 按旧版本更新草稿。 */
export function updateArrival(data: SaveArrivalRequest): Promise<ApiResponse<Arrival>> {
  return request({ url: base, method: 'put', data })
}
/** 仅草稿支持逻辑删除。 */
export function deleteArrival(id: number, version: number): Promise<ApiResponse<null>> {
  return request({ url: `${base}/${id}`, method: 'delete', params: { version } })
}
/** 执行独立授权的状态命令，累计数量只由服务端维护。 */
export function actOnArrival(
  id: number,
  action: ArrivalAction,
  version: number,
  reason = ''
): Promise<ApiResponse<Arrival>> {
  return request({ url: `${base}/${id}/${action}`, method: 'post', data: { version, reason } })
}
/** 独立参照权限下分页选择已审核且仍有可用额度的订单行。 */
export function searchOrderLineReferences(
  params: OrderLineReferenceQuery
): Promise<ApiResponse<PageResult<OrderLineReference>>> {
  return request({ url: '/purchase/order/reference-lines', method: 'get', params })
}
/** 确认选择前复核，每次最多一百行。 */
export function resolveOrderLineReferences(ids: number[]): Promise<ApiResponse<OrderLineReference[]>> {
  return request({ url: '/purchase/order/reference-lines/resolve', method: 'get', params: { ids: ids.join(',') } })
}

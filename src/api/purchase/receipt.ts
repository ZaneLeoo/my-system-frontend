import request from '@/utils/request'
import type { ApiResponse, PageResult } from '@/types/api/common'
import type {
  Receipt,
  ReceiptDefaults,
  ReceiptQuery,
  ReceiptAction,
  SaveReceiptRequest,
  ArrivalLineReference,
  ArrivalLineReferenceQuery
} from '@/types/api/purchase/receipt'

const base = '/purchase/receipt'
/** 分页查询已保存的入库单。 */
export function listReceipts(params: ReceiptQuery): Promise<ApiResponse<PageResult<Receipt>>> {
  return request({ url: `${base}/list`, method: 'get', params })
}
/** 返回保存快照及来源行的当前执行数量。 */
export function getReceipt(id: number): Promise<ApiResponse<Receipt>> {
  return request({ url: `${base}/${id}`, method: 'get' })
}
/** 获取当前收货经办人及部门。 */
export function getReceiptDefaults(): Promise<ApiResponse<ReceiptDefaults>> {
  return request({ url: `${base}/defaults`, method: 'get' })
}
/** 新增不占订单额度的整单草稿。 */
export function createReceipt(data: SaveReceiptRequest): Promise<ApiResponse<Receipt>> {
  return request({ url: base, method: 'post', data })
}
/** 按旧版本更新草稿。 */
export function updateReceipt(data: SaveReceiptRequest): Promise<ApiResponse<Receipt>> {
  return request({ url: base, method: 'put', data })
}
/** 仅草稿支持逻辑删除。 */
export function deleteReceipt(id: number, version: number): Promise<ApiResponse<null>> {
  return request({ url: `${base}/${id}`, method: 'delete', params: { version } })
}
/** 执行独立授权的状态命令，累计数量只由服务端维护。 */
export function actOnReceipt(
  id: number,
  action: ReceiptAction,
  version: number,
  reason = ''
): Promise<ApiResponse<Receipt>> {
  return request({ url: `${base}/${id}/${action}`, method: 'post', data: { version, reason } })
}
/** 独立参照权限下分页选择已审核且仍有可用额度的订单行。 */
export function searchArrivalLineReferences(
  params: ArrivalLineReferenceQuery
): Promise<ApiResponse<PageResult<ArrivalLineReference>>> {
  return request({ url: '/purchase/arrival/reference-lines', method: 'get', params })
}
/** 确认选择前复核，每次最多一百行。 */
export function resolveArrivalLineReferences(ids: number[]): Promise<ApiResponse<ArrivalLineReference[]>> {
  return request({ url: '/purchase/arrival/reference-lines/resolve', method: 'get', params: { ids: ids.join(',') } })
}

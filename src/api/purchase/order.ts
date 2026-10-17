import request from '@/utils/request'
import type { ApiResponse, PageResult } from '@/types/api/common'
import type {
  Order,
  OrderDefaults,
  OrderQuery,
  OrderCalculation,
  CalculationRequest,
  SaveOrderRequest,
  OrderAction
} from '@/types/api/purchase/order'

const base = '/purchase/order'
/** 按全部匹配数据分页、筛选及排序。 */
export function listOrders(params: OrderQuery): Promise<ApiResponse<PageResult<Order>>> {
  return request({ url: `${base}/list`, method: 'get', params })
}
/** 获取整单保存快照。 */
export function getOrder(id: number): Promise<ApiResponse<Order>> {
  return request({ url: `${base}/${id}`, method: 'get' })
}
/** 获取新单归属与当前精度默认值。 */
export function getOrderDefaults(): Promise<ApiResponse<OrderDefaults>> {
  return request({ url: `${base}/defaults`, method: 'get' })
}
/** 十进制字符串试算；同内容试算允许重试，不适用写入防重。 */
export function calculateOrder(data: CalculationRequest): Promise<ApiResponse<OrderCalculation>> {
  return request({ url: `${base}/calculate`, method: 'post', data, headers: { repeatSubmit: false } })
}
/** 新增草稿并返回正式单号与金额。 */
export function createOrder(data: SaveOrderRequest): Promise<ApiResponse<Order>> {
  return request({ url: base, method: 'post', data })
}
/** 按整单版本修改草稿。 */
export function updateOrder(data: SaveOrderRequest): Promise<ApiResponse<Order>> {
  return request({ url: base, method: 'put', data })
}
/** 删除当前版本草稿。 */
export function deleteOrder(id: number, version: number): Promise<ApiResponse<null>> {
  return request({ url: `${base}/${id}`, method: 'delete', params: { version } })
}
/** 执行有独立权限的状态命令。 */
export function actOnOrder(id: number, action: OrderAction, version: number, reason = ''): Promise<ApiResponse<Order>> {
  return request({ url: `${base}/${id}/${action}`, method: 'post', data: { version, reason } })
}

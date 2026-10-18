import request from '@/utils/request'
import type { ApiResponse, PageResult } from '@/types/api/common'
import type { InventoryQuery, Balance, InventoryTransaction } from '@/types/api/inventory'
/** 当前库存查询，不依赖档案维护权限。 */
export function listBalances(params: InventoryQuery): Promise<ApiResponse<PageResult<Balance>>> {
  return request({ url: '/inventory/balance/list', method: 'get', params })
}
/** 库存流水查询，包含原始入库和追加冲销。 */
export function listInventoryTransactions(
  params: InventoryQuery
): Promise<ApiResponse<PageResult<InventoryTransaction>>> {
  return request({ url: '/inventory/transaction/list', method: 'get', params })
}

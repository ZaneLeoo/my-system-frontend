import type { Router } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import auth from '@/plugins/auth'
import { signingAvailability } from '@/api/signing'

/** 宿主业务的返回路径集中登记，签署页面不导入具体单据 API。 */
const sourceRoutes: Record<string, (id: string) => string> = {
  'purchase.order': (id) => `/purchase/order-document/${encodeURIComponent(id)}/detail`
}

export function signingSourceRoute(businessType: string, businessId: string): string | null {
  if (!businessId) return null
  return sourceRoutes[businessType]?.(businessId) ?? null
}

/** 所有发起入口先校验占用；可复用草稿、进行中任务和完成结果。 */
export async function beginBusinessSigning(router: Router, businessType: string, businessId: string) {
  const { data } = await signingAvailability(businessType, businessId)
  if (data.available) {
    await router.push({ path: '/signing/task/create', query: { businessType, businessId } })
    return
  }
  if (!data.taskId || !data.status) {
    ElMessage.warning('来源单据已有签署任务，请刷新签署记录')
    return
  }
  if (!auth.hasPermi('signing:task:query')) {
    ElMessage.warning('当前账号没有查看签署详情的权限，请联系管理员')
    return
  }
  const message =
    data.status === 'COMPLETED'
      ? '该单据已完成电子签署，不能重复发起。是否查看签署结果？'
      : data.status === 'DRAFT'
        ? '该单据已有签署草稿，是否打开并继续处理？'
        : '该单据已有有效签署任务，是否查看当前进度？'
  try {
    await ElMessageBox.confirm(message, '已有电子签署任务', {
      confirmButtonText: '打开已有任务',
      cancelButtonText: '暂不查看',
      type: 'info'
    })
  } catch {
    return
  }
  await router.push(`/signing/task/${data.taskId}`)
}

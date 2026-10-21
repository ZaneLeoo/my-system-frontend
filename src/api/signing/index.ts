import request from '@/utils/request'
import type { ApiResponse, PageResult } from '@/types/api/common'
import type {
  SigningTask,
  SigningAvailability,
  SigningDetail,
  SigningParty,
  SigningSettings,
  SigningSealType,
  SigningSealPage,
  TemplateBinding,
  TemplateControl,
  SigningField,
  SigningScenario,
  SigningSource,
  SigningTaskSummary,
  SigningStatus
} from '@/types/api/signing'
const tasks = '/signing/tasks'
const templates = '/signing/templates'
/** 已登记业务场景；模板权限不会授予来源访问权限。 */
export function signingScenarios(): Promise<ApiResponse<SigningScenario[]>> {
  return request({ url: '/signing/businesses' })
}
/** 由业务适配器筛选有权读取且满足发起资格的单据。 */
export function signingSources(
  businessType: string,
  params: { pageNum: number; pageSize: number; keyword?: string }
): Promise<ApiResponse<PageResult<SigningSource>>> {
  return request({ url: `/signing/businesses/${encodeURIComponent(businessType)}/sources`, params })
}
/** 独立任务工作台，后端按来源访问权限限定查询范围。 */
export function signingTasks(params: {
  pageNum: number
  pageSize: number
  businessType?: string
  status?: SigningStatus
}): Promise<ApiResponse<PageResult<SigningTaskSummary>>> {
  return request({ url: `${tasks}/list`, params })
}
/** 获取集成状态，不包含应用密钥。 */
export function signingSettings(): Promise<ApiResponse<SigningSettings>> {
  return request({ url: `${tasks}/settings` })
}
/** 查看单据签署历史。 */
export function signingHistory(businessType: string, businessId: string): Promise<ApiResponse<SigningTask[]>> {
  return request({ url: tasks, params: { businessType, businessId } })
}
/** 创建草稿前检查来源单据是否已有占用签署名额的任务。 */
export function signingAvailability(
  businessType: string,
  businessId: string
): Promise<ApiResponse<SigningAvailability>> {
  return request({ url: `${tasks}/availability`, params: { businessType, businessId } })
}
/** 最新整项详情。 */
export function signingDetail(id: string): Promise<ApiResponse<SigningDetail>> {
  return request({ url: `${tasks}/${id}` })
}
/** 创建唯一有效草稿。 */
export function createSigning(data: {
  businessType: string
  businessId: string
  source: string
  bindingId?: string
}): Promise<ApiResponse<SigningTask>> {
  return request({ url: tasks, method: 'post', data })
}
/** 上传完整合同；文件内容不进入若依重复提交缓存。 */
export function uploadSigningFile(id: string, version: number, file: File): Promise<ApiResponse<SigningTask>> {
  const data = new FormData()
  data.append('file', file)
  data.append('version', String(version))
  return request({
    url: `${tasks}/${id}/file`,
    method: 'post',
    data,
    headers: { 'Content-Type': 'multipart/form-data', repeatSubmit: false },
    timeout: 30000
  })
}
/** 按版本执行受控命令。 */
export function signingAction(
  id: string,
  action: 'prepare' | 'sync' | 'revoke' | 'reconcile' | 'cancel',
  version: number,
  reason = '',
  flowId = ''
): Promise<ApiResponse<SigningTask>> {
  return request({ url: `${tasks}/${id}/${action}`, method: 'post', data: { version, reason, flowId } })
}
/** 将页面的签署方式、选章与发起动作一并提交。 */
export function startSigning(
  id: string,
  data: { version: number; autoSign: boolean; sealId: string | null }
): Promise<ApiResponse<SigningTask>> {
  return request({ url: `${tasks}/${id}/start`, method: 'post', data, timeout: 60000 })
}
/** 读取当前任务所属我方企业的内部印章，每页最多 20 枚。 */
export function signingSeals(
  id: string,
  params: { pageNum: number; pageSize: number; sealType?: SigningSealType }
): Promise<ApiResponse<SigningSealPage>> {
  return request({ url: `${tasks}/${id}/seals`, params, timeout: 60000 })
}
/** 鉴权读取带水印的印章预览图，不向浏览器传递平台临时链接。 */
export async function signingSealPreview(id: string, sealId: string): Promise<Blob> {
  const blob: Blob = await request({
    url: `${tasks}/${id}/seals/${encodeURIComponent(sealId)}/preview`,
    responseType: 'blob',
    timeout: 60000
  })
  if (!['image/png', 'image/jpeg'].includes(blob.type.split(';')[0] ?? '')) {
    let message = '印章图片加载失败'
    try {
      const result: { msg?: string; message?: string } = JSON.parse(await blob.text())
      message = result.msg || result.message || message
    } catch {
      // 非图片、非 JSON 响应不作为预览图片。
    }
    throw new Error(message)
  }
  return blob
}
/** 保存身份或确认最终文件位置。 */
export function saveSigningParties(
  id: string,
  version: number,
  parties: SigningParty[],
  confirmPositions: boolean
): Promise<ApiResponse<SigningTask>> {
  return request({
    url: `${tasks}/${id}/participants`,
    method: 'put',
    data: { version, parties, confirmPositions },
    headers: { repeatSubmit: false }
  })
}
/** 获取官方拖章页面，回填通过受验签回调完成。 */
export function signingPositionUrl(
  id: string,
  version: number
): Promise<ApiResponse<{ url: string; task: SigningTask }>> {
  return request({ url: `${tasks}/${id}/position-url`, method: 'post', data: { version }, timeout: 40000 })
}
/** 鉴权文件读取，禁止直接拼接公开上传地址。 */
export async function signingFile(id: string, documentId: string): Promise<{ blob: Blob; fileName: string | null }> {
  const config = {
    url: `${tasks}/${id}/documents/${documentId}`,
    params: { inline: true },
    responseType: 'blob',
    rawResponse: true
  } as Parameters<typeof request>[0] & { rawResponse: true }
  const response = (await request(config)) as {
    data: Blob
    headers: Record<string, string | undefined>
  }
  const disposition = response.headers['content-disposition']
  return { blob: response.data, fileName: getFileNameFromDisposition(disposition) }
}
/** 从响应头读取中文文件名，兼容 RFC 5987 编码格式。 */
function getFileNameFromDisposition(value: string | undefined): string | null {
  if (!value) {
    return null
  }
  const encodedName = value.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  if (encodedName) {
    try {
      return decodeURIComponent(encodedName.replace(/^"|"$/g, ''))
    } catch {
      return null
    }
  }
  const plainName = value.match(/filename="?([^";]+)"?/i)?.[1]
  return plainName ?? null
}
/** 业务场景本地绑定。 */
export function signingBindings(businessType: string): Promise<ApiResponse<TemplateBinding[]>> {
  return request({ url: `${templates}/bindings`, params: { businessType } })
}
/** 查询当前应用平台模板，每页 20 条。 */
export function platformTemplates(page: number): Promise<ApiResponse<Record<string, unknown>>> {
  return request({ url: `${templates}/platform`, params: { page }, timeout: 40000 })
}
/** 读取平台控件。 */
export function templateControls(id: string): Promise<ApiResponse<TemplateControl[]>> {
  return request({ url: `${templates}/${encodeURIComponent(id)}/controls`, timeout: 40000 })
}
/** 中文业务字段目录。 */
export function signingFields(businessType: string): Promise<ApiResponse<SigningField[]>> {
  return request({ url: `${templates}/fields`, params: { businessType } })
}
/** 按控件及版本校验保存。 */
export function saveSigningBinding(data: TemplateBinding): Promise<ApiResponse<TemplateBinding>> {
  return request({ url: `${templates}/bindings`, method: 'put', data, timeout: 40000 })
}
/** 打开官方模板编辑器。 */
export function templateEditorUrl(id: string): Promise<ApiResponse<string>> {
  return request({ url: `${templates}/${encodeURIComponent(id)}/edit-url`, method: 'post', timeout: 40000 })
}
/** 真实业务快照试填，不产生签署流程。 */
export function previewSigningBinding(id: string, businessId: string): Promise<Blob> {
  return request({
    url: `${templates}/bindings/${id}/preview`,
    params: { businessId },
    method: 'post',
    responseType: 'blob',
    timeout: 90000
  })
}

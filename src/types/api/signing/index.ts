/** 与公共签署模块一致的状态。 */
export type SigningStatus = 'DRAFT' | 'SIGNING' | 'COMPLETED' | 'REVOKED' | 'EXPIRED' | 'REJECTED'
export type OperationStatus = 'IDLE' | 'QUEUED' | 'RUNNING' | 'FAILED' | 'UNKNOWN'
export interface SigningTask {
  id: string
  businessType: string
  businessId: string
  title: string
  providerEnvironment: string
  source: 'UPLOAD' | 'TEMPLATE'
  bindingId: string | null
  flowId: string | null
  status: SigningStatus
  operationStatus: OperationStatus
  documentStatus: 'EMPTY' | 'PREPARING' | 'READY' | 'FAILED'
  archiveStatus: 'NONE' | 'PENDING' | 'READY' | 'FAILED'
  activeDocumentId: string | null
  positionDocumentHash: string | null
  version: number
  snapshot: Record<string, unknown>
  createBy: string
  createTime: string
  updateBy: string
  updateTime: string
  lastError: string | null
}
export interface SigningAvailability {
  available: boolean
  taskId: string | null
  status: SigningStatus | null
}
export interface SigningPosition {
  page: number
  x: number
  y: number
}
export type SigningPartyType = 'ORGANIZATION' | 'PERSON'
export interface SigningParty {
  id?: string
  taskId?: string
  role: 'OUR' | 'COUNTERPARTY'
  partyType: SigningPartyType
  organizationId?: string
  organizationName: string
  transactorName: string
  transactorAccount: string
  localUserId?: number
  autoSign: boolean
  sealId?: string | null
  sealName?: string | null
  sealType?: SigningSealType | null
  signOrder: number
  positions: SigningPosition[]
  status?: string
}
export interface SigningDocument {
  id: string
  kind: 'SOURCE' | 'PREPARED' | 'SIGNED'
  fileName: string
  sha256: string | null
  size: number
}
export interface SigningEvent {
  id: string
  kind: string
  actor: string
  createTime?: string
}
export interface SigningDetail {
  task: SigningTask
  documents: SigningDocument[]
  parties: SigningParty[]
  /** 业务适配器从保存的单据快照提供，仅在尚未保存签署方时使用。 */
  defaultCounterparty: SigningParty | null
  events: SigningEvent[]
}
export interface SigningScenario {
  businessType: string
  name: string
  accessible: boolean
}
export interface SigningSource {
  id: string
  number: string
  title: string
  businessDate: string
  counterpartyName: string
}
export interface SigningTaskSummary {
  id: string
  businessType: string
  businessName: string
  businessId: string
  title: string
  status: SigningStatus
  createBy: string
  createTime: string
  updateTime: string
}
export interface SigningSettings {
  enabled: boolean
  configured: boolean
  environment: string
  organizationName: string
  currentUserId: number
  currentUserName: string
  currentUserAccount: string
}
export interface SigningField {
  key: string
  label: string
  type: string
  columns: SigningField[]
}

export type SigningSealType = 'PUBLIC' | 'CONTRACT' | 'FINANCE' | 'PERSONNEL' | 'OTHER' | 'UNSUPPORTED'
export type SigningSealStatus = 'ENABLED' | 'PENDING' | 'REJECTED' | 'DISABLED' | 'REVOKED' | 'UNKNOWN'
/** 后端归一化的我方印章信息，不包含平台临时下载 URL。 */
export interface SigningSeal {
  id: string
  name: string
  organizationId: string | null
  organizationName: string
  type: SigningSealType
  status: SigningSealStatus
  statusDescription: string
  defaultSeal: boolean
  width: number | null
  height: number | null
  selectable: boolean
  previewAvailable: boolean
}
export interface SigningSealPage {
  rows: SigningSeal[]
  total: number
}
/** 仅保存在发起页面中的未提交设置。 */
export interface SigningLaunchOptions {
  autoSign: boolean
  seal: SigningSeal | null
}
export const signingSealTypeLabels: Record<SigningSealType, string> = {
  PUBLIC: '企业公章',
  CONTRACT: '合同专用章',
  FINANCE: '财务专用章',
  PERSONNEL: '人事专用章',
  OTHER: '其他机构章',
  UNSUPPORTED: '不支持的印章'
}
export const signingSealStatusLabels: Record<SigningSealStatus, string> = {
  ENABLED: '已启用',
  PENDING: '待审核',
  REJECTED: '审核不通过',
  DISABLED: '已停用',
  REVOKED: '已吊销',
  UNKNOWN: '待平台校验'
}
export interface TemplateMapping {
  componentId: string
  componentType: string
  fieldKey: string
  columns: Record<string, string>
}
export interface TemplateBinding {
  id?: string
  businessType: string
  name: string
  templateId: string
  enabled: boolean
  version: number
  mappings: TemplateMapping[]
}
export interface TemplateControl {
  componentId: string
  componentType?: string | number
  type?: string | number
  componentName?: string
  componentKey?: string
  componentLabel?: string
  [key: string]: unknown
}
export const signingStatusLabels: Record<SigningStatus, string> = {
  DRAFT: '草稿',
  SIGNING: '签署中',
  COMPLETED: '已完成',
  REVOKED: '已撤销',
  EXPIRED: '已过期',
  REJECTED: '已拒签'
}
export const operationLabels: Record<OperationStatus, string> = {
  IDLE: '就绪',
  QUEUED: '处理中',
  RUNNING: '处理中',
  FAILED: '操作失败',
  UNKNOWN: '结果待核对'
}

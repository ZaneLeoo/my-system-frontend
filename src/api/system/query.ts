import request from '@/utils/request'
import type { ApiResponse, PageResult } from '@/types/api/common'
import type {
  MetadataTable,
  MetadataColumn,
  QueryMetadata,
  QueryOption,
  QueryDefinition,
  DefinitionDetail,
  DraftField,
  SearchRequest,
  QueryRelease,
  SyncPreview
} from '@/types/api/system/query'
const base = '/query'
export function getQueryMetadata(key: string): Promise<ApiResponse<QueryMetadata>> {
  return request({ url: `${base}/runtime/${key}/metadata` })
}
export function getQueryOptions(
  key: string,
  field: string,
  keyword = '',
  page = 1,
  ids?: number[],
  previewDefinitionId?: number
): Promise<ApiResponse<PageResult<QueryOption>>> {
  const url = previewDefinitionId
    ? `${base}/definitions/${previewDefinitionId}/options/${field}`
    : `${base}/runtime/${key}/options/${field}${ids ? '/resolve' : ''}`
  return request({ url, params: ids ? { ids: ids.join(',') } : { keyword, page } })
}

export function searchBusiness<T>(path: string, data: SearchRequest): Promise<ApiResponse<PageResult<T>>> {
  return request({ url: path, method: 'post', data, timeout: 15000, headers: { repeatSubmit: false } })
}
export function getMetadataTables(): Promise<ApiResponse<MetadataTable[]>> {
  return request({ url: `${base}/metadata/tables` })
}
export function getMetadataCandidates(): Promise<ApiResponse<{ tableName: string; tableComment: string }[]>> {
  return request({ url: `${base}/metadata/candidates` })
}
export function importMetadataTable(tableName: string): Promise<ApiResponse<MetadataTable>> {
  return request({ url: `${base}/metadata/tables/import`, method: 'post', params: { tableName } })
}
export function getMetadataColumns(id: number): Promise<ApiResponse<MetadataColumn[]>> {
  return request({ url: `${base}/metadata/tables/${id}/columns` })
}
export function previewMetadataSync(id: number): Promise<ApiResponse<SyncPreview>> {
  return request({ url: `${base}/metadata/tables/${id}/sync-preview` })
}
export function applyMetadataSync(id: number, version: number, signature: string): Promise<ApiResponse<MetadataTable>> {
  return request({ url: `${base}/metadata/tables/${id}/sync`, method: 'post', params: { version, signature } })
}
export function renameMetadata(
  id: number,
  version: number,
  label: string,
  columnId?: number
): Promise<ApiResponse<null>> {
  return request({ url: `${base}/metadata/tables/${id}/label`, method: 'put', params: { version, label, columnId } })
}
export function getQueryDefinitions(): Promise<ApiResponse<QueryDefinition[]>> {
  return request({ url: `${base}/definitions` })
}
export function getQueryDefinition(id: number): Promise<ApiResponse<DefinitionDetail>> {
  return request({ url: `${base}/definitions/${id}` })
}
export function saveQueryDefinition(
  id: number,
  version: number,
  displayName: string,
  enabled: boolean,
  fields: DraftField[]
): Promise<ApiResponse<QueryDefinition>> {
  return request({ url: `${base}/definitions/${id}`, method: 'put', data: { version, displayName, enabled, fields } })
}
export function publishQueryDefinition(id: number, version: number): Promise<ApiResponse<QueryRelease>> {
  return request({ url: `${base}/definitions/${id}/publish`, method: 'post', params: { version } })
}
export function getQueryReleases(id: number): Promise<ApiResponse<QueryRelease[]>> {
  return request({ url: `${base}/definitions/${id}/releases` })
}
export function previewQuery(
  id: number,
  data: SearchRequest
): Promise<ApiResponse<{ metadata: QueryMetadata; result: PageResult<Record<string, unknown>> }>> {
  return request({
    url: `${base}/definitions/${id}/preview`,
    method: 'post',
    data,
    timeout: 15000,
    headers: { repeatSubmit: false }
  })
}

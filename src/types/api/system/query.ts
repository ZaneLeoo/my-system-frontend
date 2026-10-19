export type QueryScalar = string | number | boolean
export type QueryValue = QueryScalar | QueryScalar[]
export interface QueryNode {
  type: 'condition' | 'group' | 'relation'
  logic?: 'AND' | 'OR'
  field?: string
  op?: string
  value?: QueryValue
  value2?: QueryScalar
  relation?: string
  mode?: 'EXISTS' | 'NOT_EXISTS'
  children?: QueryNode[]
}
export interface QueryFieldSpec {
  fieldKey: string
  sourceKey: string
  label: string
  dataType: 'STRING' | 'INTEGER' | 'DECIMAL' | 'BOOLEAN' | 'DATE' | 'DATETIME'
  component: 'TEXT' | 'NUMBER' | 'DATE' | 'DATETIME' | 'SELECT' | 'REFERENCE'
  operators: string[]
  defaultOperator: string
  optionProvider: string
  commonVisible: boolean
  displayOrder: number
  sortable: boolean
  nullable: boolean
  maxLength?: number
  numericScale?: number
}
export interface QueryMetadata {
  queryKey: string
  displayName: string
  configVersion: number
  fields: QueryFieldSpec[]
  relations: Record<string, string>
}
export interface SearchRequest {
  pageNum: number
  pageSize: number
  configVersion: number
  sortField?: string
  sortDirection?: 'asc' | 'desc'
  filter?: QueryNode
}
export interface QuerySelection {
  values: Record<string, QueryValue>
  advanced?: QueryNode
}
export interface QueryExtras {
  values?: Record<string, QueryValue>
  advanced?: QueryNode
}
export interface QueryOption {
  value: QueryScalar
  label: string
  parentId?: number
}
export interface MetadataTable {
  tableId: number
  tableName: string
  tableComment: string
  displayName: string
  available: boolean
  version: number
  synchronizedTime: string
}
export interface QueryDefinitionLink {
  tableId: number
  definitionId: number
  displayName: string
  sourceLabel: string
}
export interface MetadataColumn {
  columnId: number
  tableId: number
  columnName: string
  columnComment: string
  displayName: string
  dataType: string
  columnType: string
  nullable: boolean
  available: boolean
  maxLength?: number
  numericScale?: number
}
export interface QueryDefinition {
  definitionId: number
  queryKey: string
  displayName: string
  adapterKey: string
  draftVersion: number
  publishedRevision: number
  enabled: boolean
}
export interface DraftField {
  fieldId?: number
  fieldKey: string
  sourceKey: string
  columnId?: number
  label: string
  component: string
  operatorsJson: string
  defaultOperator: string
  optionProvider: string
  commonVisible: boolean
  displayOrder: number
  sortable: boolean
  enabled: boolean
}
export interface QuerySource {
  optionProviders?: Record<string, string>
  key: string
  label: string
  columns: MetadataColumn[]
}
export interface DefinitionDetail {
  definition: QueryDefinition
  fields: DraftField[]
  sources: QuerySource[]
  providers: string[]
}
export interface QueryRelease {
  releaseId: number
  revision: number
  configSnapshot: string
  structureSignature: string
  createBy: string
  createTime: string
}
export interface SyncPreview {
  version: number
  signature: string
  added: MetadataColumn[]
  changed: MetadataColumn[]
  removed: MetadataColumn[]
  references: { queryKey: string; displayName: string }[]
}

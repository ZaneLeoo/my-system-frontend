import { computed, shallowRef, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { getQueryMetadata } from '@/api/system/query'
import type { QueryMetadata, QueryNode, QueryValue, QueryExtras, SearchRequest } from '@/types/api/system/query'
export const queryOptionLabels = reactive(new Map<string, string>())
export const operatorLabels: Record<string, string> = {
  eq: '等于',
  ne: '不等于',
  like: '包含',
  startsWith: '开头是',
  endsWith: '结尾是',
  gt: '大于',
  ge: '大于等于',
  lt: '小于',
  le: '小于等于',
  between: '介于',
  in: '属于',
  notIn: '不属于',
  isNull: '为空值',
  isNotNull: '非空值',
  isEmpty: '为空文本',
  isNotEmpty: '非空文本',
  descendantOf: '属于分类及下级'
}
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
export function isFilled(value: unknown): value is QueryValue {
  return (
    value !== undefined &&
    value !== null &&
    (typeof value !== 'string' || value.trim() !== '') &&
    (!Array.isArray(value) || value.length > 0)
  )
}
export function basicFilter(metadata: QueryMetadata, values: Record<string, unknown>): QueryNode[] {
  return metadata.fields
    .filter(
      (f) =>
        f.sourceKey === 'main' &&
        isFilled(values[f.fieldKey]) &&
        (!['isNull', 'isNotNull', 'isEmpty', 'isNotEmpty'].includes(f.defaultOperator) || values[f.fieldKey] === true)
    )
    .map((f) => {
      const value = values[f.fieldKey] as QueryValue
      const node: QueryNode = { type: 'condition', field: f.fieldKey, op: f.defaultOperator, value }
      if (['isNull', 'isNotNull', 'isEmpty', 'isNotEmpty'].includes(node.op || '')) delete node.value
      if (['in', 'notIn'].includes(node.op || '') && !Array.isArray(value)) node.value = [value]
      if (node.op === 'between' && Array.isArray(value)) {
        node.value = value[0]
        node.value2 = value[1]
      }
      return node
    })
}
export function buildRequest(
  metadata: QueryMetadata,
  page: { pageNum: number; pageSize: number; sortField?: string; sortDirection?: 'asc' | 'desc' },
  values: Record<string, unknown>,
  advanced?: QueryNode
): SearchRequest {
  const names = new Set(metadata.fields.map((field) => field.fieldKey))
  function invalid() {
    const message = '查询配置已变化，存在失效条件，请明确修改或重置后重试'
    ElMessage.warning(message)
    throw new Error(message)
  }
  for (const [key, value] of Object.entries(values)) if (isFilled(value) && !names.has(key)) invalid()
  function check(node: QueryNode) {
    if (node.type === 'condition') {
      const field = metadata.fields.find((f) => f.fieldKey === node.field)
      if (!field || !field.operators.includes(node.op || '')) invalid()
    } else {
      if (node.type === 'relation' && !metadata.relations[node.relation || '']) invalid()
      node.children?.forEach(check)
    }
  }
  if (advanced) check(advanced)
  const children = basicFilter(metadata, values)
  if (advanced?.children?.length) children.push(advanced)
  return {
    pageNum: page.pageNum,
    pageSize: page.pageSize,
    sortField: page.sortField,
    sortDirection: page.sortDirection,
    configVersion: metadata.configVersion,
    filter: { type: 'group', logic: 'AND', children }
  }
}
export function useQueryDefinition(key: string) {
  const metadata = shallowRef<QueryMetadata>()
  let pending: Promise<QueryMetadata> | undefined
  async function ensure(force = false) {
    if (!force && metadata.value) return metadata.value
    if (!pending)
      pending = getQueryMetadata(key)
        .then(({ data }) => {
          data.fields.sort((a, b) => a.displayOrder - b.displayOrder)
          metadata.value = data
          return data
        })
        .finally(() => {
          pending = undefined
        })
    return pending
  }
  const available = computed(() => new Set(metadata.value?.fields.map((f) => f.fieldKey)))
  function values(source: object & QueryExtras, keys: readonly string[]) {
    const result: Record<string, unknown> = { ...source.values }
    const indexed = source as Record<string, unknown>
    for (const field of keys) {
      if (isFilled(indexed[field])) result[field] = indexed[field]
    }
    return result
  }
  function extras(values: Record<string, QueryValue>, keys: readonly string[]) {
    return Object.fromEntries(Object.entries(values).filter(([key]) => !keys.includes(key)))
  }
  return {
    metadata,
    ensure,
    available,
    values,
    extras,
    canColumnFilter: (key: string) => {
      const f = metadata.value?.fields.find((f) => f.fieldKey === key)
      return Boolean(f && !['isNull', 'isNotNull', 'isEmpty', 'isNotEmpty', 'between'].includes(f.defaultOperator))
    },
    canSort: (key: string) => Boolean(metadata.value?.fields.find((f) => f.fieldKey === key)?.sortable)
  }
}

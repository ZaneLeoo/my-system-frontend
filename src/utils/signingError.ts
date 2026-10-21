/** 展示原始错误说明，不按平台错误码猜测或替换业务原因。 */
export function getSigningErrorMessage(value?: unknown): string {
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.message
  return ''
}

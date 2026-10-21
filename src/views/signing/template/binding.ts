import type { TemplateBinding } from '@/types/api/signing'

/** 复制映射及嵌套列配置，支持响应式表单并隔离编辑值与已保存列表。 */
export function copyTemplateBinding(binding: TemplateBinding): TemplateBinding {
  return {
    ...binding,
    mappings: binding.mappings.map((mapping) => ({
      ...mapping,
      columns: { ...mapping.columns }
    }))
  }
}

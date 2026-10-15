/** 新业务统一响应，失败由请求拦截器处理。 */
export interface ApiResponse<T> {
  code: number
  msg: string
  data: T
}

/** 新业务分页结果，不重复包装状态码。 */
export interface PageResult<T> {
  rows: T[]
  total: number
}

/** 新业务受控分页参数。 */
export interface PageQuery {
  pageNum: number
  pageSize: number
}

/** 与后端公共 EnableStatus 编码一致。 */
export const EnableStatus = { Enabled: '0', Disabled: '1' } as const
export type EnableStatusCode = (typeof EnableStatus)[keyof typeof EnableStatus]

/** API 通用响应类型 */
export interface AjaxResult<T = any> {
  /** 状态码 */
  code: number
  /** 返回内容 */
  msg: string
  /** 数据对象 */
  data?: T
}

/** API 表格响应类型 */
export interface TableDataInfo<T = any> {
  /** 状态码 */
  code: number
  /** 返回内容 */
  msg: string
  /** 总记录数 */
  total: number
  /** 列表数据 */
  rows: T[]
}

/** 分页参数类型 */
export interface PageDomain {
  /** 当前记录起始索引 */
  pageNum?: number
  /** 每页显示记录数 */
  pageSize?: number
  /** 排序列 */
  orderByColumn?: string
  /** 排序的方向desc或者asc */
  isAsc?: string
  /** 分页参数合理化 */
  reasonable?: boolean
}

/** Entity基类 */
export interface BaseEntity {
  /** 搜索值 */
  searchValue?: string
  /** 创建者 */
  createBy?: string
  /** 创建时间 */
  createTime?: string
  /** 更新者 */
  updateBy?: string
  /** 更新时间 */
  updateTime?: string
  /** 备注 */
  remark?: string
  /** 请求参数 */
  params?: Record<string, any>
}

/** Treeselect树结构类型 */
export interface TreeSelect {
  /** 节点ID */
  id?: number
  /** 节点名称 */
  label?: string
  /** 节点禁用 */
  disabled: boolean
  /** 子节点 */
  children: TreeSelect[]
}

/** 显隐列信息 */
export interface TableShowColumns {
  // 显示名称
  label: string
  // 是否显示
  visible: boolean
}

/** 文件上传响应数据 */
export interface UploadFileResult extends AjaxResult {
  /** 文件名称（包含路径） */
  fileName: string
  /** 文件名称（不含路径） */
  newFileName: string
  /** 完整URL地址 */
  url: string
  /** 原始文件名称 */
  originalFilename: string
}

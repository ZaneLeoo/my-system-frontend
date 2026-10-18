# 基础档案参照选择器

组件位于 `src/components/masterdata/`，入口均为 `index.vue`。`ItemPicker` 提供料品快选及分页参照弹窗，`UnitPicker` 提供单位快选和“更多单位”列表，`ItemCategoryPicker` 提供分类树形单选，`SupplierPicker` 提供供应商快选及“更多供应商”列表。

## 调用约定

单选 `v-model` 使用 `number | null`；料品多选传入 `multiple` 并使用 `number[]`。料品组件通过泛型关联 `multiple` 和模型类型。组件的 `change` 均返回选中记录数组，清空返回空数组；外部值回显不触发 change。业务页面根据记录回填规格、单位、税率等，不在组件中绑定采购单据规则。

```vue
<ItemPicker v-model="itemId" @change="fillItem" />
<ItemPicker v-model="itemIds" multiple @change="addLines" />
<ItemPicker v-model="purchaseItemId" purchase-only />
<UnitPicker v-model="unitId" />
<ItemCategoryPicker v-model="categoryId" />
<SupplierPicker v-model="supplierId" @change="fillSupplierContact" />
```

共同支持 `disabled`、`clearable`、`placeholder`，继承 Element Plus 表单禁用状态，真实选值后触发表单 change 校验。控件属性与无障碍标签透传到输入控件，组件不全局注册。通过对应目录显式导入：

```ts
import ItemPicker from '@/components/masterdata/ItemPicker/index.vue'
import UnitPicker from '@/components/masterdata/UnitPicker/index.vue'
import ItemCategoryPicker from '@/components/masterdata/ItemCategoryPicker/index.vue'
import SupplierPicker from '@/components/masterdata/SupplierPicker/index.vue'
```

## 数据和权限

独立使用时请求 `/masterdata/reference` 只读接口，分别需要 `masterdata:item:reference`、`masterdata:unit:reference`、`masterdata:category:reference`。料品窗口内的分类筛选只需料品参照权限。授权在角色管理中配置，默认仅管理员；精细授予参照权限时关闭菜单父子联动。

单位、分类允许通过 `options` 提供页面已有授权下的选项；提供后不请求独立参照接口。现有料品档案采用此方式，继续调用原有 `/masterdata/item/unit-options`、`category-options`，保持维护角色兼容。

```vue
<UnitPicker v-model="unitId" :options="unitOptions" />
<ItemCategoryPicker v-model="categoryId" :options="categoryOptions" />
```

单位选项不分页，快选最多展示 20 个匹配项；更多单位窗口在完整数据上过滤、排序及分页。分类沿用 `CategoryTreeNode`，可选任意真实分类层级，选中显示完整路径。停用记录禁止新选但保留旧值；缺失 ID 显示“已失效”，不会自动清空。

## 料品弹窗与失败处理

- 关键词匹配编码、名称、规格，分类条件包含后代。`purchase-only` 限定允许采购，新选列表固定为启用料品。
- 多选跨页保存草稿，按 ID 去重、保持选择顺序，最多 100 项；页头全选仅操作当前页。关闭或取消不回填。
- 确认前批量复核新增料品的启停及采购状态。原停用值可保持回显；失效值须移除。业务保存继续承担最终引用和并发校验。
- 最新请求生效；查询失败保留成功数据及查询、分页、排序指示，允许重试。回显失败保留外部模型，清空必须由用户主动触发。
- 选择器不包含档案增删改，不执行单位换算；新增档案、单据重复行等业务行为由调用页面设计。

浏览器测试宿主页、脚本和截图放在忽略目录，不提交业务菜单或 Demo。

## 供应商参照

`SupplierPicker` 使用 `/masterdata/reference/suppliers`，需要独立 `masterdata:supplier:reference` 权限，不要求供应商列表或维护权限。也可传入 `options` 避免重复请求。

快选匹配编码、名称及简称，最多展示 20 个匹配项；“更多供应商”窗口在完整选项上搜索、排序和分页，显示主要联系人、联系电话。回填对象包含地址及联系信息，不包含审计字段、删除标记和版本。停用项不可新选，原停用值或失效 ID 保留展示；取消弹窗不改变模型。继承 Element Plus 表单禁用与校验行为，失败保留已有值并允许重试。

当前供应商档案只有一组主要联系信息，订单后续应保存必要的联系信息快照，选择器本身不写采购业务数据。

## 行选择与查询条件的取舍

- 所有 VXE 参照弹窗使用原生 `radio-config.trigger='row'` 或 `checkbox-config.trigger='row'`。单选点击普通单元格选中该行，多选再次点击同一行取消勾选；单选保留双击确认。复选框本身继续由 VXE 处理，不叠加手写点击事件，避免一次点击触发两次切换。
- 停用、已排除及不符合来源分组的行不可新选，加载及确认期间不接受新的行选择。分类选择器使用 Element Plus 树节点选择，沿用现有节点点击行为。
- 录入外键、回填档案信息时使用 Picker；关键词检索继续使用文本框。Picker 内输入文字是在搜索候选档案，最终提交仍为精确 ID，不能替代列表的包含匹配查询。
- 库存余额和流水的料品条件是编码／名称包含匹配，仓库编码、货位编码当前是精确匹配，输入框应明确提示。需要精确定位档案时可另加 ID 条件，与关键词组合；不将所有文本条件强制替换成 Picker。
- 历史查询需覆盖停用档案及业务快照，且库存查询用户不一定有档案参照权限。新增查询用选择入口时，应配套查询范围和权限，不能直接套用只允许新选启用档案的录入参照规则。

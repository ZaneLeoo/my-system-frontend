<template>
  <div class="app-container category-page">
    <div class="page-heading">
      <div>
        <h2>料品分类</h2>
        <p>按层级组织料品，供采购与库存档案共用。</p>
      </div>
      <el-button v-if="canCreate" type="primary" icon="Plus" :disabled="loading" @click="openDrawer('create')">
        新增分类
      </el-button>
    </div>

    <el-form :model="query" inline class="query-form" @submit.prevent="loadCategories(true)">
      <el-form-item label="分类编码">
        <el-input v-model="query.categoryCode" placeholder="请输入编码" clearable maxlength="64" />
      </el-form-item>
      <el-form-item label="分类名称">
        <el-input v-model="query.categoryName" placeholder="请输入名称" clearable maxlength="100" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.status" placeholder="全部状态" clearable style="width: 130px">
          <el-option label="启用" :value="CategoryStatus.Enabled" />
          <el-option label="停用" :value="CategoryStatus.Disabled" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" native-type="submit" :loading="loading">查询</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <div class="table-toolbar">
      <span class="result-count">
        共 {{ matchedCount }} 个分类
        <span v-if="contextCount">，另显示 {{ contextCount }} 个上级节点</span>
      </span>
      <div>
        <el-button text :disabled="loading || !rows.length" @click="tableRef?.setAllTreeExpand(true)">
          展开全部
        </el-button>
        <el-button text :disabled="loading || !rows.length" @click="tableRef?.setAllTreeExpand(false)">
          折叠全部
        </el-button>
        <el-button text icon="Refresh" :disabled="loading" @click="loadCategories()">刷新</el-button>
      </div>
    </div>

    <vxe-table
      ref="tableRef"
      :data="rows"
      :loading="loading"
      border
      stripe
      show-overflow
      max-height="640"
      :column-config="{ resizable: true }"
      :row-config="{ keyField: 'categoryId', isHover: true }"
      :tree-config="{ transform: true, rowField: 'categoryId', parentField: 'parentId', reserve: true }"
      :row-class-name="rowClassName"
    >
      <vxe-column field="categoryCode" title="分类编码" tree-node min-width="240">
        <template #default="{ row }">
          <el-button v-if="canQuery" link type="primary" @click="openDrawer('detail', row)">
            {{ row.categoryCode }}
          </el-button>
          <span v-else>{{ row.categoryCode }}</span>
        </template>
      </vxe-column>
      <vxe-column field="categoryName" title="分类名称" min-width="200" />
      <vxe-column field="status" title="状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === CategoryStatus.Enabled ? 'success' : 'info'" effect="plain">
            {{ row.status === CategoryStatus.Enabled ? '启用' : '停用' }}
          </el-tag>
        </template>
      </vxe-column>
      <vxe-column field="sortOrder" title="排序" width="80" align="right" />
      <vxe-column field="remark" title="备注" min-width="200" />
      <vxe-column field="updateTime" title="最后修改时间" width="180" />
      <vxe-column title="操作" width="230" fixed="right">
        <template #default="{ row }">
          <el-button v-if="canQuery" link type="primary" @click="openDrawer('detail', row)">详情</el-button>
          <el-button v-if="canCreate" link type="primary" @click="openDrawer('create', row)">新增下级</el-button>
          <el-button v-if="canEdit" link type="primary" @click="openDrawer('edit', row)">编辑</el-button>
          <el-button
            v-hasPermi="['masterdata:category:remove']"
            link
            type="danger"
            :disabled="deletingId !== undefined"
            @click="removeCategory(row)"
          >
            删除
          </el-button>
        </template>
      </vxe-column>
      <template #empty>
        <el-empty description="暂无符合条件的分类" :image-size="80" />
      </template>
    </vxe-table>

    <el-drawer
      v-model="drawerOpen"
      :title="drawerTitle"
      size="min(600px, 100vw)"
      append-to-body
      destroy-on-close
      :before-close="beforeClose"
    >
      <div v-loading="drawerLoading">
        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-position="top"
          :disabled="readonly || saving || drawerLoading"
        >
          <el-form-item label="上级分类" prop="parentId">
            <el-tree-select
              v-model="form.parentId"
              :data="parentOptions"
              node-key="id"
              :props="{ value: 'id', label: 'label', children: 'children', disabled: 'disabled' }"
              check-strictly
              filterable
              default-expand-all
              style="width: 100%"
              placeholder="选择上级分类"
            />
          </el-form-item>
          <el-form-item label="分类编码" prop="categoryCode">
            <el-input v-model="form.categoryCode" maxlength="64" show-word-limit placeholder="手工输入，全系统唯一" />
            <div class="field-hint">编码不区分大小写，删除后仍保留占用。</div>
          </el-form-item>
          <el-form-item label="分类名称" prop="categoryName">
            <el-input v-model="form.categoryName" maxlength="100" show-word-limit placeholder="请输入分类名称" />
          </el-form-item>
          <div class="form-row">
            <el-form-item label="显示排序" prop="sortOrder">
              <el-input-number
                v-model="form.sortOrder"
                :min="0"
                :max="MAX_SORT_ORDER"
                :precision="0"
                controls-position="right"
              />
            </el-form-item>
            <el-form-item label="状态" prop="status">
              <el-radio-group v-model="form.status">
                <el-radio :value="CategoryStatus.Enabled">启用</el-radio>
                <el-radio :value="CategoryStatus.Disabled">停用</el-radio>
              </el-radio-group>
            </el-form-item>
          </div>
          <el-form-item label="备注" prop="remark">
            <el-input v-model="form.remark" type="textarea" :rows="4" maxlength="500" show-word-limit />
          </el-form-item>
        </el-form>
        <el-descriptions v-if="detail" title="维护记录" :column="1" border class="audit-info">
          <el-descriptions-item label="创建人">{{ detail.createBy }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ detail.createTime }}</el-descriptions-item>
          <el-descriptions-item label="修改人">{{ detail.updateBy || '—' }}</el-descriptions-item>
          <el-descriptions-item label="修改时间">{{ detail.updateTime || '—' }}</el-descriptions-item>
        </el-descriptions>
      </div>
      <template #footer>
        <el-button :disabled="saving" @click="beforeClose(() => (drawerOpen = false))">
          {{ readonly ? '关闭' : '取消' }}
        </el-button>
        <el-button v-if="!readonly" type="primary" :loading="saving" :disabled="drawerLoading" @click="saveCategory">
          保存
        </el-button>
        <el-button v-else-if="canEdit" type="primary" :disabled="drawerLoading" @click="openDrawer('edit', detail)">
          编辑
        </el-button>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts" name="ItemCategory">
import { computed, nextTick, onMounted, reactive, ref, shallowRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus/es/components/form'
import type { VxeTableInstance, VxeTablePropTypes } from 'vxe-table'
import { useVxe } from '@/plugins/vxe'
import auth from '@/plugins/auth'
import {
  createCategory,
  deleteCategory,
  getCategory,
  getCategoryTree,
  listCategories,
  updateCategory
} from '@/api/masterdata/item-category'
import {
  CategoryStatus,
  type CategoryQuery,
  type CategoryTreeNode,
  type ItemCategory,
  type SaveCategoryRequest
} from '@/types/api/masterdata/item-category'

useVxe()

const ROOT_ID = 0
const MAX_SORT_ORDER = 2147483647
type DrawerMode = 'create' | 'edit' | 'detail'
const tableRef = ref<VxeTableInstance<ItemCategory>>()
const rows = shallowRef<ItemCategory[]>([])
const query = reactive<CategoryQuery>({})
const loading = ref(false)
const deletingId = ref<number>()
const drawerOpen = ref(false)
const drawerLoading = ref(false)
const saving = ref(false)
const mode = ref<DrawerMode>('create')
const detail = ref<ItemCategory>()
const parentOptions = ref<CategoryTreeNode[]>([])
const formRef = ref<FormInstance>()
const form = ref<SaveCategoryRequest>(emptyForm())
let savedSnapshot = ''
let listSequence = 0
let drawerSequence = 0
let initialized = false

const canQuery = computed(() => auth.hasPermi('masterdata:category:query'))
const canCreate = computed(() => canQuery.value && auth.hasPermi('masterdata:category:add'))
const canEdit = computed(() => canQuery.value && auth.hasPermi('masterdata:category:edit'))
const readonly = computed(() => mode.value === 'detail')
const drawerTitle = computed(
  () => ({ create: '新增料品分类', edit: '编辑料品分类', detail: '料品分类详情' })[mode.value]
)
const matchedCount = computed(() => rows.value.filter((row) => row.matched).length)
const contextCount = computed(() => rows.value.length - matchedCount.value)
const rules: FormRules<SaveCategoryRequest> = {
  parentId: [{ required: true, message: '请选择上级分类', trigger: 'change' }],
  categoryCode: [{ required: true, whitespace: true, message: '请输入分类编码', trigger: 'blur' }],
  categoryName: [{ required: true, whitespace: true, message: '请输入分类名称', trigger: 'blur' }],
  sortOrder: [
    {
      required: true,
      type: 'integer',
      min: 0,
      max: MAX_SORT_ORDER,
      message: '排序须为有效的非负整数',
      trigger: 'change'
    }
  ],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }]
}
const rowClassName: VxeTablePropTypes.RowClassName<ItemCategory> = ({ row }) => (row.matched ? '' : 'context-row')

function emptyForm(): SaveCategoryRequest {
  return {
    parentId: ROOT_ID,
    categoryCode: '',
    categoryName: '',
    sortOrder: 0,
    status: CategoryStatus.Enabled,
    remark: ''
  }
}

/** 只复制可维护字段，审计与删除标记不发送给后端。 */
function toForm(category: ItemCategory): SaveCategoryRequest {
  return {
    categoryId: category.categoryId,
    parentId: category.parentId,
    categoryCode: category.categoryCode,
    categoryName: category.categoryName,
    sortOrder: category.sortOrder,
    status: category.status,
    remark: category.remark,
    version: category.version
  }
}

/** 最新请求生效；保存和刷新后保留当前筛选与节点展开状态。 */
async function loadCategories(expandMatches = false, expandParentId?: number) {
  const sequence = ++listSequence
  const expandedIds = new Set(tableRef.value?.getTreeExpandRecords().map((row) => row.categoryId) ?? [])
  loading.value = true
  try {
    const response = await listCategories({
      categoryCode: query.categoryCode?.trim() || undefined,
      categoryName: query.categoryName?.trim() || undefined,
      status: query.status || undefined
    })
    if (sequence !== listSequence) return
    rows.value = response.data ?? []
    await nextTick()
    if (sequence !== listSequence) return
    if (!initialized || expandMatches) {
      await tableRef.value?.setAllTreeExpand(true)
    } else {
      await tableRef.value?.setTreeExpand(
        rows.value.filter((row) => expandedIds.has(row.categoryId) || row.categoryId === expandParentId),
        true
      )
    }
    initialized = true
  } catch {
    // 请求层统一显示接口错误，保留当前已展示的数据。
  } finally {
    if (sequence === listSequence) loading.value = false
  }
}

function resetQuery() {
  query.categoryCode = undefined
  query.categoryName = undefined
  query.status = undefined
  void loadCategories(true)
}

/** 详情及上级选项均读取最新接口结果，避免使用列表中的旧版本编辑。 */
async function openDrawer(nextMode: DrawerMode, row?: ItemCategory) {
  const sequence = ++drawerSequence
  mode.value = nextMode
  drawerLoading.value = true
  drawerOpen.value = true
  detail.value = undefined
  form.value = emptyForm()
  savedSnapshot = JSON.stringify(form.value)
  try {
    const [treeResponse, detailResponse] = await Promise.all([
      getCategoryTree(nextMode === 'edit' ? row?.categoryId : undefined),
      nextMode !== 'create' && row ? getCategory(row.categoryId) : Promise.resolve(undefined)
    ])
    if (sequence !== drawerSequence) return
    parentOptions.value = [{ id: ROOT_ID, label: '顶级分类', disabled: false, children: treeResponse.data ?? [] }]
    if (detailResponse?.data) {
      detail.value = detailResponse.data
      form.value = toForm(detailResponse.data)
    } else if (nextMode === 'create' && row) {
      form.value.parentId = row.categoryId
      if (row.status === CategoryStatus.Disabled) form.value.status = CategoryStatus.Disabled
    }
    savedSnapshot = JSON.stringify(form.value)
    await nextTick()
    formRef.value?.clearValidate()
  } catch {
    if (sequence === drawerSequence) drawerOpen.value = false
  } finally {
    if (sequence === drawerSequence) drawerLoading.value = false
  }
}

async function beforeClose(done: () => void) {
  if (saving.value) return
  if (!readonly.value && JSON.stringify(form.value) !== savedSnapshot) {
    try {
      await ElMessageBox.confirm('尚有未保存的修改，是否放弃？', '关闭编辑', {
        type: 'warning',
        confirmButtonText: '放弃修改',
        cancelButtonText: '继续编辑'
      })
    } catch {
      return
    }
  }
  drawerSequence++
  done()
}

async function saveCategory() {
  if (saving.value || drawerLoading.value || !formRef.value) return
  saving.value = true
  try {
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return
    const data: SaveCategoryRequest = {
      ...form.value,
      categoryCode: form.value.categoryCode.trim(),
      categoryName: form.value.categoryName.trim(),
      remark: form.value.remark.trim()
    }
    if (mode.value === 'create') await createCategory(data)
    else await updateCategory(data)
    ElMessage.success(mode.value === 'create' ? '分类新增成功' : '分类修改成功')
    drawerOpen.value = false
    await loadCategories(false, data.parentId)
  } catch {
    // 保存失败时保留用户输入，接口层显示具体业务错误。
  } finally {
    saving.value = false
  }
}

async function removeCategory(row: ItemCategory) {
  if (deletingId.value !== undefined) return
  deletingId.value = row.categoryId
  try {
    try {
      await ElMessageBox.confirm(
        `确认删除“${row.categoryName}”（${row.categoryCode}）？删除后编码仍保留占用。`,
        '删除分类',
        { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' }
      )
    } catch {
      return
    }
    await deleteCategory(row.categoryId, row.version)
    ElMessage.success('分类已删除')
    await loadCategories()
  } catch {
    // 服务端检查子分类、版本及权限；失败时保留列表。
  } finally {
    deletingId.value = undefined
  }
}

onMounted(() => void loadCategories())
</script>

<style scoped lang="scss">
.page-heading,
.table-toolbar,
.form-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.page-heading {
  margin-bottom: 24px;
  h2 {
    margin: 0 0 8px;
    font-size: 22px;
  }
  p {
    margin: 0;
    color: var(--el-text-color-secondary);
  }
}
.query-form {
  margin-bottom: 4px;
}
.table-toolbar {
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.result-count,
.field-hint {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.field-hint {
  line-height: 1.6;
  margin-top: 6px;
}
.form-row {
  align-items: flex-start;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 32px;
}
.audit-info {
  margin-top: 24px;
}
:deep(.context-row) {
  color: var(--el-text-color-secondary);
}
@media (max-width: 640px) {
  .page-heading {
    align-items: flex-start;
  }
  .page-heading p {
    max-width: 200px;
    line-height: 1.6;
  }
}
</style>

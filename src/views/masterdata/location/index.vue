<template>
  <div class="app-container location-page">
    <div class="table-toolbar">
      <span>
        仓库：{{
          warehouseContext ? `${warehouseContext.warehouseCode} / ${warehouseContext.warehouseName}` : '加载中…'
        }}
      </span>
      <el-button @click="router.push('/masterdata/warehouse')">返回仓库</el-button>
    </div>
    <el-alert
      v-if="warehouseContext?.status === EnableStatus.Disabled"
      title="所属仓库已停用，货位不能被新选；仍可维护已有货位。"
      type="warning"
      :closable="false"
      show-icon
      style="margin-bottom: 16px"
    />
    <el-alert
      v-else-if="warehouseContext && !warehouseContext.locationEnabled"
      title="所属仓库未启用货位管理，不能新增货位。"
      type="info"
      :closable="false"
      style="margin-bottom: 16px"
    />
    <el-alert
      v-if="!warehouseContext && !loading"
      title="仓库信息加载失败，可点击刷新重试。"
      type="error"
      :closable="false"
      style="margin-bottom: 16px"
    />
    <el-form :model="query" inline class="query-form" @submit.prevent="searchLocations">
      <el-form-item label="货位编码">
        <el-input v-model="query.locationCode" placeholder="请输入编码" clearable maxlength="64" />
      </el-form-item>
      <el-form-item label="货位名称">
        <el-input v-model="query.locationName" placeholder="请输入名称" clearable maxlength="100" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.status" placeholder="全部状态" clearable style="width: 130px">
          <el-option label="启用" :value="EnableStatus.Enabled" />
          <el-option label="停用" :value="EnableStatus.Disabled" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" native-type="submit" :loading="loading">查询</el-button>
        <el-button icon="Refresh" :disabled="loading" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <div class="table-toolbar">
      <span class="result-count">共 {{ total }} 个货位</span>
      <div>
        <el-button v-if="canCreate" type="primary" icon="Plus" :disabled="loading" @click="openDrawer('create')">
          新增货位
        </el-button>
        <el-button text icon="Refresh" :disabled="loading" @click="loadLocations()">刷新</el-button>
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
      :column-config="{ resizable: true, drag: true }"
      :column-drag-config="{ trigger: 'default', showIcon: true }"
      :row-config="{ keyField: 'locationId', isHover: true }"
      :sort-config="{ remote: true, multiple: false, allowClear: true }"
      :filter-config="{ remote: true }"
      @sort-change="handleSort"
      @filter-change="handleColumnFilter"
      @filter-visible="handleFilterVisible"
    >
      <vxe-column
        field="locationCode"
        title="货位编码"
        min-width="180"
        sortable
        :filters="codeFilters"
        :filter-multiple="false"
      >
        <template #default="{ row }">
          <el-button v-if="canQuery" link type="primary" @click="openDrawer('detail', row)">
            {{ row.locationCode }}
          </el-button>
          <span v-else>{{ row.locationCode }}</span>
        </template>
        <template #filter="params">
          <form class="column-text-filter" @submit.prevent="applyTextFilter($event, params)">
            <el-input
              v-model="filterDraft.locationCode"
              placeholder="包含编码"
              maxlength="64"
              clearable
              aria-label="货位编码列筛选"
            />
            <div class="filter-actions">
              <el-button size="small" @click="applyTextFilter($event, params, true)">清除</el-button>
              <el-button size="small" type="primary" native-type="submit">筛选</el-button>
            </div>
          </form>
        </template>
      </vxe-column>
      <vxe-column
        field="locationName"
        title="货位名称"
        min-width="180"
        sortable
        :filters="nameFilters"
        :filter-multiple="false"
      >
        <template #filter="params">
          <form class="column-text-filter" @submit.prevent="applyTextFilter($event, params)">
            <el-input
              v-model="filterDraft.locationName"
              placeholder="包含名称"
              maxlength="100"
              clearable
              aria-label="货位名称列筛选"
            />
            <div class="filter-actions">
              <el-button size="small" @click="applyTextFilter($event, params, true)">清除</el-button>
              <el-button size="small" type="primary" native-type="submit">筛选</el-button>
            </div>
          </form>
        </template>
      </vxe-column>
      <vxe-column
        field="status"
        title="状态"
        width="120"
        align="center"
        :filters="statusFilters"
        :filter-multiple="false"
      >
        <template #default="{ row }">
          <el-tag :type="row.status === EnableStatus.Enabled ? 'success' : 'info'" effect="plain">
            {{ row.status === EnableStatus.Enabled ? '启用' : '停用' }}
          </el-tag>
        </template>
      </vxe-column>
      <vxe-column field="remark" title="备注" min-width="220" />
      <vxe-column field="updateTime" title="最后修改时间" width="200" sortable />
      <vxe-column title="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button v-if="canQuery" link type="primary" @click="openDrawer('detail', row)">详情</el-button>
          <el-button v-if="canEdit" link type="primary" @click="openDrawer('edit', row)">编辑</el-button>
          <el-button
            v-if="canRemove"
            link
            type="danger"
            :disabled="loading || deletingId !== undefined"
            @click="removeLocation(row)"
          >
            删除
          </el-button>
        </template>
      </vxe-column>
      <template #empty>
        <el-empty description="暂无符合条件的货位" :image-size="80" />
      </template>
    </vxe-table>

    <el-pagination
      v-model:current-page="pagination.pageNum"
      v-model:page-size="pagination.pageSize"
      class="location-pagination"
      background
      layout="total, sizes, prev, pager, next, jumper"
      :total="total"
      :page-sizes="[10, 20, 50, 100]"
      :disabled="loading"
      @change="changePage"
    />

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
          <el-form-item label="货位编码" prop="locationCode">
            <el-input v-model="form.locationCode" maxlength="64" show-word-limit placeholder="请输入货位编码" />
          </el-form-item>
          <el-form-item label="货位名称" prop="locationName">
            <el-input v-model="form.locationName" maxlength="100" show-word-limit placeholder="请输入货位名称" />
            <div class="field-hint">编码在当前仓库内唯一，删除后仍保留占用；所属仓库不可更换。</div>
          </el-form-item>
          <el-form-item label="状态" prop="status">
            <el-radio-group v-model="form.status">
              <el-radio
                :value="EnableStatus.Enabled"
                :disabled="warehouseContext?.status !== EnableStatus.Enabled && detail?.status !== EnableStatus.Enabled"
              >
                启用
              </el-radio>
              <el-radio :value="EnableStatus.Disabled">停用</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="备注" prop="remark">
            <el-input v-model="form.remark" type="textarea" :rows="4" maxlength="500" show-word-limit />
          </el-form-item>
        </el-form>
        <el-descriptions v-if="detail && readonly" title="维护记录" :column="1" border class="audit-info">
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
        <el-button v-if="!readonly" type="primary" :loading="saving" :disabled="drawerLoading" @click="saveLocation">
          保存
        </el-button>
        <el-button v-else-if="canEdit" type="primary" :disabled="drawerLoading" @click="openDrawer('edit', detail)">
          编辑
        </el-button>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts" name="MasterDataLocation">
import { computed, nextTick, onMounted, reactive, ref, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getLocationWarehouseContext } from '@/api/masterdata/storage-reference'
import type { WarehouseReference } from '@/types/api/masterdata/storage-reference'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus/es/components/form'
import type { VxeColumnPropTypes, VxeColumnSlotTypes, VxeTableDefines, VxeTableInstance } from 'vxe-table'
import { createLocation, deleteLocation, getLocation, listLocations, updateLocation } from '@/api/masterdata/location'
import { useVxe } from '@/plugins/vxe'
import auth from '@/plugins/auth'
import { EnableStatus } from '@/types/api/common'
import type { SaveLocationRequest, Location, LocationQuery } from '@/types/api/masterdata/location'

useVxe()
const route = useRoute(),
  router = useRouter()
const warehouseId = Number(route.params.warehouseId)
const warehouseContext = shallowRef<WarehouseReference>()

type DrawerMode = 'create' | 'edit' | 'detail'
type LocationFilters = Pick<LocationQuery, 'locationCode' | 'locationName' | 'status'>
const tableRef = ref<VxeTableInstance<Location>>()
const rows = shallowRef<Location[]>([])
const total = ref(0)
const query = reactive<LocationFilters>({})
const appliedQuery = ref<LocationQuery>({ warehouseId, pageNum: 1, pageSize: 20 })
const pagination = reactive({ pageNum: 1, pageSize: 20 })
const filterDraft = reactive({ locationCode: '', locationName: '' })
const codeFilters = computed(() => textFilters(appliedQuery.value.locationCode))
const nameFilters = computed(() => textFilters(appliedQuery.value.locationName))
const statusFilters = computed<VxeColumnPropTypes.Filters>(() => [
  { label: '启用', value: EnableStatus.Enabled, checked: appliedQuery.value.status === EnableStatus.Enabled },
  { label: '停用', value: EnableStatus.Disabled, checked: appliedQuery.value.status === EnableStatus.Disabled }
])
const loading = ref(false)
const deletingId = ref<number>()
const drawerOpen = ref(false)
const drawerLoading = ref(false)
const saving = ref(false)
const mode = ref<DrawerMode>('create')
const detail = ref<Location>()
const formRef = ref<FormInstance>()
const form = ref<SaveLocationRequest>(emptyForm())
let savedSnapshot = ''
let listSequence = 0
let drawerSequence = 0

const canQuery = computed(() => auth.hasPermi('masterdata:location:query'))
const canCreate = computed(
  () =>
    auth.hasPermi('masterdata:location:add') &&
    warehouseContext.value?.status === EnableStatus.Enabled &&
    warehouseContext.value.locationEnabled
)
const canEdit = computed(() => canQuery.value && auth.hasPermi('masterdata:location:edit'))
const canRemove = computed(() => auth.hasPermi('masterdata:location:remove'))
const readonly = computed(() => mode.value === 'detail')
const drawerTitle = computed(() => ({ create: '新增货位', edit: '编辑货位', detail: '货位详情' })[mode.value])
const rules: FormRules<SaveLocationRequest> = {
  locationCode: [{ required: true, whitespace: true, message: '请输入货位编码', trigger: 'blur' }],
  locationName: [{ required: true, whitespace: true, message: '请输入货位名称', trigger: 'blur' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }]
}

function emptyForm(): SaveLocationRequest {
  return { warehouseId, locationCode: '', locationName: '', status: EnableStatus.Enabled, remark: '' }
}

/** 审计和删除标记不发送给服务端。 */
function toForm(location: Location): SaveLocationRequest {
  return {
    warehouseId: location.warehouseId,
    locationId: location.locationId,
    locationCode: location.locationCode,
    locationName: location.locationName,
    status: location.status,
    remark: location.remark,
    version: location.version
  }
}

/** 仅提交最新结果；失败时恢复已生效的分页、排序和筛选指示。 */
async function loadLocations(filters: LocationQuery = appliedQuery.value): Promise<void> {
  const sequence = ++listSequence
  const requested = { ...filters }
  loading.value = true
  try {
    const { data: context } = await getLocationWarehouseContext(warehouseId)
    if (sequence !== listSequence) return
    warehouseContext.value = context
    const { data } = await listLocations({ ...requested, warehouseId })
    if (sequence !== listSequence) return
    const lastPage = Math.max(1, Math.ceil(data.total / requested.pageSize))
    if (requested.pageNum > lastPage && data.total > 0) {
      await loadLocations({ ...requested, pageNum: lastPage })
      return
    }
    if (!data.total && requested.pageNum > 1) requested.pageNum = 1
    rows.value = data.rows
    total.value = data.total
    appliedQuery.value = requested
    Object.assign(pagination, { pageNum: requested.pageNum, pageSize: requested.pageSize })
    await syncSort(sequence)
  } catch {
    if (sequence !== listSequence) return
    appliedQuery.value = { ...appliedQuery.value }
    Object.assign(pagination, { pageNum: appliedQuery.value.pageNum, pageSize: appliedQuery.value.pageSize })
    Object.assign(query, filtersOf(appliedQuery.value))
    await syncSort(sequence)
  } finally {
    if (sequence === listSequence) loading.value = false
  }
}

/** 使用不会触发查询事件的 VXE 方法同步排序，避免失败恢复递归请求。 */
async function syncSort(sequence: number) {
  await nextTick()
  if (sequence !== listSequence) return
  const applied = appliedQuery.value
  if (applied.sortField) await tableRef.value?.sort(applied.sortField, applied.sortDirection)
  else await tableRef.value?.clearSort()
}

function filtersOf(source: LocationFilters): LocationFilters {
  return { locationCode: source.locationCode, locationName: source.locationName, status: source.status }
}

function searchLocations() {
  const filters: LocationFilters = {
    locationCode: query.locationCode?.trim() || undefined,
    locationName: query.locationName?.trim() || undefined,
    status: query.status || undefined
  }
  Object.assign(query, filters)
  void loadLocations({ ...appliedQuery.value, ...filters, pageNum: 1 })
}

function changePage(pageNum: number, pageSize: number) {
  void loadLocations({
    ...appliedQuery.value,
    pageNum: pageSize !== appliedQuery.value.pageSize ? 1 : pageNum,
    pageSize
  })
}

function handleSort({ field, order }: VxeTableDefines.SortChangeEventParams<Location>) {
  if (field !== 'locationCode' && field !== 'locationName' && field !== 'updateTime') return
  void loadLocations({
    ...appliedQuery.value,
    pageNum: 1,
    sortField: order ? field : undefined,
    sortDirection: order || undefined
  })
}

function textFilters(value?: string): VxeColumnPropTypes.Filters<string> {
  return [{ label: '包含', value: 'contains', data: value ?? '', checked: Boolean(value) }]
}

async function applyTextFilter(event: Event, params: VxeColumnSlotTypes.FilterSlotParams<Location>, clear = false) {
  const field = params.column.field
  if (field !== 'locationCode' && field !== 'locationName') return
  await tableRef.value?.setFilterByEvent(event, params.column, textFilters(clear ? '' : filterDraft[field].trim()))
  await tableRef.value?.closeFilter()
}

function handleFilterVisible({ field, visible }: VxeTableDefines.FilterVisibleEventParams<Location>) {
  if (visible && (field === 'locationCode' || field === 'locationName'))
    filterDraft[field] = appliedQuery.value[field] ?? ''
}

/** 列筛选和顶部表单使用同一组已提交条件。 */
function handleColumnFilter({ filterList }: VxeTableDefines.FilterChangeEventParams<Location>) {
  const filters: LocationFilters = { locationCode: undefined, locationName: undefined, status: undefined }
  for (const filter of filterList) {
    if (filter.field === 'locationCode' || filter.field === 'locationName') {
      const value: unknown = filter.datas[0]
      filters[filter.field] = typeof value === 'string' ? value.trim() || undefined : undefined
    } else if (filter.field === 'status') {
      const value: unknown = filter.values[0]
      if (value === EnableStatus.Enabled || value === EnableStatus.Disabled) filters.status = value
    }
  }
  Object.assign(query, filters)
  void loadLocations({ ...appliedQuery.value, ...filters, pageNum: 1 })
}

async function resetQuery() {
  Object.assign(query, { locationCode: undefined, locationName: undefined, status: undefined })
  await tableRef.value?.closeFilter()
  await loadLocations({ warehouseId, pageNum: 1, pageSize: appliedQuery.value.pageSize })
}

/** 编辑前读取最新详情与版本，忽略关闭或切换抽屉后的迟到响应。 */
async function openDrawer(nextMode: DrawerMode, row?: Location) {
  if (nextMode !== 'create' && !row) return
  const sequence = ++drawerSequence
  mode.value = nextMode
  drawerLoading.value = true
  drawerOpen.value = true
  detail.value = undefined
  form.value = emptyForm()
  savedSnapshot = JSON.stringify(form.value)
  try {
    if (nextMode !== 'create' && row) {
      const { data } = await getLocation(row.locationId)
      if (sequence !== drawerSequence) return
      if (data.warehouseId !== warehouseId) throw new Error('货位不属于当前仓库')
      detail.value = data
      form.value = toForm(data)
    }
    savedSnapshot = JSON.stringify(form.value)
    await nextTick()
    if (sequence === drawerSequence) formRef.value?.clearValidate()
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

async function saveLocation() {
  if (saving.value || drawerLoading.value || !formRef.value) return
  saving.value = true
  try {
    if (!(await formRef.value.validate().catch(() => false))) return
    const data = {
      ...form.value,
      locationCode: form.value.locationCode.trim(),
      locationName: form.value.locationName.trim(),
      remark: form.value.remark.trim()
    }
    if (mode.value === 'create') await createLocation(data)
    else await updateLocation(data)
    ElMessage.success(mode.value === 'create' ? '货位新增成功' : '货位修改成功')
    drawerSequence++
    drawerOpen.value = false
    await loadLocations()
  } catch {
    // 请求层显示错误，保留表单供用户修正或刷新版本。
  } finally {
    saving.value = false
  }
}

async function removeLocation(row: Location) {
  if (deletingId.value !== undefined) return
  deletingId.value = row.locationId
  try {
    try {
      await ElMessageBox.confirm(
        `确认删除“${row.locationName}”（${row.locationCode}）？删除后编码仍保留占用。`,
        '删除货位',
        { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' }
      )
    } catch {
      return
    }
    await deleteLocation(row.locationId, row.version)
    ElMessage.success('货位已删除')
    await loadLocations()
  } catch {
    // 版本冲突及服务端规则错误由请求层显示，列表保留原数据。
  } finally {
    deletingId.value = undefined
  }
}

onMounted(() => void loadLocations())
</script>

<style scoped lang="scss">
.query-form {
  margin-bottom: 4px;
}
.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.result-count,
.field-hint {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.field-hint {
  margin-top: 6px;
  line-height: 1.6;
}
.location-pagination {
  margin-top: 16px;
  justify-content: flex-end;
  flex-wrap: wrap;
  row-gap: 8px;
}
.audit-info {
  margin-top: 24px;
}
.column-text-filter {
  width: 240px;
  padding: 12px;
}
.filter-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>

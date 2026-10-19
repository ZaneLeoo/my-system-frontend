<template>
  <div class="app-container" v-loading="loading">
    <div v-if="detail" class="editor">
      <div class="toolbar">
        <div>
          <strong>{{ detail.definition.displayName }}</strong>
          <el-tag>草稿 {{ detail.definition.draftVersion }}</el-tag>
          <el-tag type="success">已发布 {{ detail.definition.publishedRevision }}</el-tag>
        </div>
        <div>
          <el-button v-hasPermi="['query:definition:edit']" :loading="saving" @click="save">保存草稿</el-button>
          <el-button v-hasPermi="['query:definition:preview']" :disabled="dirty" @click="preview()">
            预览已保存草稿
          </el-button>
          <el-button
            v-hasPermi="['query:definition:publish']"
            type="primary"
            :disabled="dirty"
            :loading="saving"
            @click="publish"
          >
            校验并发布
          </el-button>
          <el-button @click="showHistory">发布记录</el-button>
        </div>
      </div>
      <el-alert v-if="dirty" title="存在未保存修改；保存后可预览和发布。" type="info" :closable="false" />
      <el-tabs v-model="tab">
        <el-tab-pane label="基本信息" name="basic">
          <el-form label-width="110px" style="max-width: 550px">
            <el-form-item label="查询对象编码">
              <el-input :model-value="detail.definition.queryKey" disabled />
            </el-form-item>
            <el-form-item label="显示名称">
              <el-input v-model="detail.definition.displayName" maxlength="100" />
            </el-form-item>
            <el-form-item label="发布后启用"><el-switch v-model="detail.definition.enabled" /></el-form-item>
          </el-form>
          <el-alert
            title="查询来源和关联由后端适配器登记；此页面配置开放字段及其展示，不修改业务 SQL。"
            :closable="false"
          />
        </el-tab-pane>
        <el-tab-pane label="可查询字段" name="fields">
          <div class="field-toolbar">
            <div class="field-search-group">
              <el-input v-model="fieldSearch" clearable placeholder="按显示名称或字段标识查询" style="width: 320px" />
              <el-text>显示 {{ filteredFields.length }} / {{ detail.fields.length }} 个字段</el-text>
            </div>
            <el-button v-hasPermi="['query:definition:edit']" type="primary" @click="addField">添加字段</el-button>
          </div>
          <el-table :data="pagedFields" border class="field-table" row-key="fieldKey">
            <el-table-column prop="label" label="显示名称" min-width="150" />
            <el-table-column prop="fieldKey" label="字段标识" min-width="160" />
            <el-table-column label="来源" min-width="170">
              <template #default="{ row }">
                {{ sourceLabel(row) }} / {{ columnOf(row)?.displayName || '字段已失效' }}
              </template>
            </el-table-column>
            <el-table-column label="控件" width="120">
              <template #default="{ row }">{{ controlLabels[row.component] || row.component }}</template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '开放' : '停用' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150">
              <template #default="{ row }">
                <el-button v-hasPermi="['query:definition:edit']" link type="primary" @click="editField(row)">
                  配置
                </el-button>
                <el-button v-hasPermi="['query:definition:edit']" link @click="row.enabled = !row.enabled">
                  {{ row.enabled ? '停用' : '启用' }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-pagination
            v-model:current-page="fieldPage"
            v-model:page-size="fieldPageSize"
            class="query-pagination"
            background
            layout="total, sizes, prev, pager, next, jumper"
            :total="filteredFields.length"
            :page-sizes="[10, 20, 50, 100]"
          />
        </el-tab-pane>
        <el-tab-pane label="常用查询布局" name="layout">
          <el-alert
            title="拖动左侧手柄调整顺序；开启“常用区显示”后，字段会按此顺序出现在列表顶部。"
            :closable="false"
          />
          <div class="layout-list">
            <table class="layout-table" aria-label="常用查询布局">
              <colgroup>
                <col style="width: 60px" />
                <col style="width: 64px" />
                <col />
                <col style="width: 150px" />
                <col style="width: 220px" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" class="layout-center">拖拽</th>
                  <th scope="col" class="layout-center">序号</th>
                  <th scope="col">字段名称</th>
                  <th scope="col" class="layout-center">常用区显示</th>
                  <th scope="col">默认方式</th>
                </tr>
              </thead>
              <draggable v-model="layoutFields" tag="tbody" item-key="fieldKey" handle=".drag-handle">
                <template #item="{ element, index }">
                  <tr>
                    <td class="layout-center">
                      <span class="drag-handle" title="拖拽排序" :aria-label="`拖动${element.label}排序`">⠿</span>
                    </td>
                    <td class="layout-center">{{ index + 1 }}</td>
                    <td>{{ element.label }}</td>
                    <td class="layout-center">
                      <el-switch
                        v-model="element.commonVisible"
                        size="small"
                        :aria-label="`${element.label}常用区显示`"
                      />
                    </td>
                    <td>{{ operatorLabels[element.defaultOperator] }}</td>
                  </tr>
                </template>
              </draggable>
            </table>
          </div>
          <el-empty v-if="!layoutFields.length" description="请先开放主表查询字段" />
        </el-tab-pane>
        <el-tab-pane label="查询预览" name="preview">
          <el-alert
            v-if="!checkPermi(['query:definition:preview'])"
            title="当前账号没有查询预览权限。"
            type="warning"
            :closable="false"
            class="preview-message"
          />
          <el-alert
            v-if="dirty"
            title="请先保存草稿，再预览当前配置。"
            type="warning"
            :closable="false"
            class="preview-message"
          />
          <el-alert v-if="previewError" :title="previewError" type="error" :closable="false" class="preview-message">
            <el-button text @click="preview()">重试预览</el-button>
          </el-alert>
          <div
            v-if="previewLoading && !previewMetadata"
            class="preview-message"
            v-loading="true"
            style="height: 90px"
          />
          <template v-if="previewMetadata && !dirty">
            <QueryPanel
              :metadata="previewMetadata"
              :preview-definition-id="id"
              :applied-values="previewSelection.values"
              :applied-advanced="previewSelection.advanced"
              :busy="previewLoading"
              @submit="preview"
              @reload="preview()"
            />
            <el-text>共 {{ previewTotal }} 条，预览前 20 条</el-text>
            <el-table v-if="previewRows.length" :data="previewRows" border class="field-table">
              <el-table-column
                v-for="field in previewColumns"
                :key="field.fieldKey"
                :label="field.label"
                min-width="160"
                show-overflow-tooltip
              >
                <template #default="{ row }">{{ formatPreviewValue(field.fieldKey, row[field.fieldKey]) }}</template>
              </el-table-column>
            </el-table>
            <el-empty v-else description="查询配置已加载，当前条件下没有数据" />
          </template>
          <el-empty v-else-if="!previewLoading && !previewError && !dirty" description="尚无预览结果">
            <el-button @click="preview()">加载预览</el-button>
          </el-empty>
        </el-tab-pane>
      </el-tabs>
    </div>
    <el-empty v-else-if="!loading" description="配置加载失败"><el-button @click="load">重试</el-button></el-empty>
    <el-drawer v-model="fieldOpen" title="查询字段配置" size="560px" :before-close="closeField">
      <el-form label-width="110px">
        <el-form-item label="来源分组">
          <el-select
            v-model="fieldDraft.sourceKey"
            :disabled="Boolean(fieldDraft.fieldId)"
            @change="fieldDraft.columnId = undefined"
          >
            <el-option v-for="source in detail?.sources" :key="source.key" :label="source.label" :value="source.key" />
          </el-select>
        </el-form-item>
        <el-form-item label="数据字段">
          <el-select
            v-model="fieldDraft.columnId"
            filterable
            :disabled="Boolean(fieldDraft.fieldId)"
            @change="chooseColumn"
          >
            <el-option
              v-for="column in selectedSource?.columns"
              :key="column.columnId"
              :label="`${column.displayName}（${column.columnName} / ${column.columnType}）`"
              :value="column.columnId"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="字段标识">
          <el-input v-model="fieldDraft.fieldKey" :disabled="Boolean(fieldDraft.fieldId)" maxlength="64" />
        </el-form-item>
        <el-form-item label="显示名称"><el-input v-model="fieldDraft.label" maxlength="100" /></el-form-item>
        <el-form-item label="查询控件">
          <el-select v-model="fieldDraft.component">
            <el-option
              v-for="control in allowedControls"
              :key="control"
              :label="controlLabels[control]"
              :value="control"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="['REFERENCE', 'SELECT'].includes(fieldDraft.component)" label="选项来源">
          <el-select v-model="fieldDraft.optionProvider">
            <el-option
              v-for="provider in availableProviders"
              :key="provider"
              :label="providerLabels[provider] || provider"
              :value="provider"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="允许方式">
          <el-select v-model="selectedOperators" multiple>
            <el-option v-for="op in allowedOperators" :key="op" :label="operatorLabels[op]" :value="op" />
          </el-select>
        </el-form-item>
        <el-form-item label="默认方式">
          <el-select v-model="fieldDraft.defaultOperator">
            <el-option v-for="op in selectedOperators" :key="op" :label="operatorLabels[op]" :value="op" />
          </el-select>
        </el-form-item>
        <el-form-item label="允许排序">
          <el-switch v-model="fieldDraft.sortable" :disabled="fieldDraft.sourceKey !== 'main'" />
        </el-form-item>
        <el-form-item label="开放查询"><el-switch v-model="fieldDraft.enabled" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="fieldOpen = false">取消</el-button>
        <el-button type="primary" @click="confirmField">加入草稿</el-button>
      </template>
    </el-drawer>
    <el-dialog v-model="historyOpen" title="已发布版本" width="900px">
      <el-table :data="releases">
        <el-table-column prop="revision" label="版本" width="90" />
        <el-table-column prop="createBy" label="发布人" width="120" />
        <el-table-column prop="createTime" label="发布时间" width="200" />
        <el-table-column label="配置">
          <template #default="{ row }">
            <el-button link @click="snapshot = JSON.stringify(JSON.parse(row.configSnapshot), null, 2)">
              查看快照
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <pre v-if="snapshot" class="snapshot">{{ snapshot }}</pre>
    </el-dialog>
  </div>
</template>
<script setup lang="ts" name="QueryDefinitionEditor">
import { computed, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as api from '@/api/system/query'
import QueryPanel from '@/components/query/QueryPanel.vue'
import draggable from 'vuedraggable'
import { checkPermi } from '@/utils/permission'
import { buildRequest, clone, operatorLabels } from '@/components/query/useQueryDefinition'
import type {
  DefinitionDetail,
  DraftField,
  QueryMetadata,
  QueryOption,
  QueryRelease,
  QuerySelection
} from '@/types/api/system/query'
const route = useRoute(),
  id = Number(route.params.id),
  detail = ref<DefinitionDetail>(),
  loading = ref(false),
  saving = ref(false),
  tab = ref('fields'),
  saved = ref('')
const dirty = computed(() => Boolean(detail.value) && JSON.stringify(detail.value) !== saved.value)
const layoutFields = computed({
  get: () =>
    detail.value?.fields
      .filter((field) => field.sourceKey === 'main' && field.enabled)
      .sort((a, b) => a.displayOrder - b.displayOrder || a.fieldKey.localeCompare(b.fieldKey)) || [],
  set: (ordered: DraftField[]) => ordered.forEach((field, index) => (field.displayOrder = index + 1))
})
const fieldSearch = ref(''),
  fieldPage = ref(1),
  fieldPageSize = ref(20)
const filteredFields = computed(() => {
  const keyword = fieldSearch.value.trim().toLocaleLowerCase()
  if (!keyword) return detail.value?.fields || []
  return (
    detail.value?.fields.filter(
      (field) =>
        field.label.toLocaleLowerCase().includes(keyword) || field.fieldKey.toLocaleLowerCase().includes(keyword)
    ) || []
  )
})
const pagedFields = computed(() => {
  const start = (fieldPage.value - 1) * fieldPageSize.value
  return filteredFields.value.slice(start, start + fieldPageSize.value)
})
watch([fieldSearch, fieldPageSize], () => (fieldPage.value = 1))
watch(
  () => filteredFields.value.length,
  (total) => (fieldPage.value = Math.min(fieldPage.value, Math.max(1, Math.ceil(total / fieldPageSize.value))))
)
watch(tab, (value) => {
  if (
    value === 'preview' &&
    !previewMetadata.value &&
    !previewLoading.value &&
    !dirty.value &&
    checkPermi(['query:definition:preview'])
  )
    void preview()
})
async function load() {
  loading.value = true
  try {
    detail.value = (await api.getQueryDefinition(id)).data
    saved.value = JSON.stringify(detail.value)
  } catch {
    /* 页面提供重试。 */
  } finally {
    loading.value = false
  }
}
async function save() {
  if (!detail.value || saving.value) return
  saving.value = true
  try {
    const d = detail.value.definition
    const result = await api.saveQueryDefinition(id, d.draftVersion, d.displayName, d.enabled, detail.value.fields)
    detail.value.definition = result.data
    await load()
    ElMessage.success('草稿已保存，尚未发布')
    previewMetadata.value = undefined
    if (tab.value === 'preview') await preview()
  } catch {
    /* 保留草稿。 */
  } finally {
    saving.value = false
  }
}
async function publish() {
  if (!detail.value || dirty.value) return
  try {
    await ElMessageBox.confirm('发布后业务列表下次加载将使用本配置，确认发布？', '发布查询配置', { type: 'warning' })
    saving.value = true
    await api.publishQueryDefinition(id, detail.value.definition.draftVersion)
    await load()
    ElMessage.success('查询配置已发布')
  } catch {
    /* 保留当前配置。 */
  } finally {
    saving.value = false
  }
}
const previewMetadata = ref<QueryMetadata>(),
  previewRows = ref<Record<string, unknown>[]>([]),
  previewTotal = ref(0),
  previewLoading = ref(false),
  previewError = ref(''),
  previewSelection = ref<QuerySelection>({ values: {} }),
  previewOptionLabels = ref<Record<string, Record<string, string>>>({})
let previewSequence = 0
async function preview(selection: QuerySelection = { values: {} }) {
  if (dirty.value || !checkPermi(['query:definition:preview'])) return
  const current = ++previewSequence
  previewLoading.value = true
  previewError.value = ''
  tab.value = 'preview'
  try {
    const request = previewMetadata.value
      ? buildRequest(previewMetadata.value, { pageNum: 1, pageSize: 20 }, selection.values, selection.advanced)
      : { pageNum: 1, pageSize: 20, configVersion: 0 }
    const { data } = await api.previewQuery(id, request)
    if (current !== previewSequence) return
    const optionLabels = await resolvePreviewOptionLabels(data.metadata, data.result.rows)
    if (current !== previewSequence) return
    previewMetadata.value = data.metadata
    previewRows.value = data.result.rows
    previewTotal.value = data.result.total
    previewSelection.value = selection
    previewOptionLabels.value = optionLabels
    tab.value = 'preview'
  } catch {
    if (current === previewSequence) previewError.value = '预览失败，请检查业务列表权限或草稿配置后重试。'
  } finally {
    if (current === previewSequence) previewLoading.value = false
  }
}
const referenceProviders = new Set(['categories', 'units', 'suppliers', 'items'])
async function resolvePreviewOptionLabels(
  metadata: QueryMetadata,
  rows: Record<string, unknown>[]
): Promise<Record<string, Record<string, string>>> {
  const firstRow = rows[0]
  if (!firstRow) return {}
  const configured = metadata.fields
    .filter((field) => field.sourceKey === 'main' && field.fieldKey in firstRow)
    .map((field) => field.fieldKey)
  const visibleKeys = new Set([...new Set([...configured, ...Object.keys(firstRow)])].slice(0, 10))
  const fields = metadata.fields.filter((field) => visibleKeys.has(field.fieldKey) && field.optionProvider)
  const entries: Array<[string, Record<string, string>]> = await Promise.all(
    fields.map(async (field) => {
      try {
        const values = [
          ...new Set(rows.map((row) => row[field.fieldKey]).filter((value) => value !== null && value !== undefined))
        ]
        let options: QueryOption[]
        if (referenceProviders.has(field.optionProvider)) {
          const ids = values
            .map((value) => {
              const id = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
              return Number.isSafeInteger(id) && id > 0 ? id : undefined
            })
            .filter((value): value is number => value !== undefined)
          if (!ids.length) return [field.fieldKey, {}]
          options = (await api.getQueryOptions(metadata.queryKey, field.fieldKey, '', 1, ids, id)).data.rows
        } else {
          options = (await api.getQueryOptions(metadata.queryKey, field.fieldKey, '', 1, undefined, id)).data.rows
        }
        return [field.fieldKey, Object.fromEntries(options.map((option) => [String(option.value), option.label]))]
      } catch {
        return [field.fieldKey, {}]
      }
    })
  )
  return Object.fromEntries(entries)
}
function formatPreviewValue(fieldKey: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  return previewOptionLabels.value[fieldKey]?.[String(value)] ?? String(value)
}
const previewColumns = computed(() => {
  const row = previewRows.value[0]
  if (!row) return []
  const labels = new Map(previewMetadata.value?.fields.map((field) => [field.fieldKey, field.label]) || [])
  const configured =
    previewMetadata.value?.fields
      .filter((field) => field.sourceKey === 'main' && field.fieldKey in row)
      .map((field) => field.fieldKey) || []
  return [...new Set([...configured, ...Object.keys(row)])]
    .slice(0, 10)
    .map((fieldKey) => ({ fieldKey, label: labels.get(fieldKey) || fieldKey }))
})
const historyOpen = ref(false),
  releases = ref<QueryRelease[]>([]),
  snapshot = ref('')
async function showHistory() {
  try {
    releases.value = (await api.getQueryReleases(id)).data
    snapshot.value = ''
    historyOpen.value = true
  } catch {
    /* 请求层提示。 */
  }
}
const fieldOpen = ref(false),
  fieldDraft = ref<DraftField>(emptyField()),
  selectedOperators = ref<string[]>([])
watch(
  selectedOperators,
  (values) => {
    fieldDraft.value.operatorsJson = JSON.stringify(values)
  },
  { flush: 'sync', deep: true }
)
let fieldSnapshot = ''
let editIndex = -1
const providerLabels: Record<string, string> = {
  boolean: '是／否',
  categories: '料品分类（含停用）',
  units: '计量单位（含停用）',
  suppliers: '供应商（含停用）',
  items: '料品（含停用）',
  enableStatus: '启停状态',
  purchaseEnabled: '允许采购',
  orderStatus: '采购订单状态'
}
const controlLabels: Record<string, string> = {
  TEXT: '文本输入',
  NUMBER: '数字输入',
  DATE: '日期',
  DATETIME: '日期时间',
  SELECT: '枚举下拉',
  REFERENCE: '档案选择'
}
function emptyField(): DraftField {
  return {
    fieldKey: '',
    sourceKey: 'main',
    label: '',
    component: 'TEXT',
    operatorsJson: '["eq","like"]',
    defaultOperator: 'like',
    optionProvider: '',
    commonVisible: false,
    displayOrder: 0,
    sortable: false,
    enabled: true
  }
}
const selectedSource = computed(() => detail.value?.sources.find((s) => s.key === fieldDraft.value.sourceKey))
const selectedColumn = computed(() =>
  selectedSource.value?.columns.find((c) => c.columnId === fieldDraft.value.columnId)
)
const expectedProvider = computed(() =>
  selectedColumn.value ? selectedSource.value?.optionProviders?.[selectedColumn.value.columnName] : undefined
)
const availableProviders = computed(() => (expectedProvider.value ? [expectedProvider.value] : []))
const allowedControls = computed(() => {
  if (expectedProvider.value) return selectedColumn.value?.dataType === 'INTEGER' ? ['REFERENCE', 'SELECT'] : ['SELECT']
  return (
    {
      STRING: ['TEXT'],
      INTEGER: ['NUMBER'],
      DECIMAL: ['NUMBER'],
      BOOLEAN: ['SELECT'],
      DATE: ['DATE'],
      DATETIME: ['DATETIME']
    }[selectedColumn.value?.dataType || 'STRING'] || []
  )
})
const allowedOperators = computed(() => {
  const type = selectedColumn.value?.dataType
  const result = ['eq', 'ne', 'in', 'notIn']
  if (type === 'STRING' && fieldDraft.value.component === 'TEXT')
    result.push('like', 'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty')
  if (['INTEGER', 'DECIMAL', 'DATE', 'DATETIME'].includes(type || '') && fieldDraft.value.component !== 'REFERENCE')
    result.push('gt', 'ge', 'lt', 'le', 'between')
  if (selectedColumn.value?.nullable) result.push('isNull', 'isNotNull')
  if (fieldDraft.value.optionProvider === 'categories') result.push('descendantOf')
  return result
})
function sourceLabel(field: DraftField) {
  return detail.value?.sources.find((s) => s.key === field.sourceKey)?.label || field.sourceKey
}
function columnOf(field: DraftField) {
  return detail.value?.sources
    .find((s) => s.key === field.sourceKey)
    ?.columns.find((c) => c.columnId === field.columnId)
}
function addField() {
  editIndex = -1
  fieldDraft.value = emptyField()
  selectedOperators.value = ['eq', 'like']
  fieldSnapshot = JSON.stringify(fieldDraft.value)
  fieldOpen.value = true
}
function editField(field: DraftField) {
  editIndex = detail.value?.fields.indexOf(field) ?? -1
  fieldDraft.value = clone(field)
  selectedOperators.value = JSON.parse(field.operatorsJson) as string[]
  fieldSnapshot = JSON.stringify(fieldDraft.value)
  fieldOpen.value = true
}
function chooseColumn() {
  const column = selectedColumn.value
  if (!column) return
  fieldDraft.value.label = column.displayName
  const camel = column.columnName.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
  fieldDraft.value.fieldKey =
    fieldDraft.value.sourceKey === 'main' ? camel : `line${camel[0]?.toUpperCase()}${camel.slice(1)}`
  fieldDraft.value.optionProvider = expectedProvider.value || ''
  fieldDraft.value.component = allowedControls.value[0] || 'TEXT'
  selectedOperators.value = ['eq']
  fieldDraft.value.defaultOperator = 'eq'
}
function confirmField() {
  const f = fieldDraft.value
  if (
    !f.columnId ||
    !f.label.trim() ||
    !/^[a-zA-Z][a-zA-Z0-9]{0,63}$/.test(f.fieldKey) ||
    !selectedOperators.value.length ||
    !selectedOperators.value.includes(f.defaultOperator) ||
    selectedOperators.value.some((op) => !allowedOperators.value.includes(op))
  ) {
    ElMessage.warning('请检查字段、显示名称、标识及查询方式')
    return
  }
  if (detail.value?.fields.some((row, index) => index !== editIndex && row.fieldKey === f.fieldKey)) {
    ElMessage.warning('字段标识已存在，包括停用字段')
    return
  }
  f.operatorsJson = JSON.stringify(selectedOperators.value)
  if (!['SELECT', 'REFERENCE'].includes(f.component)) f.optionProvider = ''
  if (f.sourceKey !== 'main') {
    f.commonVisible = false
    f.sortable = false
  }
  if (editIndex < 0) detail.value?.fields.push(clone(f))
  else if (detail.value) detail.value.fields[editIndex] = clone(f)
  fieldOpen.value = false
}
async function closeField(done: () => void) {
  if (JSON.stringify(fieldDraft.value) !== fieldSnapshot) {
    try {
      await ElMessageBox.confirm('放弃尚未加入草稿的字段修改？', '关闭字段配置')
    } catch {
      return
    }
  }
  done()
}
onBeforeRouteLeave(async () => {
  if (!dirty.value) return true
  try {
    await ElMessageBox.confirm('查询配置尚未保存，确认离开？', '未保存的草稿', { type: 'warning' })
    return true
  } catch {
    return false
  }
})
onMounted(() => void load())
</script>
<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.toolbar .el-tag {
  margin-left: 8px;
}
.field-table {
  margin-top: 16px;
}
.field-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.field-search-group {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex-wrap: wrap;
}
.layout-list {
  margin-top: 16px;
  max-height: 560px;
  overflow: auto;
  border: 1px solid var(--el-border-color-lighter);
}
.layout-table {
  width: 100%;
  min-width: 720px;
  table-layout: fixed;
  border-spacing: 0;
  color: var(--el-text-color-regular);
  font-size: var(--el-font-size-base);
}
.layout-table th,
.layout-table td {
  box-sizing: border-box;
  height: 44px;
  padding: 6px 12px;
  line-height: 22px;
  text-align: left;
  overflow-wrap: anywhere;
  border-right: 1px solid var(--el-border-color-lighter);
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.layout-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--el-fill-color-light);
  font-weight: 600;
  white-space: nowrap;
}
.layout-table .layout-center {
  text-align: center;
}
.layout-table th:last-child,
.layout-table td:last-child {
  border-right: 0;
}
.layout-table tbody tr:last-child td {
  border-bottom: 0;
}
.layout-table tbody tr:hover {
  background: var(--el-fill-color-light);
}
.query-pagination {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}
.drag-handle {
  cursor: grab;
  color: var(--el-text-color-secondary);
  font-size: 22px;
  user-select: none;
}
.preview-message {
  margin-top: 12px;
}
.snapshot {
  max-height: 450px;
  overflow: auto;
  white-space: pre-wrap;
  background: var(--el-fill-color-light);
  padding: 16px;
}
.editor :deep(.el-tabs__content) {
  overflow: visible;
}
</style>

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
          <el-button v-hasPermi="['query:definition:edit']" type="primary" @click="addField">添加字段</el-button>
          <el-table :data="detail.fields" border class="field-table" row-key="fieldKey">
            <el-table-column prop="label" label="显示名称" min-width="150" />
            <el-table-column prop="fieldKey" label="字段标识" min-width="160" />
            <el-table-column label="来源" min-width="170">
              <template #default="{ row }">
                {{ sourceLabel(row) }} / {{ columnOf(row)?.displayName || '字段已失效' }}
              </template>
            </el-table-column>
            <el-table-column prop="component" label="控件" width="120" />
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
        </el-tab-pane>
        <el-tab-pane label="常用查询布局" name="layout">
          <el-alert title="常用查询显示在列表顶部。明细条件通过高级查询的关联组添加。" :closable="false" />
          <el-table :data="detail.fields.filter((f) => f.sourceKey === 'main' && f.enabled)" border class="field-table">
            <el-table-column prop="label" label="字段" />
            <el-table-column label="常用区显示">
              <template #default="{ row }"><el-switch v-model="row.commonVisible" /></template>
            </el-table-column>
            <el-table-column label="显示顺序">
              <template #default="{ row }">
                <el-input-number v-model="row.displayOrder" :min="0" :max="999" controls-position="right" />
              </template>
            </el-table-column>
            <el-table-column prop="defaultOperator" label="默认方式">
              <template #default="{ row }">{{ operatorLabels[row.defaultOperator] }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="查询预览" name="preview">
          <el-alert title="预览需要同时拥有该业务列表权限；预览不会改变已发布配置。" :closable="false" />
          <template v-if="previewMetadata">
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
            <el-table :data="previewRows" border class="field-table">
              <el-table-column
                v-for="field in previewColumns"
                :key="field.fieldKey"
                :prop="field.fieldKey"
                :label="field.label"
                min-width="160"
                show-overflow-tooltip
              />
            </el-table>
          </template>
          <el-empty v-else description="保存草稿后，点击预览已保存草稿" />
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
  </div>
</template>
<script setup lang="ts" name="QueryDefinitionEditor">
import { computed, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as api from '@/api/system/query'
import QueryPanel from '@/components/query/QueryPanel.vue'
import { buildRequest, clone, operatorLabels } from '@/components/query/useQueryDefinition'
import type { DefinitionDetail, DraftField, QueryMetadata, QuerySelection } from '@/types/api/system/query'
const route = useRoute(),
  id = Number(route.params.id),
  detail = ref<DefinitionDetail>(),
  loading = ref(false),
  saving = ref(false),
  tab = ref('fields'),
  saved = ref('')
const dirty = computed(() => Boolean(detail.value) && JSON.stringify(detail.value) !== saved.value)
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
  previewSelection = ref<QuerySelection>({ values: {} })
let previewSequence = 0
async function preview(selection: QuerySelection = { values: {} }) {
  if (dirty.value) return
  const current = ++previewSequence
  previewLoading.value = true
  try {
    const request = previewMetadata.value
      ? buildRequest(previewMetadata.value, { pageNum: 1, pageSize: 20 }, selection.values, selection.advanced)
      : { pageNum: 1, pageSize: 20, configVersion: 0 }
    const { data } = await api.previewQuery(id, request)
    if (current !== previewSequence) return
    previewMetadata.value = data.metadata
    previewRows.value = data.result.rows
    previewTotal.value = data.result.total
    previewSelection.value = selection
    tab.value = 'preview'
  } catch {
    /* 保留最后成功预览。 */
  } finally {
    if (current === previewSequence) previewLoading.value = false
  }
}
const previewColumns = computed(
  () =>
    previewMetadata.value?.fields
      .filter((f) => f.sourceKey === 'main' && previewRows.value.some((row) => f.fieldKey in row))
      .slice(0, 8) || []
)
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
.editor :deep(.el-tabs__content) {
  overflow: visible;
}
</style>

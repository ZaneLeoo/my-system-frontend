<template>
  <div class="app-container" v-loading="loading">
    <div class="toolbar">
      <span>数据目录仅维护查询元数据，不修改业务表结构。</span>
      <div>
        <el-button v-hasPermi="['query:metadata:import']" type="primary" @click="openImport">导入业务表</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
    </div>
    <vxe-table :data="tables" border stripe :column-config="{ resizable: true }" @cell-click="selectTable">
      <vxe-column field="displayName" title="中文名称" min-width="160" />
      <vxe-column field="tableName" title="数据库表名" min-width="210" />
      <vxe-column field="available" title="状态" width="100">
        <template #default="{ row }">{{ row.available ? '可用' : '失效' }}</template>
      </vxe-column>
      <vxe-column field="synchronizedTime" title="同步时间" width="200" />
      <vxe-column title="操作" width="340">
        <template #default="{ row }">
          <template v-if="checkPermi(['query:definition:list'])">
            <el-button
              v-if="linksFor(row).length === 1"
              link
              type="primary"
              @click.stop="openDefinition(linksFor(row)[0])"
            >
              配置查询
            </el-button>
            <el-dropdown v-else-if="linksFor(row).length > 1" trigger="click" @command="openDefinition">
              <el-button link type="primary" @click.stop>配置查询</el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-for="link in linksFor(row)" :key="link.definitionId" :command="link">
                    {{ link.displayName }}（{{ link.sourceLabel }}）
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
          <el-button link type="primary" @click.stop="showColumns(row)">字段</el-button>
          <el-button v-hasPermi="['query:metadata:edit']" link @click.stop="rename(row)">修改名称</el-button>
          <el-button v-hasPermi="['query:metadata:sync']" link type="primary" @click.stop="showSync(row)">
            预览同步
          </el-button>
        </template>
      </vxe-column>
    </vxe-table>
    <template v-if="selected">
      <el-divider content-position="left">{{ selected.displayName }} · 字段目录</el-divider>
      <vxe-table :data="columns" border stripe max-height="500" :column-config="{ resizable: true }">
        <vxe-column field="displayName" title="显示名称" min-width="180" />
        <vxe-column field="columnName" title="字段名" min-width="170" />
        <vxe-column field="columnType" title="数据库类型" width="160" />
        <vxe-column title="查询类型" width="130">
          <template #default="{ row }">{{ dataTypeLabels[row.dataType] || row.dataType }}</template>
        </vxe-column>
        <vxe-column title="状态" width="100">
          <template #default="{ row }">{{ row.available ? '可用' : '失效' }}</template>
        </vxe-column>
        <vxe-column title="操作" width="120">
          <template #default="{ row }">
            <el-button v-hasPermi="['query:metadata:edit']" link @click="rename(selected!, row)">修改名称</el-button>
          </template>
        </vxe-column>
      </vxe-table>
    </template>
    <el-dialog v-model="importOpen" title="导入业务表" width="600px">
      <el-select v-model="importName" filterable placeholder="选择已登记业务表" style="width: 100%">
        <el-option
          v-for="table in candidates"
          :key="table.tableName"
          :label="`${table.tableComment}（${table.tableName}）`"
          :value="table.tableName"
        />
      </el-select>
      <template #footer>
        <el-button @click="importOpen = false">取消</el-button>
        <el-button type="primary" :disabled="!importName" :loading="saving" @click="importTable">导入</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="syncOpen" title="目录同步预览" width="900px">
      <template v-if="syncPreview">
        <el-alert
          title="同步不会更改业务表；已删除或类型变化的字段可能使已发布查询失效，需要重新配置并发布。"
          type="warning"
          :closable="false"
        />
        <p>影响查询：{{ syncPreview.references.map((r) => r.displayName).join('、') || '无' }}</p>
        <el-table :data="differences">
          <el-table-column prop="change" label="变化" width="100" />
          <el-table-column prop="columnName" label="字段" />
          <el-table-column prop="columnType" label="当前类型" />
          <el-table-column prop="displayName" label="说明" />
        </el-table>
        <el-empty v-if="!differences.length" description="数据库结构与目录一致" />
      </template>
      <template #footer>
        <el-button @click="syncOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="applySync">确认同步目录</el-button>
      </template>
    </el-dialog>
  </div>
</template>
<script setup lang="ts" name="QueryMetadataCatalog">
import { useVxe } from '@/plugins/vxe'
useVxe()
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as api from '@/api/system/query'
import { checkPermi } from '@/utils/permission'
import type { MetadataTable, MetadataColumn, QueryDefinitionLink, SyncPreview } from '@/types/api/system/query'
const router = useRouter()
const dataTypeLabels: Record<string, string> = {
  STRING: '文本',
  INTEGER: '整数',
  DECIMAL: '小数',
  BOOLEAN: '是／否',
  DATE: '日期',
  DATETIME: '日期时间',
  UNSUPPORTED: '暂不支持'
}
const tables = ref<MetadataTable[]>([]),
  columns = ref<MetadataColumn[]>([]),
  selected = ref<MetadataTable>(),
  definitionLinks = ref<QueryDefinitionLink[]>([])
const loading = ref(false),
  saving = ref(false),
  importOpen = ref(false),
  syncOpen = ref(false),
  importName = ref('')
const candidates = ref<{ tableName: string; tableComment: string }[]>([]),
  syncPreview = ref<SyncPreview>(),
  syncTable = ref<MetadataTable>()
let sequence = 0,
  columnsSequence = 0
async function load() {
  const current = ++sequence
  loading.value = true
  try {
    const { data } = await api.getMetadataTables()
    if (current !== sequence) return
    tables.value = data
    if (checkPermi(['query:definition:list'])) {
      try {
        const links = (await api.getMetadataDefinitionLinks()).data
        if (current === sequence) definitionLinks.value = links
      } catch {
        /* 保留上次查询配置入口。 */
      }
    }
    if (selected.value) {
      selected.value = data.find((t) => t.tableId === selected.value?.tableId)
      if (selected.value) await showColumns(selected.value)
    }
  } catch {
    /* 保留上次结果。 */
  } finally {
    if (current === sequence) loading.value = false
  }
}
function linksFor(table: MetadataTable): QueryDefinitionLink[] {
  return definitionLinks.value.filter((link) => link.tableId === table.tableId)
}
function openDefinition(link: QueryDefinitionLink) {
  void router.push(`/query-definition/${link.definitionId}`)
}
async function showColumns(table: MetadataTable) {
  const current = ++columnsSequence
  try {
    const { data } = await api.getMetadataColumns(table.tableId)
    if (current !== columnsSequence) return
    selected.value = table
    columns.value = data
  } catch {
    /* 保留字段列表。 */
  }
}
function selectTable({ row }: { row: MetadataTable }) {
  void showColumns(row)
}
async function openImport() {
  try {
    candidates.value = (await api.getMetadataCandidates()).data
    importName.value = ''
    importOpen.value = true
  } catch {
    /* 请求层提示。 */
  }
}
async function importTable() {
  saving.value = true
  try {
    await api.importMetadataTable(importName.value)
    importOpen.value = false
    ElMessage.success('目录已导入')
    await load()
  } catch {
    /* 保留选择。 */
  } finally {
    saving.value = false
  }
}
async function rename(table: MetadataTable, column?: MetadataColumn) {
  try {
    const result = await ElMessageBox.prompt('请输入中文显示名称', '修改名称', {
      inputValue: column?.displayName || table.displayName,
      inputValidator: (v: string) => Boolean(v?.trim() && v.trim().length <= 100) || '请输入 1～100 个字符'
    })
    await api.renameMetadata(table.tableId, table.version, result.value, column?.columnId)
    await load()
  } catch {
    /* 取消或失败保留数据。 */
  }
}
async function showSync(table: MetadataTable) {
  try {
    syncPreview.value = (await api.previewMetadataSync(table.tableId)).data
    syncTable.value = table
    syncOpen.value = true
  } catch {
    /* 请求层提示。 */
  }
}
const differences = computed(() =>
  syncPreview.value
    ? [
        ...syncPreview.value.added.map((c) => ({ ...c, change: '新增' })),
        ...syncPreview.value.changed.map((c) => ({ ...c, change: '变更' })),
        ...syncPreview.value.removed.map((c) => ({ ...c, change: '失效' }))
      ]
    : []
)
async function applySync() {
  if (!syncTable.value || !syncPreview.value) return
  saving.value = true
  try {
    await api.applyMetadataSync(syncTable.value.tableId, syncPreview.value.version, syncPreview.value.signature)
    syncOpen.value = false
    ElMessage.success('数据目录同步完成')
    await load()
  } catch {
    /* 失败需重新预览，不丢失原结果。 */
  } finally {
    saving.value = false
  }
}
onMounted(() => void load())
</script>
<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
</style>

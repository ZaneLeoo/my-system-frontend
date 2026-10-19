<template>
  <div class="app-container" v-loading="loading">
    <el-form :inline="true" @submit.prevent="handleQuery">
      <el-form-item label="名称 / 表名">
        <el-input
          v-model="tableKeyword"
          clearable
          maxlength="200"
          placeholder="查询中文名称或数据库表名"
          style="width: 280px"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" native-type="submit">查询</el-button>
        <el-button @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>
    <div class="toolbar">
      <span>共 {{ total }} 个数据表</span>
      <div>
        <el-button v-hasPermi="['query:metadata:import']" type="primary" @click="openImport">导入业务表</el-button>
        <el-button @click="load()">刷新</el-button>
      </div>
    </div>
    <vxe-table :data="tables" border stripe :column-config="{ resizable: true }">
      <vxe-column field="displayName" title="中文名称" min-width="160" />
      <vxe-column field="tableName" title="数据库表名" min-width="210" />
      <vxe-column field="available" title="状态" width="100">
        <template #default="{ row }">{{ row.available ? '可用' : '失效' }}</template>
      </vxe-column>
      <vxe-column field="queryRegistered" title="查询接入" width="140">
        <template #default="{ row }">
          <el-tag :type="row.queryRegistered ? 'success' : 'info'">
            {{ row.queryRegistered ? '已接入查询' : '未接入查询' }}
          </el-tag>
        </template>
      </vxe-column>
      <vxe-column field="synchronizedTime" title="同步时间" width="200" />
      <vxe-column title="操作" width="220">
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
          <el-button v-hasPermi="['query:metadata:sync']" link type="primary" @click.stop="showSync(row)">
            预览同步
          </el-button>
        </template>
      </vxe-column>
      <template #empty><el-empty description="没有符合条件的数据表" :image-size="70" /></template>
    </vxe-table>
    <el-pagination
      v-model:current-page="pagination.pageNum"
      v-model:page-size="pagination.pageSize"
      class="query-pagination"
      background
      layout="total, sizes, prev, pager, next, jumper"
      :total="total"
      :page-sizes="[10, 20, 50, 100]"
      :disabled="loading"
      @change="changePage"
    />
    <el-dialog v-model="importOpen" title="导入业务表" width="600px">
      <el-select v-model="importName" filterable placeholder="选择已登记业务表" style="width: 100%">
        <el-option
          v-for="table in candidates"
          :key="table.tableName"
          :label="`${table.displayName}（${table.tableName}）${table.imported ? ' · 已导入' : ''}`"
          :value="table.tableName"
          :disabled="table.imported"
        />
      </el-select>
      <p v-if="candidates.length && candidates.every((table) => table.imported)">
        <el-text type="info">已登记业务表均已导入，字段变化请使用“预览同步”。</el-text>
      </p>
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
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import * as api from '@/api/system/query'
import { checkPermi } from '@/utils/permission'
import type {
  MetadataTable,
  MetadataTableRow,
  MetadataCandidate,
  MetadataTableQuery,
  QueryDefinitionLink,
  SyncPreview
} from '@/types/api/system/query'
const router = useRouter()
const tables = ref<MetadataTableRow[]>([]),
  definitionLinks = ref<QueryDefinitionLink[]>([]),
  tableKeyword = ref(''),
  total = ref(0),
  appliedQuery = ref<MetadataTableQuery>({ pageNum: 1, pageSize: 20 })
const pagination = reactive({ pageNum: 1, pageSize: 20 })
const loading = ref(false),
  saving = ref(false),
  importOpen = ref(false),
  syncOpen = ref(false),
  importName = ref('')
const candidates = ref<MetadataCandidate[]>([]),
  syncPreview = ref<SyncPreview>(),
  syncTable = ref<MetadataTable>()
let sequence = 0
async function load(query: MetadataTableQuery = appliedQuery.value) {
  const requested = { ...query }
  const current = ++sequence
  loading.value = true
  try {
    const { data } = await api.getMetadataTables(requested)
    if (current !== sequence) return
    const lastPage = Math.max(1, Math.ceil(data.total / requested.pageSize))
    if (requested.pageNum > lastPage) {
      await load({ ...requested, pageNum: lastPage })
      return
    }
    let links = definitionLinks.value.filter((link) => data.rows.some((row) => row.tableId === link.tableId))
    if (checkPermi(['query:definition:list']) && data.rows.length) {
      try {
        links = (await api.getMetadataDefinitionLinks(data.rows.map((row) => row.tableId))).data
      } catch {
        /* 保留上次查询配置入口。 */
      }
    }
    if (current !== sequence) return
    tables.value = data.rows
    total.value = data.total
    definitionLinks.value = links
    appliedQuery.value = requested
    tableKeyword.value = requested.keyword || ''
    Object.assign(pagination, { pageNum: requested.pageNum, pageSize: requested.pageSize })
  } catch {
    if (current !== sequence) return
    tableKeyword.value = appliedQuery.value.keyword || ''
    Object.assign(pagination, { pageNum: appliedQuery.value.pageNum, pageSize: appliedQuery.value.pageSize })
    /* 保留上次成功结果及其查询条件。 */
  } finally {
    if (current === sequence) loading.value = false
  }
}
function handleQuery() {
  void load({ ...appliedQuery.value, pageNum: 1, keyword: tableKeyword.value.trim() || undefined })
}
function resetQuery() {
  tableKeyword.value = ''
  void load({ pageNum: 1, pageSize: appliedQuery.value.pageSize })
}
function changePage(pageNum: number, pageSize: number) {
  void load({ ...appliedQuery.value, pageNum: pageSize !== appliedQuery.value.pageSize ? 1 : pageNum, pageSize })
}
function linksFor(table: MetadataTable): QueryDefinitionLink[] {
  return definitionLinks.value.filter((link) => link.tableId === table.tableId)
}
function openDefinition(link: QueryDefinitionLink) {
  void router.push(`/query-definition/${link.definitionId}`)
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
  flex-wrap: wrap;
}
.query-pagination {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}
</style>

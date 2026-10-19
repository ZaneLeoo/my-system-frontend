<template>
  <div class="app-container" v-loading="loading">
    <div class="toolbar">
      <span>保存草稿不会改变业务页面；校验并发布后生效。</span>
      <el-button @click="load">刷新</el-button>
    </div>
    <vxe-table :data="rows" border stripe :column-config="{ resizable: true }">
      <vxe-column field="displayName" title="查询对象" min-width="180" />
      <vxe-column field="queryKey" title="对象编码" min-width="200" />
      <vxe-column field="draftVersion" title="草稿版本" width="120" />
      <vxe-column field="publishedRevision" title="发布版本" width="120" />
      <vxe-column title="操作" width="220">
        <template #default="{ row }">
          <el-button link type="primary" @click="router.push(`/query-definition/${row.definitionId}`)">
            配置查询
          </el-button>
          <el-button link @click="history(row)">发布记录</el-button>
        </template>
      </vxe-column>
    </vxe-table>
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
<script setup lang="ts" name="QueryDefinitions">
import { useVxe } from '@/plugins/vxe'
useVxe()
import { onMounted, onActivated, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getQueryDefinitions, getQueryReleases } from '@/api/system/query'
import type { QueryDefinition, QueryRelease } from '@/types/api/system/query'
const router = useRouter(),
  rows = ref<QueryDefinition[]>([]),
  releases = ref<QueryRelease[]>([]),
  loading = ref(false),
  historyOpen = ref(false),
  snapshot = ref('')
let sequence = 0,
  activated = false
async function load() {
  const current = ++sequence
  loading.value = true
  try {
    const { data } = await getQueryDefinitions()
    if (current === sequence) rows.value = data
  } catch {
    /* 保留结果。 */
  } finally {
    if (current === sequence) loading.value = false
  }
}
async function history(row: QueryDefinition) {
  try {
    releases.value = (await getQueryReleases(row.definitionId)).data
    snapshot.value = ''
    historyOpen.value = true
  } catch {
    /* 请求层提示。 */
  }
}
onMounted(() => void load())
onActivated(() => {
  if (activated) void load()
  activated = true
})
</script>
<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  color: var(--el-text-color-secondary);
}
.snapshot {
  max-height: 450px;
  overflow: auto;
  white-space: pre-wrap;
  background: var(--el-fill-color-light);
  padding: 16px;
}
</style>

<template>
  <div class="app-container">
    <el-form inline @submit.prevent="search">
      <el-form-item label="业务场景">
        <el-select v-model="draft.businessType" clearable placeholder="全部可访问场景" style="width: 200px">
          <el-option
            v-for="item in accessibleScenarios"
            :key="item.businessType"
            :value="item.businessType"
            :label="item.name"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="签署状态">
        <el-select v-model="draft.status" clearable placeholder="全部状态" style="width: 170px">
          <el-option v-for="(label, value) in signingStatusLabels" :key="value" :value="value" :label="label" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" native-type="submit" :loading="loading">查询</el-button>
        <el-button :disabled="loading" @click="reset">重置</el-button>
      </el-form-item>
    </el-form>
    <el-alert v-if="error" :title="error" type="error" :closable="false" class="page-error" />
    <div class="task-toolbar">
      <span>共 {{ total }} 个签署任务</span>
      <div class="task-actions">
        <template v-if="auth.hasPermi('signing:task:start')">
          <el-select v-model="launchType" placeholder="选择发起场景" style="width: 180px" :disabled="launching">
            <el-option
              v-for="item in accessibleScenarios"
              :key="item.businessType"
              :label="item.name"
              :value="item.businessType"
            />
          </el-select>
          <el-button type="primary" :disabled="!launchType" :loading="launching" @click="sourceDialogVisible = true">
            发起签署
          </el-button>
        </template>
        <el-button :disabled="loading" @click="load()">刷新</el-button>
      </div>
    </div>
    <vxe-table
      :data="rows"
      :loading="loading"
      border
      stripe
      show-overflow
      max-height="640"
      :row-config="{ keyField: 'id', isHover: true }"
      :column-config="{ resizable: true, drag: true }"
      :column-drag-config="{ trigger: 'default', showIcon: true }"
    >
      <vxe-column field="title" title="合同标题" min-width="320">
        <template #default="{ row }">
          <el-button link type="primary" @click="open(row.id)">{{ row.title }}</el-button>
        </template>
      </vxe-column>
      <vxe-column field="businessName" title="业务场景" width="150" />
      <vxe-column field="status" title="签署状态" width="140">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)">{{ signingStatusLabels[row.status as SigningStatus] }}</el-tag>
        </template>
      </vxe-column>
      <vxe-column field="createBy" title="发起人" width="140" />
      <vxe-column field="createTime" title="创建时间" width="200" />
      <vxe-column field="updateTime" title="修改时间" width="200" />
      <vxe-column title="操作" fixed="right" width="110">
        <template #default="{ row }"><el-button link type="primary" @click="open(row.id)">详情</el-button></template>
      </vxe-column>
      <template #empty><el-empty description="暂无有权查看的签署任务" :image-size="80" /></template>
    </vxe-table>
    <el-pagination
      :current-page="applied.pageNum"
      :page-size="applied.pageSize"
      :total="total"
      :page-sizes="[10, 20, 50, 100]"
      :disabled="loading"
      background
      layout="total, sizes, prev, pager, next, jumper"
      class="task-pagination"
      @change="page"
    />
    <SigningSourcePickerDialog
      v-model="sourceDialogVisible"
      :business-type="launchType"
      :business-name="scenarios.find((item) => item.businessType === launchType)?.name ?? ''"
      @select="launch"
    />
  </div>
</template>
<script setup lang="ts" name="SigningTaskList">
import { computed, onActivated, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import auth from '@/plugins/auth'
import { useVxe } from '@/plugins/vxe'
import { signingScenarios, signingTasks } from '@/api/signing'
import { beginBusinessSigning } from '@/integrations/signing/businesses'
import SigningSourcePickerDialog from '@/components/signing/SigningSourcePickerDialog/index.vue'
import { signingStatusLabels } from '@/types/api/signing'
import type { SigningScenario, SigningSource, SigningStatus, SigningTaskSummary } from '@/types/api/signing'
useVxe()
const router = useRouter()
type TaskQuery = Parameters<typeof signingTasks>[0]
const draft = ref<{ businessType: string; status: SigningStatus | '' }>({ businessType: '', status: '' })
const applied = ref<TaskQuery>({ pageNum: 1, pageSize: 20 })
const rows = ref<SigningTaskSummary[]>([])
const total = ref(0)
const error = ref('')
const loading = ref(false)
const launching = ref(false)
const scenarios = ref<SigningScenario[]>([])
const accessibleScenarios = computed(() => scenarios.value.filter((item) => item.accessible))
const launchType = ref('')
const sourceDialogVisible = ref(false)
let sequence = 0
let initialized = false
async function load(query: TaskQuery = applied.value) {
  const current = ++sequence
  loading.value = true
  try {
    const { data } = await signingTasks(query)
    if (current !== sequence) return
    const last = Math.max(1, Math.ceil(data.total / query.pageSize))
    if (query.pageNum > last) {
      await load({ ...query, pageNum: last })
      return
    }
    rows.value = data.rows
    total.value = data.total
    applied.value = { ...query }
    error.value = ''
  } catch (cause) {
    if (current === sequence) error.value = cause instanceof Error ? cause.message : '签署任务加载失败，请重试'
  } finally {
    if (current === sequence) loading.value = false
  }
}
function search() {
  void load({
    ...applied.value,
    pageNum: 1,
    businessType: draft.value.businessType || undefined,
    status: draft.value.status || undefined
  })
}
function reset() {
  draft.value = { businessType: '', status: '' }
  void load({ pageNum: 1, pageSize: applied.value.pageSize })
}
function page(pageNum: number, pageSize: number) {
  void load({ ...applied.value, pageNum: applied.value.pageSize === pageSize ? pageNum : 1, pageSize })
}
function open(id: string) {
  void router.push(`/signing/task/${id}`)
}
function statusType(status: SigningStatus) {
  if (status === 'COMPLETED') return 'success'
  if (['REJECTED', 'REVOKED', 'EXPIRED'].includes(status)) return 'danger'
  return status === 'SIGNING' ? 'primary' : 'info'
}
async function launch(source: SigningSource) {
  launching.value = true
  try {
    await beginBusinessSigning(router, launchType.value, source.id)
  } catch {
    ElMessage.error('检查签署资格失败，请重试')
  } finally {
    launching.value = false
  }
}
onMounted(async () => {
  try {
    scenarios.value = (await signingScenarios()).data
    launchType.value = accessibleScenarios.value[0]?.businessType ?? ''
  } catch {
    error.value = '业务场景加载失败，请刷新页面重试'
  }
  await load()
  initialized = true
})
onActivated(() => {
  if (initialized) void load()
})
onBeforeUnmount(() => {
  ++sequence
})
</script>
<style scoped>
.task-toolbar,
.task-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.task-toolbar {
  justify-content: space-between;
  margin-bottom: 16px;
  color: var(--el-text-color-secondary);
}
.task-pagination {
  justify-content: flex-end;
  margin-top: 18px;
}
.page-error {
  margin-bottom: 16px;
}
</style>

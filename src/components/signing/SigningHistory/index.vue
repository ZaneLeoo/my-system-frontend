<template>
  <section v-loading="loading" class="signing-history">
    <div class="toolbar">
      <strong>电子签署</strong>
      <el-button @click="load">刷新签署记录</el-button>
    </div>
    <el-alert v-if="error" :title="error" type="warning" :closable="false" />
    <el-empty v-if="!loading && !error && !rows.length" description="暂无电子签署记录" :image-size="72" />
    <vxe-table v-if="rows.length" :data="rows" border stripe show-overflow max-height="320">
      <vxe-column field="title" title="合同" min-width="240" />
      <vxe-column field="status" title="签署状态" width="120">
        <template #default="{ row }">{{ signingStatusLabels[row.status as SigningStatus] }}</template>
      </vxe-column>
      <vxe-column field="operationStatus" title="处理状态" width="140">
        <template #default="{ row }">{{ operationLabels[row.operationStatus as OperationStatus] }}</template>
      </vxe-column>
      <vxe-column field="createBy" title="发起人" width="120" />
      <vxe-column field="updateTime" title="最后修改时间" width="180" />
      <vxe-column title="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="router.push(`/signing/task/${row.id}`)">详情</el-button>
        </template>
      </vxe-column>
    </vxe-table>
  </section>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { signingHistory } from '@/api/signing'
import { signingStatusLabels, operationLabels } from '@/types/api/signing'
import type { SigningTask, SigningStatus, OperationStatus } from '@/types/api/signing'
import { useVxe } from '@/plugins/vxe'
useVxe()
const props = defineProps<{ businessType: string; businessId: string }>()
const router = useRouter()
const rows = ref<SigningTask[]>([])
const loading = ref(false)
const error = ref('')
let sequence = 0
async function load() {
  const request = ++sequence
  loading.value = true
  try {
    const result = await signingHistory(props.businessType, props.businessId)
    if (request === sequence) {
      rows.value = result.data
      error.value = ''
    }
  } catch {
    if (request === sequence) {
      error.value = '签署记录加载失败，可重试'
    }
  } finally {
    if (request === sequence) {
      loading.value = false
    }
  }
}
watch(() => [props.businessType, props.businessId], load, { immediate: true })
</script>
<style scoped lang="scss">
.signing-history {
  margin-top: 24px;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
</style>

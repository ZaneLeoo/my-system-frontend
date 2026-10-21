<template>
  <el-dialog
    :model-value="modelValue"
    :title="`选择${businessName || '来源单据'}`"
    width="min(1060px, 96vw)"
    append-to-body
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-alert v-if="error" :title="error" type="error" :closable="false" class="source-error" />
    <el-form inline @submit.prevent="search">
      <el-form-item label="单据号">
        <el-input v-model="keyword" clearable maxlength="64" placeholder="输入单据号查询" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" native-type="submit" :loading="loading">查询</el-button>
        <el-button :disabled="loading" @click="reset">重置</el-button>
      </el-form-item>
    </el-form>
    <vxe-table
      :data="rows"
      :loading="loading"
      border
      stripe
      show-overflow
      max-height="420"
      :row-config="{ keyField: 'id', isHover: true }"
      @cell-click="selectRow"
    >
      <vxe-column title="选择" width="64" align="center">
        <template #default="{ row }">
          <el-radio
            :model-value="choice?.id"
            :value="row.id"
            :aria-label="`选择${row.number}`"
            @change="choice = row"
          />
        </template>
      </vxe-column>
      <vxe-column field="number" title="来源单据号" min-width="240" />
      <vxe-column field="businessDate" title="单据日期" width="140" />
      <vxe-column field="counterpartyName" title="相对方" min-width="220" />
      <vxe-column field="title" title="合同标题" min-width="240" />
      <template #empty><el-empty description="暂无有权读取且满足发起条件的单据" :image-size="70" /></template>
    </vxe-table>
    <el-pagination
      :current-page="applied.pageNum"
      :page-size="applied.pageSize"
      :total="total"
      :page-sizes="[10, 20, 50]"
      :disabled="loading"
      background
      layout="total, sizes, prev, pager, next, jumper"
      class="source-pagination"
      @change="page"
    />
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :disabled="!choice || loading" @click="confirm">确认选择</el-button>
    </template>
  </el-dialog>
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { signingSources } from '@/api/signing'
import type { SigningSource } from '@/types/api/signing'
import type { VxeTableDefines } from 'vxe-table'
import { useVxe } from '@/plugins/vxe'
useVxe()
const props = defineProps<{
  modelValue: boolean
  businessType: string
  businessName: string
  selected?: SigningSource | null
}>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; select: [value: SigningSource] }>()
const rows = ref<SigningSource[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const keyword = ref('')
const choice = ref<SigningSource | null>(null)
const applied = ref({ pageNum: 1, pageSize: 20, keyword: '' })
let sequence = 0
async function load(query = applied.value) {
  const current = ++sequence
  const type = props.businessType
  loading.value = true
  try {
    const { data } = await signingSources(type, query)
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
    if (current === sequence) error.value = cause instanceof Error ? cause.message : '读取来源失败，请重试'
  } finally {
    if (current === sequence) loading.value = false
  }
}
function search() {
  void load({ ...applied.value, pageNum: 1, keyword: keyword.value.trim() })
}
function reset() {
  keyword.value = ''
  void load({ ...applied.value, pageNum: 1, keyword: '' })
}
function page(pageNum: number, pageSize: number) {
  void load({ ...applied.value, pageNum: pageSize === applied.value.pageSize ? pageNum : 1, pageSize })
}
function selectRow({ row }: VxeTableDefines.CellClickEventParams<SigningSource>) {
  choice.value = row
}
function confirm() {
  if (!choice.value || loading.value) return
  emit('select', choice.value)
  emit('update:modelValue', false)
}
watch(
  () => [props.modelValue, props.businessType] as const,
  ([visible]) => {
    ++sequence
    loading.value = false
    if (!visible) return
    rows.value = []
    total.value = 0
    choice.value = props.selected ?? null
    keyword.value = ''
    error.value = ''
    if (props.businessType) void load({ pageNum: 1, pageSize: 20, keyword: '' })
  },
  { immediate: true }
)
onBeforeUnmount(() => {
  ++sequence
})
</script>
<style scoped>
.source-error {
  margin-bottom: 14px;
}
.source-pagination {
  justify-content: flex-end;
  margin-top: 16px;
}
</style>

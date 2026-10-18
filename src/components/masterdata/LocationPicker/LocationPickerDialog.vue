<template>
  <el-dialog
    :model-value="modelValue"
    title="选择货位"
    width="min(900px,96vw)"
    append-to-body
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form inline :model="draft" @submit.prevent="search">
      <el-form-item label="编码 / 名称">
        <el-input v-model="draft.keyword" placeholder="搜索货位" clearable maxlength="100" :validate-event="false" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" native-type="submit" :loading="loading">查询</el-button>
        <el-button :disabled="loading" @click="reset">重置</el-button>
        <el-button v-if="failed" text type="danger" @click="load()">重试</el-button>
      </el-form-item>
    </el-form>
    <vxe-table
      ref="table"
      :data="rows"
      :loading="loading"
      border
      show-overflow
      max-height="420"
      :row-config="{ keyField: 'locationId', isHover: true }"
      :column-config="{ resizable: true }"
      :sort-config="{ remote: true }"
      @sort-change="sort"
      @radio-change="selectRow"
      @cell-dblclick="doubleClick"
    >
      <vxe-column type="radio" width="54" />
      <vxe-column field="locationCode" title="货位编码" min-width="180" sortable />
      <vxe-column field="locationName" title="货位名称" min-width="220" sortable />
    </vxe-table>
    <el-pagination
      v-model:current-page="pager.pageNum"
      v-model:page-size="pager.pageSize"
      :total="total"
      :page-sizes="[20, 50, 100]"
      layout="total,sizes,prev,pager,next"
      :disabled="loading"
      @change="paginate"
    />
    <template #footer>
      <span class="selection">{{ chosen ? `${chosen.locationCode} / ${chosen.locationName}` : '尚未选择货位' }}</span>
      <el-button :disabled="confirming" @click="emit('update:modelValue', false)">取消</el-button>
      <el-button
        type="primary"
        :loading="confirming"
        :disabled="!chosen || loading || chosen.status !== '0'"
        @click="confirm"
      >
        确认选择
      </el-button>
    </template>
  </el-dialog>
</template>
<script setup lang="ts">
import { nextTick, onBeforeUnmount, reactive, ref, shallowRef, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { VxeTableDefines, VxeTableInstance } from 'vxe-table'
import {
  searchLocationReferences,
  resolveLocationReferences,
  getLocationWarehouseContext
} from '@/api/masterdata/storage-reference'
import type { LocationReference, LocationReferenceQuery } from '@/types/api/masterdata/storage-reference'
import { useVxe } from '@/plugins/vxe'
useVxe()
const props = defineProps<{ modelValue: boolean; selectedRecord?: LocationReference; warehouseId: number | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; confirm: [row: LocationReference] }>()
const table = ref<VxeTableInstance<LocationReference>>(),
  rows = shallowRef<LocationReference[]>([]),
  chosen = shallowRef<LocationReference>()
const draft = reactive({ keyword: '' }),
  pager = reactive({ pageNum: 1, pageSize: 20 })
const applied = ref<LocationReferenceQuery>({ pageNum: 1, pageSize: 20, warehouseId: props.warehouseId ?? 0 }),
  total = ref(0),
  loading = ref(false),
  failed = ref(false),
  confirming = ref(false)
let alive = true,
  sequence = 0,
  confirmation = 0
async function sync(current: number) {
  await nextTick()
  if (!alive || current !== sequence || !props.modelValue) return
  await table.value?.clearRadioRow()
  const visible = rows.value.find((row) => row.locationId === chosen.value?.locationId)
  if (visible) await table.value?.setRadioRow(visible)
  if (applied.value.sortField) await table.value?.sort(applied.value.sortField, applied.value.sortDirection)
  else await table.value?.clearSort()
}
async function load(query: LocationReferenceQuery = applied.value) {
  const current = ++sequence,
    requested = { ...query, warehouseId: props.warehouseId! }
  if (!props.modelValue || !props.warehouseId) return
  loading.value = true
  try {
    const { data } = await searchLocationReferences(requested)
    if (!alive || current !== sequence || !props.modelValue) return
    const last = Math.max(1, Math.ceil(data.total / requested.pageSize))
    if (requested.pageNum > last) {
      await load({ ...requested, pageNum: last })
      return
    }
    rows.value = data.rows
    total.value = data.total
    applied.value = requested
    Object.assign(pager, { pageNum: requested.pageNum, pageSize: requested.pageSize })
    draft.keyword = requested.keyword ?? ''
    failed.value = false
    const updated = data.rows.find((row) => row.locationId === chosen.value?.locationId)
    if (updated) chosen.value = updated
  } catch {
    if (alive && current === sequence) {
      failed.value = true
      Object.assign(pager, { pageNum: applied.value.pageNum, pageSize: applied.value.pageSize })
      draft.keyword = applied.value.keyword ?? ''
    }
  } finally {
    if (alive && current === sequence) {
      loading.value = false
      await sync(current)
    }
  }
}
function search() {
  void load({ ...applied.value, keyword: draft.keyword.trim() || undefined, pageNum: 1 })
}
function reset() {
  void load({ pageNum: 1, pageSize: applied.value.pageSize, warehouseId: props.warehouseId ?? 0 })
}
function paginate(pageNum: number, pageSize: number) {
  void load({ ...applied.value, pageNum: pageSize !== applied.value.pageSize ? 1 : pageNum, pageSize })
}
function sort({ field, order }: VxeTableDefines.SortChangeEventParams<LocationReference>) {
  if (field !== 'locationCode' && field !== 'locationName') return
  void load({ ...applied.value, pageNum: 1, sortField: order ? field : undefined, sortDirection: order || undefined })
}
function selectRow({ row }: VxeTableDefines.RadioChangeEventParams<LocationReference>) {
  chosen.value = row
}
function doubleClick({ row }: VxeTableDefines.CellDblclickEventParams<LocationReference>) {
  if (row) {
    chosen.value = row
    void confirm()
  }
}
async function confirm() {
  if (!chosen.value || confirming.value || loading.value) return
  const current = ++confirmation,
    id = chosen.value.locationId
  confirming.value = true
  try {
    const { data: parent } = await getLocationWarehouseContext(props.warehouseId!)
    if (parent.status !== '0' || !parent.locationEnabled) {
      ElMessage.warning('所属仓库已停用或未启用货位管理，请重新选择')
      return
    }
    const { data } = await resolveLocationReferences(props.warehouseId!, [id])
    if (!alive || current !== confirmation || !props.modelValue) return
    const record = data[0]
    if (!record || record.status !== '0') {
      ElMessage.warning('货位已失效或停用，请重新选择')
      return
    }
    emit('confirm', record)
    emit('update:modelValue', false)
  } catch {
    if (alive && current === confirmation) ElMessage.warning('确认失败，选择已保留，请重试')
  } finally {
    if (alive && current === confirmation) confirming.value = false
  }
}
watch(
  () => props.modelValue,
  (open) => {
    sequence++
    confirmation++
    confirming.value = false
    if (open) {
      chosen.value = props.selectedRecord
      rows.value = []
      total.value = 0
      applied.value = { pageNum: 1, pageSize: 20, warehouseId: props.warehouseId ?? 0 }
      draft.keyword = ''
      void load()
    } else loading.value = false
  }
)
onBeforeUnmount(() => {
  alive = false
  sequence++
  confirmation++
})
</script>
<style scoped>
.selection {
  float: left;
  color: var(--el-text-color-secondary);
}
.el-pagination {
  margin-top: 16px;
}
</style>

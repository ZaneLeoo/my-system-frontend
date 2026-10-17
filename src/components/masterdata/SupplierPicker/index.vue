<template>
  <div class="supplier-picker">
    <el-select
      v-bind="$attrs"
      :model-value="modelValue ?? undefined"
      filterable
      :filter-method="filter"
      :clearable="clearable"
      :disabled="inheritedDisabled"
      :loading="loading"
      :placeholder="placeholder"
      :validate-event="false"
      style="width: 100%; min-width: 0"
      @change="choose"
      @visible-change="ensureLoaded"
    >
      <el-option
        v-for="supplier in quickOptions"
        :key="supplier.supplierId"
        :value="supplier.supplierId"
        :label="label(supplier)"
        :disabled="supplier.status !== EnableStatus.Enabled"
      />
      <template #footer>
        <el-button text :disabled="inheritedDisabled" @click="openDialog">更多供应商…</el-button>
      </template>
    </el-select>
    <el-button
      :icon="Search"
      aria-label="打开供应商参照"
      :disabled="inheritedDisabled || loading"
      @click="openDialog"
    />
    <el-button v-if="failed" text type="danger" :disabled="inheritedDisabled || loading" @click="reload">
      重试
    </el-button>
    <SupplierPickerDialog
      v-model="dialogOpen"
      :options="options"
      :selected-id="modelValue ?? null"
      @confirm="choose($event.supplierId)"
    />
  </div>
</template>
<script setup lang="ts" name="SupplierPicker">
import { computed, ref } from 'vue'
import { useFormDisabled, useFormItem } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { getSupplierReferences } from '@/api/masterdata/supplier'
import { EnableStatus } from '@/types/api/common'
import { useReferenceOptions } from '../shared/useReferenceOptions'
import SupplierPickerDialog from './SupplierPickerDialog.vue'
import type { SupplierPickerProps, SupplierReference } from './types'
defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<SupplierPickerProps>(), {
  disabled: undefined,
  clearable: true,
  placeholder: '请选择供应商'
})
const emit = defineEmits<{ 'update:modelValue': [value: number | null]; change: [records: SupplierReference[]] }>()
const inheritedDisabled = useFormDisabled()
const { formItem } = useFormItem()
const { options, loading, failed, reload, ensureLoaded } = useReferenceOptions(
  computed(() => props.options),
  getSupplierReferences
)
const keyword = ref('')
const dialogOpen = ref(false)
function label(supplier: SupplierReference) {
  return `${supplier.supplierCode} / ${supplier.supplierName}${supplier.status !== EnableStatus.Enabled ? '（停用）' : ''}`
}
function filter(value: string) {
  keyword.value = value.trim().toLocaleLowerCase()
}
const quickOptions = computed(() => {
  const result = options.value
    .filter(
      (u) =>
        u.status === EnableStatus.Enabled &&
        `${u.supplierCode} ${u.supplierName} ${u.shortName}`.toLocaleLowerCase().includes(keyword.value)
    )
    .slice(0, 20)
  if (props.modelValue != null && !result.some((u) => u.supplierId === props.modelValue)) {
    result.unshift(
      options.value.find((u) => u.supplierId === props.modelValue) ?? {
        supplierId: props.modelValue,
        supplierCode: `#${props.modelValue}`,
        supplierName: '已失效',
        shortName: '',
        contactName: '',
        contactPhone: '',
        address: '',
        status: EnableStatus.Disabled
      }
    )
  }
  return result
})
function choose(value: unknown) {
  if (inheritedDisabled.value) return
  const id = typeof value === 'number' ? value : null
  const selected = options.value.find((u) => u.supplierId === id)
  if (id != null && (!selected || selected.status !== EnableStatus.Enabled)) return
  emit('update:modelValue', id)
  emit('change', selected ? [selected] : [])
  void formItem?.validate('change').catch(() => {})
}
async function openDialog() {
  if (inheritedDisabled.value) return
  if (props.options === undefined) await reload()
  if (!failed.value) dialogOpen.value = true
}
</script>
<style scoped>
.supplier-picker {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
}
</style>

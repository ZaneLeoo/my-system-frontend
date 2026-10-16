<template>
  <div class="unit-picker">
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
        v-for="unit in quickOptions"
        :key="unit.unitId"
        :value="unit.unitId"
        :label="label(unit)"
        :disabled="unit.status !== EnableStatus.Enabled"
      />
      <template #footer>
        <el-button text :disabled="inheritedDisabled" @click="dialogOpen = true">更多单位…</el-button>
      </template>
    </el-select>
    <el-button :icon="Search" aria-label="打开单位参照" :disabled="inheritedDisabled || loading" @click="openDialog" />
    <el-button v-if="failed" text type="danger" :disabled="inheritedDisabled || loading" @click="reload">
      重试
    </el-button>
    <UnitPickerDialog
      v-model="dialogOpen"
      :options="options"
      :selected-id="modelValue ?? null"
      @confirm="choose($event.unitId)"
    />
  </div>
</template>
<script setup lang="ts" name="UnitPicker">
import { computed, ref } from 'vue'
import { useFormDisabled, useFormItem } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { getUnitReferences } from '@/api/masterdata/reference'
import { EnableStatus } from '@/types/api/common'
import { useReferenceOptions } from '../shared/useReferenceOptions'
import UnitPickerDialog from './UnitPickerDialog.vue'
import type { UnitPickerProps, UnitReference } from './types'
defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<UnitPickerProps>(), {
  disabled: undefined,
  clearable: true,
  placeholder: '请选择单位'
})
const emit = defineEmits<{ 'update:modelValue': [value: number | null]; change: [records: UnitReference[]] }>()
const inheritedDisabled = useFormDisabled()
const { formItem } = useFormItem()
const { options, loading, failed, reload, ensureLoaded } = useReferenceOptions(
  computed(() => props.options),
  getUnitReferences
)
const keyword = ref('')
const dialogOpen = ref(false)
function label(unit: UnitReference) {
  return `${unit.unitCode} / ${unit.unitName}${unit.status !== EnableStatus.Enabled ? '（停用）' : ''}`
}
function filter(value: string) {
  keyword.value = value.trim().toLocaleLowerCase()
}
const quickOptions = computed(() => {
  const result = options.value
    .filter(
      (u) =>
        u.status === EnableStatus.Enabled && `${u.unitCode} ${u.unitName}`.toLocaleLowerCase().includes(keyword.value)
    )
    .slice(0, 20)
  if (props.modelValue != null && !result.some((u) => u.unitId === props.modelValue)) {
    result.unshift(
      options.value.find((u) => u.unitId === props.modelValue) ?? {
        unitId: props.modelValue,
        unitCode: `#${props.modelValue}`,
        unitName: '已失效',
        status: EnableStatus.Disabled
      }
    )
  }
  return result
})
function choose(value: unknown) {
  if (inheritedDisabled.value) return
  const id = typeof value === 'number' ? value : null
  const selected = options.value.find((u) => u.unitId === id)
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
.unit-picker {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
}
</style>

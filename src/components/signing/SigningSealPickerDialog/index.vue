<template>
  <el-dialog
    :model-value="modelValue"
    title="选择我方印章"
    width="760px"
    class="signing-seal-dialog"
    append-to-body
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="picker-toolbar">
      <div class="organization">
        <span>所属组织</span>
        <strong>{{ organizationName }}</strong>
      </div>
      <el-select v-model="draftType" clearable placeholder="全部类型" class="type-select" @change="filter">
        <el-option v-for="type in types" :key="type" :label="signingSealTypeLabels[type]" :value="type" />
      </el-select>
      <el-button :icon="Refresh" :loading="loading" @click="load(pageNum, activeType)">刷新</el-button>
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="picker-error" />
    <div v-loading="loading" class="picker-body">
      <div v-if="rows.length" class="seal-grid" role="radiogroup" aria-label="我方机构印章">
        <article
          v-for="seal in rows"
          :key="seal.id"
          class="seal-card"
          :class="{ selected: selected?.id === seal.id, disabled: !seal.selectable }"
          role="radio"
          :aria-checked="selected?.id === seal.id"
          :aria-disabled="!seal.selectable"
          :aria-label="seal.name + '，' + signingSealStatusLabels[seal.status]"
          :tabindex="seal.selectable ? 0 : -1"
          @click="select(seal)"
          @keydown.enter.self.prevent="select(seal)"
          @keydown.space.self.prevent="select(seal)"
        >
          <el-icon v-if="selected?.id === seal.id" class="selected-mark"><CircleCheckFilled /></el-icon>
          <SigningSealPreview :task-id="taskId" :seal-id="seal.id" :available="seal.previewAvailable" />
          <strong class="seal-name">{{ seal.name || seal.id }}</strong>
          <div class="seal-tags">
            <el-tag size="small" effect="light">{{ signingSealTypeLabels[seal.type] }}</el-tag>
            <el-tag v-if="seal.defaultSeal" size="small" type="warning">默认</el-tag>
            <el-tag :type="seal.selectable ? 'success' : 'info'" size="small">
              {{ signingSealStatusLabels[seal.status] }}
            </el-tag>
          </div>
          <span v-if="!seal.selectable" class="unavailable">{{ seal.statusDescription || '当前不可选用' }}</span>
        </article>
      </div>
      <el-empty v-else :description="error ? '未能加载印章，请重试' : '当前企业暂无符合条件的印章'" :image-size="64" />
    </div>
    <div class="picker-pagination">
      <span>共 {{ total }} 枚印章</span>
      <el-pagination
        :current-page="pageNum"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        @current-change="load($event, activeType)"
      />
    </div>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :disabled="!selected?.selectable || loading || !!error" @click="confirm">
        确认选择
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { CircleCheckFilled, Refresh } from '@element-plus/icons-vue'
import { signingSeals } from '@/api/signing'
import { getSigningErrorMessage } from '@/utils/signingError'
import { signingSealStatusLabels, signingSealTypeLabels } from '@/types/api/signing'
import type { SigningSeal, SigningSealType } from '@/types/api/signing'
import SigningSealPreview from '../SigningSealPreview/index.vue'

const props = defineProps<{
  modelValue: boolean
  taskId: string
  organizationName: string
  selectedSeal: SigningSeal | null
}>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; select: [value: SigningSeal] }>()
const types: SigningSealType[] = ['PUBLIC', 'CONTRACT', 'FINANCE', 'PERSONNEL', 'OTHER']
const rows = ref<SigningSeal[]>([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = 8
const draftType = ref<SigningSealType>()
const activeType = ref<SigningSealType>()
const selected = ref<SigningSeal | null>(null)
const loading = ref(false)
const error = ref('')
let sequence = 0
async function load(page: number, type?: SigningSealType) {
  const current = ++sequence
  loading.value = true
  error.value = ''
  try {
    const result = await signingSeals(props.taskId, { pageNum: page, pageSize, sealType: type })
    if (current !== sequence || !props.modelValue) return
    rows.value = result.data.rows
    total.value = result.data.total
    pageNum.value = page
    activeType.value = type
    draftType.value = type
    const refreshed = rows.value.find((seal) => seal.id === selected.value?.id)
    if (refreshed) selected.value = refreshed
  } catch (cause) {
    if (current !== sequence) return
    draftType.value = activeType.value
    error.value = getSigningErrorMessage(cause) || '印章列表加载失败'
  } finally {
    if (current === sequence) loading.value = false
  }
}
function filter() {
  void load(1, draftType.value)
}
function select(seal: SigningSeal) {
  if (seal.selectable && !loading.value && !error.value) selected.value = seal
}
function confirm() {
  if (!selected.value?.selectable || loading.value || error.value) return
  emit('select', { ...selected.value })
  emit('update:modelValue', false)
}
watch(
  () => [props.modelValue, props.taskId] as const,
  ([opened]) => {
    sequence++
    if (opened) {
      rows.value = []
      total.value = 0
      pageNum.value = 1
      draftType.value = undefined
      activeType.value = undefined
      selected.value = props.selectedSeal ? { ...props.selectedSeal } : null
      void load(1)
    } else {
      loading.value = false
    }
  }
)
</script>

<style scoped lang="scss">
.picker-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}
.organization {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.organization span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.organization strong {
  font-size: 14px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.type-select {
  width: 144px;
  flex-shrink: 0;
}
.picker-error {
  margin-bottom: 16px;
  overflow-wrap: anywhere;
}
.picker-body {
  min-height: 240px;
  max-height: 55vh;
  overflow: auto;
  padding: 2px;
}
.seal-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.seal-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s;
}
.seal-card:hover,
.seal-card:focus-visible {
  border-color: var(--el-color-primary);
  outline: none;
}
.seal-card.selected {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 1px var(--el-color-primary);
}
.seal-card.disabled {
  cursor: not-allowed;
  background: var(--el-fill-color-lighter);
  color: var(--el-text-color-secondary);
}
.seal-card.disabled:hover {
  border-color: var(--el-border-color);
}
.selected-mark {
  position: absolute;
  right: 12px;
  top: 12px;
  color: var(--el-color-primary);
  font-size: 22px;
  z-index: 1;
}
.seal-name {
  font-size: 14px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.seal-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.unavailable {
  font-size: 12px;
}
.picker-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 18px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
@media (max-width: 640px) {
  .picker-toolbar {
    flex-wrap: wrap;
  }
  .organization {
    flex-basis: 100%;
  }
  .seal-grid {
    grid-template-columns: 1fr;
  }
}
</style>

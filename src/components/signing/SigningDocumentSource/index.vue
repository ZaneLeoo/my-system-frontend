<template>
  <div class="document-source">
    <div class="source-options" role="radiogroup" aria-label="合同来源">
      <button
        v-for="option in sourceOptions"
        :key="option.value"
        type="button"
        class="source-option"
        :class="{ 'is-active': source === option.value }"
        role="radio"
        :aria-checked="source === option.value"
        @click="emit('update:source', option.value)"
      >
        <span class="option-icon">
          <el-icon><component :is="option.icon" /></el-icon>
        </span>
        <span class="option-copy">
          <strong>{{ option.title }}</strong>
          <span>{{ option.description }}</span>
        </span>
        <span class="option-check">
          <el-icon><Check /></el-icon>
        </span>
      </button>
    </div>

    <transition name="source-fade" mode="out-in">
      <div v-if="source === 'TEMPLATE'" key="template" class="source-panel">
        <div class="panel-label">
          <el-icon><Tickets /></el-icon>
          <span>合同模板</span>
        </div>
        <el-select
          :model-value="bindingId"
          placeholder="选择已配置模板"
          class="template-select"
          :teleported="false"
          @update:model-value="emit('update:bindingId', $event)"
        >
          <el-option v-for="binding in bindings" :key="binding.id" :label="binding.name" :value="binding.id!" />
        </el-select>
        <p v-if="!bindings.length" class="panel-hint">暂无启用的合同模板，请先在「配置合同模板」中完成绑定。</p>
        <p v-else-if="selectedBinding" class="panel-hint">将使用模板「{{ selectedBinding.name }}」生成待签合同。</p>
      </div>
      <div v-else key="upload" class="source-panel">
        <div class="panel-label">
          <el-icon><Document /></el-icon>
          <span>完整合同文件（PDF / DOC / DOCX，最大 10MB）</span>
        </div>
        <label class="upload-drop" :class="{ 'has-file': file }" @dragover.prevent @drop.prevent="onDrop">
          <input ref="inputRef" type="file" hidden accept=".pdf,.doc,.docx" @change="changed" />
          <template v-if="!file">
            <span class="upload-drop-icon">
              <el-icon :size="22"><UploadFilled /></el-icon>
            </span>
            <strong>点击选择文件，或拖拽到此处</strong>
            <span>支持 PDF、DOC、DOCX 格式</span>
          </template>
          <template v-else>
            <span class="upload-file-icon">
              <el-icon :size="18"><Document /></el-icon>
            </span>
            <span class="upload-file-name" :title="file.name">
              <strong>{{ file.name }}</strong>
              <span>{{ formatFileSize(file.size) }}</span>
            </span>
            <el-button
              class="upload-remove"
              text
              type="danger"
              size="small"
              aria-label="移除已选文件"
              @click.stop.prevent="remove"
            >
              <el-icon><Close /></el-icon>
              <span>移除</span>
            </el-button>
          </template>
        </label>
      </div>
    </transition>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, Close, Document, Tickets, UploadFilled } from '@element-plus/icons-vue'
import type { TemplateBinding } from '@/types/api/signing'

const props = defineProps<{ source: 'TEMPLATE' | 'UPLOAD'; bindingId?: string; bindings: TemplateBinding[] }>()
const emit = defineEmits<{
  'update:source': [value: 'TEMPLATE' | 'UPLOAD']
  'update:bindingId': [value: string]
  file: [value: File | null]
}>()

const sourceOptions = [
  {
    value: 'TEMPLATE' as const,
    icon: Tickets,
    title: 'e签宝模板',
    description: '使用已配置的合同模板，由平台按业务数据生成待签合同'
  },
  {
    value: 'UPLOAD' as const,
    icon: UploadFilled,
    title: '上传完整合同',
    description: '直接上传已拟定好的 PDF / Word 合同文件'
  }
]

const inputRef = ref<HTMLInputElement>()
const file = ref<File | null>(null)
const selectedBinding = computed(() => props.bindings.find((binding) => binding.id === props.bindingId))

function formatFileSize(size: number) {
  if (!size) return '大小未知'
  return size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / (1024 * 1024)).toFixed(2)} MB`
}
function acceptFile(next: File | null) {
  file.value = next
  emit('file', next)
}
function changed(event: Event) {
  acceptFile((event.target as HTMLInputElement).files?.[0] ?? null)
}
function onDrop(event: DragEvent) {
  const dropped = event.dataTransfer?.files?.[0]
  if (dropped && /\.(pdf|doc|docx)$/i.test(dropped.name)) acceptFile(dropped)
}
function remove() {
  acceptFile(null)
  if (inputRef.value) inputRef.value.value = ''
}
</script>
<style scoped lang="scss">
.source-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.source-option {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 14px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: transparent;
  color: var(--el-text-color-regular);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    box-shadow 0.18s ease;
}

.source-option:hover {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-fill-color-lighter);
}

.source-option.is-active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  box-shadow: 0 0 0 3px var(--el-color-primary-light-8);
}

.source-option:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.option-icon {
  display: inline-flex;
  flex: 0 0 40px;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--el-color-primary-light-7), var(--el-color-primary-light-9));
  color: var(--el-color-primary);
  font-size: 20px;
}

.option-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.option-copy strong {
  color: var(--el-text-color-primary);
  font-size: 14px;
}

.option-copy > span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.55;
}

.option-check {
  position: absolute;
  top: -7px;
  right: -7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--el-color-primary);
  color: var(--el-color-white);
  font-size: 12px;
  opacity: 0;
  transform: scale(0.6);
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.source-option.is-active .option-check {
  opacity: 1;
  transform: scale(1);
}

.source-fade-enter-active,
.source-fade-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.source-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.source-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.source-panel {
  padding: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
}

.panel-label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  color: var(--el-text-color-regular);
  font-size: 13px;
  font-weight: 500;
}

.template-select {
  width: 420px;
  max-width: 100%;
}

.panel-hint {
  margin: 10px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.upload-drop {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  padding: 26px 16px;
  border: 1px dashed var(--el-color-primary-light-5);
  border-radius: 8px;
  background: var(--el-bg-color);
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-align: center;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease;
}

.upload-drop:hover {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.upload-drop.has-file {
  flex-direction: row;
  justify-content: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-style: solid;
  border-color: var(--el-color-primary-light-5);
  text-align: left;
  cursor: default;
}

.upload-drop.has-file:hover {
  background: var(--el-bg-color);
}

.upload-drop strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
}

.upload-drop-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.upload-file-icon {
  display: inline-flex;
  flex: 0 0 36px;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.upload-file-name {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.upload-file-name strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-file-name > span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.upload-remove {
  flex: 0 0 auto;
}

@media (max-width: 640px) {
  .source-options {
    grid-template-columns: 1fr;
  }
}
</style>

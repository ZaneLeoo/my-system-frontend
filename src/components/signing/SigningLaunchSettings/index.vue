<template>
  <div class="launch-settings">
    <h3>我方签署设置</h3>
    <el-form label-width="104px" label-position="left" :disabled="disabled">
      <el-form-item label="我方组织">
        <div class="organization-value">{{ organizationName }}</div>
      </el-form-item>
      <el-form-item label="签署方式">
        <div class="mode-options">
          <el-radio-group :model-value="modelValue.autoSign" @update:model-value="changeMode($event === true)">
            <el-radio :value="false">手动签署</el-radio>
            <el-radio :value="true">自动落章</el-radio>
          </el-radio-group>
          <span class="hint">
            {{
              modelValue.autoSign
                ? '流程到达我方节点时，按已确认位置自动盖章。'
                : '由我方经办人在 e签宝页面确认并完成签署。'
            }}
          </span>
        </div>
      </el-form-item>
      <el-form-item label="使用印章" :required="modelValue.autoSign">
        <div v-if="modelValue.seal" class="selected-seal">
          <SigningSealPreview
            :task-id="taskId"
            :seal-id="modelValue.seal.id"
            :available="modelValue.seal.previewAvailable"
            compact
          />
          <div class="selected-copy">
            <strong>{{ modelValue.seal.name || modelValue.seal.id }}</strong>
            <div class="tags">
              <el-tag v-if="modelValue.seal.type !== 'UNSUPPORTED'" size="small">
                {{ signingSealTypeLabels[modelValue.seal.type] }}
              </el-tag>
              <el-tag
                v-if="modelValue.seal.status !== 'UNKNOWN'"
                :type="modelValue.seal.selectable ? 'success' : 'info'"
                size="small"
              >
                {{ signingSealStatusLabels[modelValue.seal.status] }}
              </el-tag>
            </div>
            <div v-if="!disabled" class="seal-actions">
              <el-button type="primary" link :icon="Refresh" @click="pickerOpen = true">更换印章</el-button>
              <el-button v-if="!modelValue.autoSign" link @click="selectSeal(null)">清除</el-button>
            </div>
          </div>
        </div>
        <div v-else class="empty-seal">
          <el-button v-if="!disabled" :icon="Stamp" @click="pickerOpen = true">选择我方印章</el-button>
          <span class="hint">
            {{ modelValue.autoSign ? '请选择一枚启用的我方机构印章。' : '未预选印章，由经办人在 e签宝签署页选择。' }}
          </span>
        </div>
      </el-form-item>
    </el-form>
    <div class="counterparty-summary">
      <h3>对方签署</h3>
      <div>
        <span>对方签署方式</span>
        <strong>手动签署 · 短信通知</strong>
      </div>
      <div v-if="counterparty">
        <span>签署顺序</span>
        <strong>
          第 {{ counterparty.signOrder }} 顺位 ·
          {{
            counterparty.partyType === 'PERSON'
              ? `${counterparty.transactorName || '个人签署人'}（个人）`
              : counterparty.organizationName
          }}
        </strong>
      </div>
    </div>
    <SigningSealPickerDialog
      v-if="!disabled"
      v-model="pickerOpen"
      :task-id="taskId"
      :organization-name="organizationName"
      :selected-seal="modelValue.seal"
      @select="selectSeal"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Refresh, Stamp } from '@element-plus/icons-vue'
import type { SigningLaunchOptions, SigningParty, SigningSeal } from '@/types/api/signing'
import { signingSealTypeLabels, signingSealStatusLabels } from '@/types/api/signing'
import SigningSealPreview from '../SigningSealPreview/index.vue'
import SigningSealPickerDialog from '../SigningSealPickerDialog/index.vue'
const props = defineProps<{
  modelValue: SigningLaunchOptions
  taskId: string
  organizationName: string
  counterparty?: SigningParty
  disabled: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: SigningLaunchOptions] }>()
const pickerOpen = ref(false)
function changeMode(autoSign: boolean) {
  if (!props.disabled) emit('update:modelValue', { ...props.modelValue, autoSign })
}
function selectSeal(seal: SigningSeal | null) {
  if (!props.disabled) emit('update:modelValue', { ...props.modelValue, seal })
}
</script>

<style scoped lang="scss">
.launch-settings {
  padding: 22px 24px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
}
h3 {
  margin: 0 0 20px;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.organization-value {
  width: 100%;
  padding: 0 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  background: var(--el-fill-color-light);
  line-height: 34px;
  overflow-wrap: anywhere;
}
.mode-options,
.empty-seal {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
.hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.7;
}
.selected-seal {
  display: flex;
  align-items: center;
  width: min(100%, 540px);
  gap: 18px;
  padding: 12px;
  border: 1px solid var(--el-color-primary-light-5);
  border-radius: 8px;
}
.selected-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.selected-copy strong {
  font-size: 14px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.tags,
.seal-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.seal-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}
.counterparty-summary {
  padding-top: 20px;
  border-top: 1px solid var(--el-border-color-lighter);
}
.counterparty-summary > div {
  display: flex;
  align-items: baseline;
  gap: 18px;
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.7;
}
.counterparty-summary > div > span {
  flex: 0 0 86px;
  color: var(--el-text-color-secondary);
}
.counterparty-summary strong {
  font-weight: 400;
  overflow-wrap: anywhere;
}
@media (max-width: 600px) {
  .launch-settings {
    padding: 16px;
  }
  .selected-seal {
    gap: 8px;
  }
  .selected-seal :deep(.seal-preview.compact) {
    width: 82px;
    height: 82px;
  }
}
</style>

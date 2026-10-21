<template>
  <el-card class="signing-progress" shadow="never">
    <div class="progress-summary">
      <div class="current-stage">
        <div class="eyebrow">签署流程</div>
        <div class="stage-description">{{ currentDescription }}</div>
        <div class="stage-progress">
          <div class="stage-progress-track">
            <div class="stage-progress-fill" :style="{ width: `${progressPercent}%` }" />
          </div>
          <span class="stage-progress-text">{{ progressPercent }}%</span>
        </div>
      </div>
      <div class="status-tags">
        <span v-if="task.flowId" class="flow-number" :title="task.flowId">平台流程号 {{ task.flowId }}</span>
        <el-tag :type="signingTagType">{{ signingStatusLabels[task.status] }}</el-tag>
        <el-tag :type="operationTagType">{{ operationLabels[task.operationStatus] }}</el-tag>
        <el-tag :type="archiveTagType">{{ archiveLabels[task.archiveStatus] }}</el-tag>
      </div>
    </div>

    <div class="workflow-steps" role="tablist" aria-label="签署流程阶段">
      <button
        v-for="(title, index) in stepTitles"
        :key="title"
        :id="`signing-step-tab-${index}`"
        class="workflow-step"
        :class="stepClasses(index)"
        type="button"
        role="tab"
        :aria-selected="selectedStep === index"
        aria-controls="signing-step-panel"
        @click="emit('select-step', index)"
      >
        <span class="step-marker">
          <el-icon v-if="isStepComplete(index)"><Check /></el-icon>
          <template v-else>{{ index + 1 }}</template>
        </span>
        <span class="step-label">{{ title }}</span>
        <span class="step-state">{{ stepState(index) }}</span>
      </button>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Check } from '@element-plus/icons-vue'
import type { SigningParty, SigningTask } from '@/types/api/signing'
import { operationLabels, signingStatusLabels } from '@/types/api/signing'
import { getSigningErrorMessage } from '@/utils/signingError'

const props = defineProps<{
  task: SigningTask
  parties: SigningParty[]
  dirty?: boolean
  selectedStep: number
  participantsSaved?: boolean
}>()
const emit = defineEmits<{ 'select-step': [index: number] }>()
const stepTitles = ['准备合同', '确认签署方', '配置签章位置', '发起签署', '对方签署', '签署结果']

const archiveLabels = {
  NONE: '文件待保存',
  PENDING: '文件保存中',
  READY: '文件已保存',
  FAILED: '文件保存失败'
} as const
const documentReady = computed(() => props.task.documentStatus === 'READY')
const validParty = (party: SigningParty) =>
  party.autoSign || (!!party.transactorName?.trim() && !!party.transactorAccount?.trim())
const confirmedPartyCount = computed(() => props.parties.filter(validParty).length)
const partiesReady = computed(
  () =>
    props.participantsSaved !== false && props.parties.length > 0 && confirmedPartyCount.value === props.parties.length
)
const positionsReady = computed(
  () => props.parties.length > 0 && props.parties.every((party) => party.positions.length > 0)
)
const positionsConfirmed = computed(() => positionsReady.value && !!props.task.positionDocumentHash && !props.dirty)
const failedTerminal = computed(() => ['REJECTED', 'REVOKED', 'EXPIRED'].includes(props.task.status))

const activeStep = computed(() => {
  if (props.task.status === 'COMPLETED') {
    return 5
  }
  if (props.task.status === 'SIGNING' || failedTerminal.value) {
    return 4
  }
  if (!documentReady.value) {
    return 0
  }
  if (!partiesReady.value) {
    return 1
  }
  if (!positionsConfirmed.value) {
    return 2
  }
  return 3
})

const stepStatus = computed(() => {
  if (failedTerminal.value || props.task.documentStatus === 'FAILED') {
    return 'error' as const
  }
  if (props.task.status === 'COMPLETED') {
    return 'finish' as const
  }
  return 'process' as const
})

const progressPercent = computed(() => {
  if (stepStatus.value === 'finish') return 100
  return Math.round((stepTitles.filter((_, index) => isStepComplete(index)).length / stepTitles.length) * 100)
})

function isStepComplete(index: number) {
  return index < activeStep.value || (index === 5 && props.task.status === 'COMPLETED')
}

const currentDescription = computed(() => {
  if (props.task.status === 'COMPLETED') {
    if (props.task.archiveStatus === 'READY') return 'e签宝已确认流程完成，最终合同文件已保存，可查看签署结果。'
    if (props.task.archiveStatus === 'FAILED') return 'e签宝已确认流程完成，本地文件保存失败，可重试获取最终合同。'
    return 'e签宝已确认流程完成，系统正在获取最终合同文件。'
  }
  if (props.task.operationStatus === 'UNKNOWN') {
    return '请先核对 e签宝平台是否已创建流程，再关联平台流程号，避免重复发起。'
  }
  if (props.task.operationStatus === 'QUEUED' || props.task.operationStatus === 'RUNNING') {
    return '系统正在与 e签宝同步，请稍候；页面会自动更新状态。'
  }
  if (props.task.operationStatus === 'FAILED' || props.task.documentStatus === 'FAILED') {
    return getSigningErrorMessage(props.task.lastError) || '请检查当前步骤所需信息，修正后重试。'
  }
  if (failedTerminal.value) {
    return '本次签署没有完成。可查看下方流程记录，确认原因后重新发起。'
  }
  if (props.task.status === 'SIGNING') {
    return '签署方按设定顺序通过 e签宝完成签署，最新进度会在下方显示。'
  }
  if (!documentReady.value) {
    return props.task.source === 'TEMPLATE'
      ? '根据已选模板生成待签合同；生成后再确认签署方和落章位置。'
      : '上传完整合同并准备待签文件；文件确认后再配置签署方和落章位置。'
  }
  if (!partiesReady.value) {
    return '选择对方签署主体类型，填写个人签署人或企业经办人及接收通知的账号。'
  }
  if (!positionsConfirmed.value) {
    return '在 e签宝官方页面放置双方签章，返回本页后确认当前文件及位置。'
  }
  return '发起前请核对合同文件、签署主体和签章位置；发起后将进入平台签署流程。'
})

const signingTagType = computed(() => {
  if (['COMPLETED'].includes(props.task.status)) {
    return 'success'
  }
  if (failedTerminal.value) {
    return 'danger'
  }
  return props.task.status === 'SIGNING' ? 'primary' : 'info'
})
const operationTagType = computed(() => {
  if (props.task.operationStatus === 'FAILED' || props.task.operationStatus === 'UNKNOWN') {
    return 'warning'
  }
  return ['QUEUED', 'RUNNING'].includes(props.task.operationStatus) ? 'primary' : 'info'
})
const archiveTagType = computed(() => {
  if (props.task.archiveStatus === 'READY') {
    return 'success'
  }
  return props.task.archiveStatus === 'FAILED' ? 'danger' : 'info'
})

function stepClasses(index: number) {
  return {
    'is-selected': props.selectedStep === index,
    'is-current': activeStep.value === index,
    'is-complete': isStepComplete(index),
    'is-error': activeStep.value === index && stepStatus.value === 'error'
  }
}

function stepState(index: number) {
  if (isStepComplete(index)) {
    return '已完成'
  }
  if (activeStep.value === index) {
    if (stepStatus.value === 'error') return '需处理'
    if (props.task.status === 'SIGNING' || props.task.archiveStatus === 'PENDING') return '进行中'
    return '当前阶段'
  }
  return '待处理'
}
</script>

<style scoped lang="scss">
.signing-progress {
  border-color: var(--el-border-color-lighter);
}

.progress-summary {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 20px;
}

.eyebrow {
  margin-bottom: 6px;
  color: var(--el-color-primary);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.stage-description {
  margin-top: 6px;
  color: var(--el-text-color-regular);
  line-height: 1.6;
}

.stage-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  max-width: 420px;
}

.stage-progress-track {
  flex: 1;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--el-fill-color-light);
}

.stage-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--el-color-primary-light-5), var(--el-color-primary));
  transition: width 0.4s ease;
}

.stage-progress-text {
  flex: 0 0 auto;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.status-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.workflow-steps {
  display: flex;
  overflow-x: auto;
  margin: 0 0 20px;
  padding: 6px 2px 10px;
}

.workflow-step {
  position: relative;
  display: flex;
  flex: 1 0 118px;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  min-width: 118px;
  padding: 6px 4px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
}

.workflow-step::after {
  position: absolute;
  top: 21px;
  left: calc(50% + 24px);
  z-index: 0;
  width: calc(100% - 48px);
  height: 2px;
  border-radius: 2px;
  background: var(--el-border-color);
  content: '';
  transition: background 0.25s ease;
}

.workflow-step:last-child::after {
  display: none;
}

.workflow-step.is-complete::after {
  background: var(--el-color-success);
}

.step-marker {
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--el-border-color);
  border-radius: 50%;
  background: var(--el-bg-color);
  color: var(--el-text-color-secondary);
  font-size: 13px;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease;
}

.step-marker .el-icon {
  font-size: 14px;
}

.step-label {
  color: var(--el-text-color-regular);
  font-size: 13px;
  white-space: nowrap;
  transition: color 0.18s ease;
}

.step-state {
  color: var(--el-text-color-placeholder);
  font-size: 11px;
}

.workflow-step.is-selected .step-marker {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  box-shadow: 0 0 0 4px var(--el-color-primary-light-8);
}

.workflow-step.is-current .step-marker {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary);
  color: var(--el-color-white);
  animation: step-pulse 2.2s ease-out infinite;
}

.workflow-step.is-complete .step-marker {
  border-color: var(--el-color-success);
  background: var(--el-color-success);
  color: var(--el-color-white);
}

.workflow-step.is-complete.is-selected .step-marker {
  box-shadow: 0 0 0 4px var(--el-color-success-light-8);
}

.workflow-step.is-current .step-label,
.workflow-step.is-selected .step-label {
  color: var(--el-color-primary);
  font-weight: 600;
}

.workflow-step.is-current .step-state {
  color: var(--el-color-primary);
}

.workflow-step.is-complete .step-label {
  color: var(--el-color-success);
}

.workflow-step.is-error .step-marker {
  border-color: var(--el-color-danger);
  background: var(--el-color-danger);
  color: var(--el-color-white);
  animation: none;
}

.workflow-step.is-error .step-label,
.workflow-step.is-error .step-state {
  color: var(--el-color-danger);
}

.workflow-step:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

@keyframes step-pulse {
  0% {
    box-shadow: 0 0 0 0 var(--el-color-primary-light-7);
  }

  70% {
    box-shadow: 0 0 0 8px transparent;
  }

  100% {
    box-shadow: 0 0 0 0 transparent;
  }
}

.flow-number {
  overflow: hidden;
  max-width: 220px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .progress-summary {
    flex-direction: column;
  }

  .status-tags {
    justify-content: flex-start;
  }

  .workflow-step {
    flex-basis: 96px;
    min-width: 96px;
  }
}
</style>

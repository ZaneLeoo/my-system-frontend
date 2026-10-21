<template>
  <div class="parties">
    <el-card
      v-for="party in displayParties"
      :key="party.role"
      class="party-card"
      :class="{ 'is-our': party.role === 'OUR' }"
      shadow="never"
    >
      <template #header>
        <div class="party-heading">
          <span class="party-avatar">
            <el-icon><component :is="partyIcon(party)" /></el-icon>
          </span>
          <div class="party-title">
            <strong>{{ party.role === 'OUR' ? '我方签署' : '对方签署' }}</strong>
            <span>{{ party.role === 'OUR' ? '发起方' : '合同相对方' }}</span>
          </div>
          <el-tag :type="isComplete(party) ? 'success' : 'info'" effect="plain" size="small">
            {{ isComplete(party) ? '信息完整' : '待补充' }}
          </el-tag>
        </div>
      </template>
      <div v-if="party.role === 'OUR' || isOrganization(party)" class="party-organization">
        <span>签署机构</span>
        <strong>{{ party.organizationName || '尚未设置签署机构' }}</strong>
      </div>
      <div v-else class="party-organization">
        <span>签署主体</span>
        <strong>个人</strong>
      </div>
      <el-form label-position="top" :disabled="disabled" class="party-form">
        <template v-if="!party.autoSign || !disabled">
          <el-form-item v-if="party.role === 'COUNTERPARTY'" label="对方签署类型">
            <el-radio-group
              :model-value="party.partyType ?? 'ORGANIZATION'"
              @update:model-value="changePartyType(party.role, $event)"
            >
              <el-radio-button value="ORGANIZATION">企业／机构</el-radio-button>
              <el-radio-button value="PERSON">个人</el-radio-button>
            </el-radio-group>
            <div class="identity-hint">
              个人签署填写个人实名账号；企业／机构签署填写企业名称对应的经办人账号，姓名需与 e签宝实名信息一致。
            </div>
          </el-form-item>
          <el-form-item
            :label="party.role === 'COUNTERPARTY' && party.partyType === 'PERSON' ? '个人姓名' : '授权经办人姓名'"
          >
            <el-input
              :model-value="party.transactorName"
              :disabled="party.role === 'OUR'"
              :prefix-icon="User"
              placeholder="填写签署经办人姓名"
              maxlength="64"
              @update:model-value="change(party.role, 'transactorName', $event)"
            />
          </el-form-item>
          <el-form-item label="接收签署通知的手机号或邮箱">
            <el-input
              :model-value="party.transactorAccount"
              :disabled="party.role === 'OUR'"
              :prefix-icon="Iphone"
              placeholder="填写 e签宝账号手机号或邮箱"
              maxlength="100"
              @update:model-value="change(party.role, 'transactorAccount', $event)"
            />
          </el-form-item>
        </template>
        <div v-else class="auto-sign-note">
          <el-icon><CircleCheck /></el-icon>
          <span>已选择自动签章，将按平台授权及签署顺序办理。</span>
        </div>
        <div class="party-order">
          <div>
            <strong>签署顺序</strong>
            <span>数字越小，越先签署</span>
          </div>
          <el-input-number
            :model-value="party.signOrder"
            :min="1"
            :max="255"
            controls-position="right"
            aria-label="签署顺序"
            @update:model-value="change(party.role, 'signOrder', $event ?? 1)"
          />
        </div>
      </el-form>
    </el-card>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { CircleCheck, Iphone, OfficeBuilding, User } from '@element-plus/icons-vue'
import type { SigningParty, SigningPartyType } from '@/types/api/signing'

const props = defineProps<{ modelValue: SigningParty[]; disabled: boolean; counterpartyOrganization: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: SigningParty[]] }>()
const displayParties = computed(() =>
  [...props.modelValue].sort((left, right) => {
    if (left.role === right.role) return 0
    return left.role === 'OUR' ? -1 : 1
  })
)

function isComplete(party: SigningParty): boolean {
  return party.autoSign || (!!party.transactorName?.trim() && !!party.transactorAccount?.trim())
}
function isOrganization(party: SigningParty): boolean {
  return party.partyType !== 'PERSON'
}
function partyIcon(party: SigningParty) {
  return party.role === 'COUNTERPARTY' && party.partyType === 'PERSON' ? User : OfficeBuilding
}
function changePartyType(role: SigningParty['role'], partyType: SigningPartyType) {
  const value = props.modelValue.map((party) => {
    if (party.role !== role) return party
    return {
      ...party,
      partyType,
      organizationName:
        partyType === 'ORGANIZATION' && role === 'COUNTERPARTY'
          ? party.organizationName || props.counterpartyOrganization
          : party.organizationName
    }
  })
  emit('update:modelValue', value)
}
function change<K extends keyof SigningParty>(role: SigningParty['role'], key: K, value: SigningParty[K]) {
  emit(
    'update:modelValue',
    props.modelValue.map((party) => (party.role === role ? { ...party, [key]: value } : party))
  )
}
</script>
<style scoped lang="scss">
.parties {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: 20px;
}
.party-card {
  border-radius: 10px;
  border-color: var(--el-border-color-lighter);
}
.party-card :deep(.el-card__header) {
  padding: 16px 20px;
  background: var(--el-fill-color-lighter);
}
.party-card.is-our :deep(.el-card__header) {
  background: var(--el-color-primary-light-9);
}
.party-heading {
  display: flex;
  align-items: center;
  gap: 10px;
}
.party-avatar {
  display: inline-flex;
  flex: 0 0 36px;
  align-items: center;
  justify-content: center;
  height: 36px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-bg-color);
  color: var(--el-text-color-regular);
  font-size: 19px;
}
.is-our .party-avatar {
  color: var(--el-color-primary);
  border-color: var(--el-color-primary-light-8);
}
.party-title {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
}
.party-title strong {
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
}
.party-title span,
.party-organization > span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.party-organization {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding-bottom: 18px;
  margin-bottom: 18px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.party-organization strong {
  color: var(--el-text-color-primary);
  font-size: 15px;
  font-weight: 500;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.signing-mode,
.party-order {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.signing-mode {
  margin-bottom: 20px;
}
.signing-mode > div,
.party-order > div:first-child {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.signing-mode strong,
.party-order strong {
  color: var(--el-text-color-regular);
  font-size: 13px;
  font-weight: 500;
}
.signing-mode span,
.party-order span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}
.party-form :deep(.el-form-item) {
  margin-bottom: 18px;
}
.party-form :deep(.el-form-item__label) {
  padding-bottom: 6px;
  font-size: 13px;
}
.identity-hint {
  margin-top: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}
.auto-sign-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  margin-bottom: 20px;
  border-radius: 6px;
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
  font-size: 13px;
  line-height: 1.6;
}
.auto-sign-note .el-icon {
  flex-shrink: 0;
  margin-top: 3px;
}
.party-order {
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}
.party-order .el-input-number {
  flex: 0 0 110px;
  width: 110px;
}
@media (max-width: 760px) {
  .parties {
    grid-template-columns: 1fr;
    gap: 14px;
  }
}
</style>

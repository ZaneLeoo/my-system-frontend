<template>
  <div
    v-loading="pageMaskVisible"
    :element-loading-text="pageMaskText"
    element-loading-background="rgba(255, 255, 255, 0.78)"
    class="app-container signing-editor"
  >
    <div class="document-bar">
      <div class="page-heading">
        <span class="heading-icon">
          <el-icon><Stamp /></el-icon>
        </span>
        <div class="heading-copy">
          <strong>{{ detail?.task.title ?? '发起电子签署' }}</strong>
          <el-tag v-if="detail" :type="taskStatusTagType">{{ signingStatusLabels[detail.task.status] }}</el-tag>
        </div>
      </div>
      <div class="actions">
        <el-button @click="back">
          <el-icon><Back /></el-icon>
          <span>返回来源单据</span>
        </el-button>
        <el-button v-if="detail" :disabled="busy" @click="load">
          <el-icon><Refresh /></el-icon>
          <span>刷新</span>
        </el-button>
        <el-button
          v-if="auth.hasPermi('signing:template:edit')"
          @click="router.push({ path: '/signing/template', query: { businessType } })"
        >
          配置合同模板
        </el-button>
      </div>
    </div>

    <el-alert
      v-if="!settings?.enabled || !settings?.configured"
      title="电子签署尚未启用或未配置凭证，请先完成服务端配置"
      type="warning"
      :closable="false"
      class="page-alert"
    />
    <el-alert v-if="error" :title="error" type="error" :closable="false" class="page-alert" />

    <template v-if="!detail">
      <el-card class="workflow-stage create-stage" shadow="never">
        <template #header>
          <div class="stage-heading">
            <span class="stage-number">1</span>
            <div class="stage-copy">
              <strong>选择合同来源</strong>
              <span>使用已配置的 e签宝模板，或上传一份完整合同文件。</span>
            </div>
          </div>
        </template>
        <el-steps :active="0" simple class="create-steps">
          <el-step title="选择合同来源" />
          <el-step title="生成待签文件" />
          <el-step title="确认签署信息" />
        </el-steps>
        <SigningDocumentSource
          v-model:source="source"
          v-model:binding-id="bindingId"
          :bindings="bindings"
          @file="file = $event"
        />
        <div class="create-footer">
          <span>草稿建立后会立即准备待签文件，之后再配置签署方与落章位置。</span>
          <el-button
            type="primary"
            :loading="busy"
            :disabled="
              !businessType ||
              !businessId ||
              !settings?.enabled ||
              !settings.configured ||
              (source === 'TEMPLATE' ? !bindingId : !file)
            "
            @click="create"
          >
            建立草稿并准备文件
          </el-button>
        </div>
      </el-card>
    </template>

    <template v-else>
      <SigningProgress
        :task="detail.task"
        :parties="parties"
        :participants-saved="detail.parties.length === 2"
        :dirty="dirty"
        :selected-step="selectedStep"
        class="workflow-progress"
        @select-step="selectStep"
      />
      <el-alert
        v-if="detail.task.lastError"
        :title="getSigningErrorMessage(detail.task.lastError)"
        type="warning"
        :closable="false"
        class="page-alert"
      />

      <transition name="stage-fade" mode="out-in">
        <el-card
          v-if="selectedStep === 0"
          id="signing-step-panel"
          key="signing-step-0"
          role="tabpanel"
          :aria-labelledby="`signing-step-tab-${selectedStep}`"
          class="workflow-stage"
          shadow="never"
        >
          <template #header>
            <div class="stage-heading">
              <span class="stage-number" :class="stageNumberClass(0)">1</span>
              <div class="stage-copy">
                <strong>准备合同文件</strong>
                <span>核对模板生成或上传的合同文件，后续签章位置将绑定到待签文件。</span>
              </div>
              <el-tag :type="documentStageTagType">{{ documentStageLabel }}</el-tag>
            </div>
          </template>
          <div v-if="detail.documents.length" class="document-list">
            <div v-for="document in detail.documents" :key="document.id" class="document-row">
              <div class="document-info">
                <span class="document-icon" :class="`is-${document.kind.toLowerCase()}`">
                  <el-icon>
                    <CircleCheckFilled v-if="document.kind === 'SIGNED'" />
                    <Document v-else />
                  </el-icon>
                </span>
                <div class="document-name">
                  <strong>{{ document.fileName }}</strong>
                  <span>
                    <el-tag
                      size="small"
                      effect="plain"
                      :type="document.kind === 'SIGNED' ? 'success' : 'info'"
                      class="document-kind-tag"
                    >
                      {{ documentKindLabels[document.kind] }}
                    </el-tag>
                    {{ formatFileSize(document.size) }}
                    <template v-if="document.sha256">· SHA-256 {{ document.sha256 }}</template>
                  </span>
                </div>
              </div>
              <el-button
                v-if="document.sha256"
                link
                type="primary"
                :disabled="!auth.hasPermi('signing:task:download')"
                @click="preview(document.id)"
              >
                <el-icon><View /></el-icon>
                <span>预览文件</span>
              </el-button>
            </div>
          </div>
          <el-empty v-else description="尚未生成合同文件" :image-size="56" />

          <div v-if="editable" class="stage-action">
            <template v-if="detail.task.documentStatus !== 'READY'">
              <div v-if="detail.task.source === 'UPLOAD'" class="upload-control">
                <label class="upload-pick">
                  <el-icon><FolderOpened /></el-icon>
                  <span>{{ file ? '重新选择合同' : '选择完整合同' }}</span>
                  <input
                    type="file"
                    hidden
                    accept=".pdf,.doc,.docx"
                    @change="file = ($event.target as HTMLInputElement).files?.[0] ?? null"
                  />
                </label>
                <span v-if="file" class="upload-file" :title="file.name">{{ file.name }}</span>
              </div>
              <el-button type="primary" :disabled="busy || pending" @click="prepare">
                {{ detail.task.documentStatus === 'FAILED' ? '重新准备文件' : '准备合同文件' }}
              </el-button>
            </template>
            <el-button v-else type="primary" :disabled="busy || pending" @click="selectStep(1)">
              下一步：确认签署方
            </el-button>
          </div>
        </el-card>

        <el-card
          v-else-if="selectedStep === 1"
          id="signing-step-panel"
          key="signing-step-1"
          role="tabpanel"
          :aria-labelledby="`signing-step-tab-${selectedStep}`"
          class="workflow-stage"
          shadow="never"
        >
          <template #header>
            <div class="stage-heading">
              <span class="stage-number" :class="stageNumberClass(1)">2</span>
              <div class="stage-copy">
                <strong>确认签署方</strong>
                <span>确认双方机构、经办人及顺序；我方用章方式在发起签署时选择。</span>
              </div>
              <el-tag :type="partyStageTagType">{{ partyStageLabel }}</el-tag>
            </div>
          </template>
          <div v-if="detail.task.documentStatus === 'READY'">
            <SigningParticipants
              :model-value="parties"
              :counterparty-organization="detail.defaultCounterparty?.organizationName ?? ''"
              :disabled="!editable || busy || pending"
              @update:model-value="editParties"
            />
            <div v-if="editable" class="stage-action">
              <span class="stage-hint">
                <template
                  v-if="detail.defaultCounterparty?.transactorName || detail.defaultCounterparty?.transactorAccount"
                >
                  已带入来源单据联系人，请确认实际签署人和通知账号后保存。
                </template>
                <template v-else>确认双方签署信息后，保存并进入签章位置配置。</template>
              </span>
              <div class="stage-actions">
                <el-button :disabled="busy || pending" @click="selectStep(0)">上一步</el-button>
                <el-button :disabled="busy || pending" @click="saveParties(false)">仅保存</el-button>
                <el-button
                  type="primary"
                  :disabled="busy || pending || !partiesReady"
                  @click="savePartiesAndContinue(false)"
                >
                  保存并继续
                </el-button>
              </div>
            </div>
            <div v-else-if="detail.parties.length" class="stage-hint readonly-hint">
              签署方信息已锁定，签署流程发起后不可在本页修改。
            </div>
          </div>
          <el-empty v-else description="准备好合同文件后即可确认签署方" :image-size="56" />
        </el-card>

        <el-card
          v-else-if="selectedStep === 2"
          id="signing-step-panel"
          key="signing-step-2"
          role="tabpanel"
          :aria-labelledby="`signing-step-tab-${selectedStep}`"
          class="workflow-stage"
          shadow="never"
        >
          <template #header>
            <div class="stage-heading">
              <span class="stage-number" :class="stageNumberClass(2)">3</span>
              <div class="stage-copy">
                <strong>配置签章位置</strong>
                <span>在 e签宝官方页面拖放签章，返回后确认位置对应当前待签文件。</span>
              </div>
              <el-tag :type="positionStageTagType">{{ positionStageLabel }}</el-tag>
            </div>
          </template>
          <template v-if="detail.task.documentStatus === 'READY'">
            <SigningPosition
              :parties="parties"
              :disabled="!editable || busy || dirty || pending"
              @open="openPosition"
            />
            <div v-if="editable" class="stage-action">
              <span class="stage-hint">
                {{
                  positionsConfirmed
                    ? '文件摘要和落章位置已经确认。'
                    : '设置双方位置后，确认当前文件与位置；替换合同文件后需要重新确认。'
                }}
              </span>
              <div class="stage-actions">
                <el-button :disabled="busy || pending" @click="selectStep(1)">上一步</el-button>
                <el-button v-if="positionsConfirmed" type="primary" :disabled="busy || pending" @click="selectStep(3)">
                  下一步：发起签署
                </el-button>
                <el-button
                  v-else
                  type="primary"
                  plain
                  :disabled="
                    busy || dirty || pending || !partiesReady || !parties.every((item) => item.positions.length)
                  "
                  @click="savePartiesAndContinue(true)"
                >
                  确认位置并继续
                </el-button>
              </div>
            </div>
          </template>
          <el-empty v-else description="准备好合同文件后即可配置签章位置" :image-size="56" />
        </el-card>

        <el-card
          v-else-if="selectedStep === 3"
          id="signing-step-panel"
          key="signing-step-3"
          role="tabpanel"
          :aria-labelledby="`signing-step-tab-${selectedStep}`"
          class="workflow-stage"
          shadow="never"
        >
          <template #header>
            <div class="stage-heading">
              <span class="stage-number" :class="stageNumberClass(3)">4</span>
              <div class="stage-copy">
                <strong>发起签署</strong>
                <span>复核前置步骤后，向 e签宝发起签署流程。</span>
              </div>
              <el-tag :type="launchStageTagType">{{ launchStageLabel }}</el-tag>
            </div>
          </template>
          <div v-if="detail.task.status === 'DRAFT'" class="launch-panel">
            <div class="launch-checklist">
              <div class="launch-check-item" :class="{ complete: detail.task.documentStatus === 'READY' }">
                <el-icon class="check-icon">
                  <CircleCheckFilled v-if="detail.task.documentStatus === 'READY'" />
                  <CircleCheck v-else />
                </el-icon>
                <span>合同文件已准备</span>
              </div>
              <div class="launch-check-item" :class="{ complete: partiesReady }">
                <el-icon class="check-icon">
                  <CircleCheckFilled v-if="partiesReady" />
                  <CircleCheck v-else />
                </el-icon>
                <span>签署方信息完整</span>
              </div>
              <div class="launch-check-item" :class="{ complete: positionsConfirmed }">
                <el-icon class="check-icon">
                  <CircleCheckFilled v-if="positionsConfirmed" />
                  <CircleCheck v-else />
                </el-icon>
                <span>签章位置与文件已确认</span>
              </div>
            </div>
            <SigningLaunchSettings
              :model-value="launchOptions"
              :task-id="detail.task.id"
              :organization-name="ourParty?.organizationName || settings?.organizationName || '尚未设置'"
              :counterparty="counterparty"
              :disabled="!editable || busy || pending"
              class="launch-options"
              @update:model-value="editLaunchOptions"
            />
            <div class="launch-actions">
              <el-button :disabled="busy || pending" @click="selectStep(2)">返回上一步</el-button>
              <el-button
                v-if="editable"
                type="primary"
                :disabled="
                  busy ||
                  dirty ||
                  pending ||
                  !positionsConfirmed ||
                  !launchReady ||
                  !auth.hasPermi('signing:task:start')
                "
                @click="start"
              >
                确认并发起签署
              </el-button>
              <span v-else class="stage-hint">当前账号没有发起权限，或草稿正在等待平台结果核对。</span>
              <el-button v-if="editable" :disabled="busy || pending" @click="cancelDraft">取消本地草稿</el-button>
              <el-button
                v-if="detail.task.operationStatus === 'UNKNOWN' && auth.hasPermi('signing:task:reconcile')"
                type="warning"
                :disabled="busy"
                @click="reconcile"
              >
                关联已核对的平台流程
              </el-button>
            </div>
          </div>
          <template v-else>
            <SigningLaunchSettings
              :model-value="launchOptions"
              :task-id="detail.task.id"
              :organization-name="ourParty?.organizationName || ''"
              :counterparty="counterparty"
              :disabled="true"
              class="launch-options readonly-launch-options"
            />
            <div class="platform-summary">
              <div>
                <span>发起结果</span>
                <strong>{{ detail.task.flowId ? '已创建平台流程' : '等待核对平台结果' }}</strong>
              </div>
              <div>
                <span>平台流程号</span>
                <strong>{{ detail.task.flowId || '尚未返回' }}</strong>
              </div>
              <div>
                <span>平台环境</span>
                <strong>{{ detail.task.providerEnvironment || '—' }}</strong>
              </div>
            </div>
          </template>
        </el-card>

        <el-card
          v-else-if="selectedStep === 4"
          id="signing-step-panel"
          key="signing-step-4"
          role="tabpanel"
          :aria-labelledby="`signing-step-tab-${selectedStep}`"
          class="workflow-stage"
          shadow="never"
        >
          <template #header>
            <div class="stage-heading">
              <span class="stage-number" :class="stageNumberClass(4)">5</span>
              <div class="stage-copy">
                <strong>对方签署</strong>
                <span>查看签署方的顺序、通知账号和平台返回状态。</span>
              </div>
              <el-tag :type="launchStageTagType">{{ signingStatusLabels[detail.task.status] }}</el-tag>
            </div>
          </template>
          <div v-if="detail.task.status === 'DRAFT'" class="waiting-panel">
            <span class="waiting-icon">
              <el-icon :size="20"><Clock /></el-icon>
            </span>
            <strong>等待发起签署</strong>
            <span>发起签署后，平台会按设定顺序通知各方办理签署。</span>
          </div>
          <div v-else-if="['REJECTED', 'REVOKED', 'EXPIRED'].includes(detail.task.status)" class="waiting-panel">
            <span class="waiting-icon is-danger">
              <el-icon :size="20"><WarningFilled /></el-icon>
            </span>
            <strong>{{ signingStatusLabels[detail.task.status] }}</strong>
            <span>本次签署流程已结束，可查看流程记录了解处理情况。</span>
          </div>
          <div v-else class="platform-summary">
            <div>
              <span>流程状态</span>
              <strong>{{ signingStatusLabels[detail.task.status] }}</strong>
            </div>
            <div>
              <span>平台流程号</span>
              <strong>{{ detail.task.flowId || '等待平台返回' }}</strong>
            </div>
            <div>
              <span>平台环境</span>
              <strong>{{ detail.task.providerEnvironment || '—' }}</strong>
            </div>
          </div>
          <el-table :data="detail.parties.length ? detail.parties : parties" border class="party-status-table">
            <el-table-column label="签署顺序" prop="signOrder" width="110" />
            <el-table-column label="签署角色" width="120">
              <template #default="{ row }">{{ row.role === 'OUR' ? '我方' : '对方' }}</template>
            </el-table-column>
            <el-table-column prop="organizationName" label="签署机构" min-width="180" />
            <el-table-column prop="transactorName" label="授权经办人" min-width="140" />
            <el-table-column prop="transactorAccount" label="通知账号" min-width="160" />
            <el-table-column prop="status" label="签署状态" width="140">
              <template #default="{ row }">
                <el-tag :type="partyStatusTagType(row.status)">
                  {{ partyStatusLabels[row.status ?? 'WAITING'] ?? '等待签署' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="detail.task.flowId || detail.task.status === 'SIGNING'" class="stage-action">
            <span class="stage-hint">平台状态会自动同步，也可以手动请求刷新。</span>
            <div class="actions">
              <el-button v-if="detail.task.flowId" :disabled="busy || pending" @click="act('sync')">
                同步平台状态
              </el-button>
              <el-button
                v-if="detail.task.status === 'SIGNING' && auth.hasPermi('signing:task:revoke')"
                type="danger"
                plain
                :disabled="busy || pending"
                @click="revoke"
              >
                撤销签署
              </el-button>
            </div>
          </div>
        </el-card>

        <el-card
          v-else-if="selectedStep === 5"
          id="signing-step-panel"
          key="signing-step-5"
          role="tabpanel"
          :aria-labelledby="`signing-step-tab-${selectedStep}`"
          class="workflow-stage"
          shadow="never"
        >
          <template #header>
            <div class="stage-heading">
              <span class="stage-number" :class="stageNumberClass(5)">6</span>
              <div class="stage-copy">
                <strong>签署结果</strong>
                <span>同步 e签宝流程状态，并获取最终合同文件供查看。</span>
              </div>
              <el-tag :type="archiveStageTagType">{{ archiveLabels[detail.task.archiveStatus] }}</el-tag>
            </div>
          </template>
          <el-alert
            v-if="detail.task.status === 'COMPLETED'"
            title="e签宝已确认签署流程完成"
            type="success"
            :closable="false"
            class="page-alert"
          />
          <div class="archive-panel">
            <div class="archive-indicator" :class="`archive-${detail.task.archiveStatus.toLowerCase()}`">
              <span class="archive-badge">
                <el-icon :class="{ 'is-loading': detail.task.archiveStatus === 'PENDING' }" :size="18">
                  <component :is="archiveIcon(detail.task.archiveStatus, detail.task.status)" />
                </el-icon>
              </span>
              <div>
                <strong>{{ archiveTitle }}</strong>
                <span>{{ archiveDescription }}</span>
              </div>
            </div>
            <el-button
              v-if="detail.task.archiveStatus === 'READY'"
              :disabled="!auth.hasPermi('signing:task:download')"
              @click="preview(signedDocumentId)"
            >
              查看已签合同
            </el-button>
          </div>
          <div v-if="detail.task.archiveStatus !== 'READY' && detail.task.flowId" class="stage-action">
            <span class="stage-hint">如果平台已完成签署，可手动同步以重试获取最终文件。</span>
            <el-button :disabled="busy || pending" @click="act('sync')">同步平台并重试保存</el-button>
          </div>
          <el-collapse class="history-collapse">
            <el-collapse-item title="流程记录" name="events">
              <el-timeline v-if="detail.events.length">
                <el-timeline-item v-for="event in detail.events" :key="event.id" :timestamp="event.createTime">
                  {{ eventLabels[event.kind] ?? event.kind }} · {{ event.actor }}
                </el-timeline-item>
              </el-timeline>
              <el-empty v-else description="暂无流程记录" :image-size="48" />
            </el-collapse-item>
            <el-collapse-item title="维护记录" name="audit">
              <el-descriptions :column="2" border>
                <el-descriptions-item label="创建人">{{ detail.task.createBy }}</el-descriptions-item>
                <el-descriptions-item label="创建时间">{{ detail.task.createTime }}</el-descriptions-item>
                <el-descriptions-item label="修改人">{{ detail.task.updateBy }}</el-descriptions-item>
                <el-descriptions-item label="修改时间">{{ detail.task.updateTime }}</el-descriptions-item>
              </el-descriptions>
            </el-collapse-item>
          </el-collapse>
        </el-card>
      </transition>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Back,
  CircleCheck,
  CircleCheckFilled,
  CircleCloseFilled,
  Clock,
  Document,
  FolderOpened,
  Loading,
  Refresh,
  Stamp,
  View,
  WarningFilled
} from '@element-plus/icons-vue'
import auth from '@/plugins/auth'
import SigningDocumentSource from '@/components/signing/SigningDocumentSource/index.vue'
import SigningParticipants from '@/components/signing/SigningParticipants/index.vue'
import SigningPosition from '@/components/signing/SigningPosition/index.vue'
import SigningProgress from '@/components/signing/SigningProgress/index.vue'
import SigningLaunchSettings from '@/components/signing/SigningLaunchSettings/index.vue'
import { openContractBlob, openOfficialUrl } from '@/components/signing/files'
import * as api from '@/api/signing'
import { signingSourceRoute } from '@/integrations/signing/businesses'
import type {
  SigningDetail,
  SigningParty,
  SigningSettings,
  TemplateBinding,
  SigningLaunchOptions
} from '@/types/api/signing'
import { signingStatusLabels } from '@/types/api/signing'
import { getSigningErrorMessage } from '@/utils/signingError'

const eventLabels: Record<string, string> = {
  CREATED: '建立签署草稿',
  PREPARE: '准备合同文件',
  PARTICIPANTS_CONFIRMED: '保存签署方及位置',
  START_REQUESTED: '请求发起签署',
  SYNC: '请求同步状态',
  REVOKE: '请求撤销签署',
  LOCAL_DRAFT_CANCELLED: '取消本地草稿',
  GET_SEAL_POSITION: '接收落章位置',
  SIGN_FLOW_COMPLETE: '接收签署流程结束通知',
  SIGN_MISSON_COMPLETE: '接收签署方结果'
}
const partyStatusLabels: Record<string, string> = {
  WAITING: '等待签署',
  SIGNING: '签署中',
  SIGNED: '已签署',
  APPROVAL_PENDING: '用印审批中',
  REJECTED: '已拒签',
  UNKNOWN: '待核对'
}
const archiveLabels = { NONE: '文件待保存', PENDING: '文件保存中', READY: '文件已保存', FAILED: '文件保存失败' }
const documentKindLabels = { SOURCE: '原始文件', PREPARED: '待签文件', SIGNED: '已签合同' }

const route = useRoute()
const router = useRouter()
const detail = ref<SigningDetail | null>(null)
const settings = ref<SigningSettings | null>(null)
const bindings = ref<TemplateBinding[]>([])
const loading = ref(false)
const busy = ref(false)
const dirty = ref(false)
const launchDirty = ref(false)
const launchOptions = ref<SigningLaunchOptions>({ autoSign: false, seal: null })
const error = ref('')
const source = ref<'TEMPLATE' | 'UPLOAD'>('TEMPLATE')
const bindingId = ref<string>()
const file = ref<File | null>(null)
const parties = ref<SigningParty[]>([])
const selectedStep = ref(0)
const stepSelectionLocked = ref(false)
let sequence = 0
let timer: ReturnType<typeof setInterval> | undefined
let formVersion = 0
let launchVersion = 0

const taskId = computed(() => (route.params.id ? String(route.params.id) : null))
const businessType = computed(() => detail.value?.task.businessType ?? String(route.query.businessType ?? ''))
const businessId = computed(() => detail.value?.task.businessId ?? String(route.query.businessId ?? ''))
const pending = computed(() => !!detail.value && ['QUEUED', 'RUNNING'].includes(detail.value.task.operationStatus))
const pageMaskVisible = computed(() => loading.value || busy.value || pending.value)
const pageMaskText = computed(() => {
  if (pending.value && detail.value?.task.documentStatus === 'PREPARING') {
    return '正在准备合同文件并与 e签宝同步，请稍候…'
  }
  if (pending.value) {
    return '系统正在与 e签宝同步，请稍候…'
  }
  if (loading.value) {
    return '正在加载签署信息…'
  }
  return '正在提交操作，请稍候…'
})
const shouldPollTask = computed(
  () =>
    !!detail.value &&
    (pending.value || detail.value.task.status === 'SIGNING' || detail.value.task.archiveStatus === 'PENDING')
)
const editable = computed(
  () =>
    detail.value?.task.status === 'DRAFT' &&
    !detail.value.task.flowId &&
    detail.value.task.operationStatus !== 'UNKNOWN' &&
    auth.hasPermi('signing:task:start')
)
const documentReady = computed(() => detail.value?.task.documentStatus === 'READY')
const ourParty = computed(() => parties.value.find((party) => party.role === 'OUR'))
const counterparty = computed(() => parties.value.find((party) => party.role === 'COUNTERPARTY'))
const hasUnsavedChanges = computed(() => dirty.value || launchDirty.value)
const launchReady = computed(() => {
  const seal = launchOptions.value.seal
  if (seal && !['ENABLED', 'UNKNOWN'].includes(seal.status)) return false
  return !launchOptions.value.autoSign || !!seal
})
const partiesReady = computed(
  () =>
    parties.value.length > 0 &&
    parties.value.every(
      (party) => party.autoSign || (!!party.transactorName.trim() && !!party.transactorAccount.trim())
    )
)
const positionsConfirmed = computed(() => !!detail.value?.task.positionDocumentHash && !dirty.value)
const workflowStep = computed(() => {
  if (detail.value?.task.status === 'COMPLETED') return 5
  if (
    detail.value?.task.status === 'SIGNING' ||
    ['REJECTED', 'REVOKED', 'EXPIRED'].includes(detail.value?.task.status ?? '')
  ) {
    return 4
  }
  if (!documentReady.value) return 0
  if (detail.value?.parties.length !== 2 || !partiesReady.value) return 1
  if (!positionsConfirmed.value) return 2
  return 3
})
const documentStageLabel = computed(() => {
  if (detail.value?.task.documentStatus === 'READY') return '已完成'
  if (detail.value?.task.documentStatus === 'PREPARING') return '准备中'
  if (detail.value?.task.documentStatus === 'FAILED') return '需处理'
  return '待处理'
})
const documentStageTagType = computed(() =>
  detail.value?.task.documentStatus === 'READY'
    ? 'success'
    : detail.value?.task.documentStatus === 'FAILED'
      ? 'danger'
      : 'info'
)
const partyStageLabel = computed(() => {
  if (!documentReady.value) return '等待文件'
  if (detail.value?.parties.length !== 2) return '待确认'
  return partiesReady.value ? '信息完整' : '待补全'
})
const partyStageTagType = computed(() => (partiesReady.value ? 'success' : 'warning'))
const positionStageLabel = computed(() => {
  if (!documentReady.value) return '等待文件'
  if (positionsConfirmed.value) return '已确认'
  return parties.value.some((party) => party.positions.length) ? '待确认' : '待配置'
})
const positionStageTagType = computed(() => (positionsConfirmed.value ? 'success' : 'warning'))
const launchStageLabel = computed(() => {
  if (detail.value?.task.status === 'SIGNING') return '签署中'
  if (detail.value?.task.status === 'COMPLETED') return '已完成'
  if (detail.value?.task.status === 'REJECTED') return '已拒签'
  if (detail.value?.task.status === 'REVOKED') return '已撤销'
  if (detail.value?.task.status === 'EXPIRED') return '已过期'
  return positionsConfirmed.value ? '待发起' : '待完成前置步骤'
})
const launchStageTagType = computed(() => {
  if (detail.value?.task.status === 'COMPLETED') return 'success'
  if (['REJECTED', 'REVOKED', 'EXPIRED'].includes(detail.value?.task.status ?? '')) return 'danger'
  return detail.value?.task.status === 'SIGNING' ? 'primary' : 'info'
})
const archiveStageTagType = computed(() => {
  if (detail.value?.task.archiveStatus === 'READY') return 'success'
  if (detail.value?.task.archiveStatus === 'FAILED') return 'danger'
  return 'warning'
})
const archiveTitle = computed(() => {
  if (detail.value?.task.archiveStatus === 'READY') return '最终签署文件已保存'
  if (detail.value?.task.archiveStatus === 'PENDING') return '正在保存最终签署文件'
  if (detail.value?.task.archiveStatus === 'FAILED') return '最终签署文件保存失败'
  if (['REJECTED', 'REVOKED', 'EXPIRED'].includes(detail.value?.task.status ?? ''))
    return '流程已终止，未形成完整签署文件'
  return detail.value?.task.status === 'COMPLETED' ? '平台流程已完成' : '等待签署完成'
})
const archiveDescription = computed(() => {
  if (detail.value?.task.archiveStatus === 'READY') return '最终合同已保存，可从上方合同文件区域重新查看。'
  if (detail.value?.task.archiveStatus === 'PENDING') return '系统正在下载并保存最终签署文件，完成后会自动更新。'
  if (detail.value?.task.archiveStatus === 'FAILED') {
    return getSigningErrorMessage(detail.value?.task.lastError) || '可同步平台状态后重试保存。'
  }
  if (['REJECTED', 'REVOKED', 'EXPIRED'].includes(detail.value?.task.status ?? ''))
    return '本次流程已结束，未完成的合同不会作为最终签署文件保存。'
  if (detail.value?.task.status === 'COMPLETED') return '平台已确认完成，最终合同文件尚未保存。'
  return '平台确认流程完成后，系统会自动获取最终签署文件。'
})
const signedDocumentId = computed(
  () => detail.value?.documents.find((document) => document.kind === 'SIGNED' && document.sha256)?.id ?? ''
)
const taskStatusTagType = computed(() => {
  if (detail.value?.task.status === 'COMPLETED') return 'success'
  if (['REJECTED', 'REVOKED', 'EXPIRED'].includes(detail.value?.task.status ?? '')) return 'danger'
  return detail.value?.task.status === 'SIGNING' ? 'primary' : 'info'
})
watch(
  [workflowStep, pending, loading],
  () => {
    if (stepSelectionLocked.value || loading.value || pending.value || !detail.value) return
    selectedStep.value = workflowStep.value
    stepSelectionLocked.value = true
  },
  { immediate: true }
)
watch(
  () => detail.value?.task.status,
  (status, previousStatus) => {
    if (status !== 'COMPLETED' || previousStatus === 'COMPLETED') return
    selectedStep.value = 5
    stepSelectionLocked.value = true
  },
  { immediate: true }
)

function selectStep(index: number) {
  selectedStep.value = index
  stepSelectionLocked.value = true
}

function stageNumberClass(index: number) {
  if (index < workflowStep.value || (index === 5 && detail.value?.task.status === 'COMPLETED')) return 'is-done'
  if (index === workflowStep.value) return 'is-current'
  return 'is-pending'
}

function archiveIcon(status: string, taskStatus: string) {
  if (status === 'READY') return CircleCheckFilled
  if (status === 'PENDING') return Loading
  if (status === 'FAILED') return CircleCloseFilled
  if (['REJECTED', 'REVOKED', 'EXPIRED'].includes(taskStatus)) return WarningFilled
  return Clock
}

function blankParties(): SigningParty[] {
  const defaults = detail.value?.defaultCounterparty
  return [
    {
      role: 'OUR',
      partyType: 'ORGANIZATION',
      organizationName: settings.value?.organizationName ?? '',
      transactorName: settings.value?.currentUserName ?? '',
      transactorAccount: settings.value?.currentUserAccount ?? '',
      autoSign: false,
      signOrder: 1,
      positions: []
    },
    {
      role: 'COUNTERPARTY',
      partyType: 'ORGANIZATION',
      organizationName: defaults?.organizationName ?? '',
      transactorName: defaults?.transactorName ?? '',
      transactorAccount: defaults?.transactorAccount ?? '',
      autoSign: false,
      signOrder: 2,
      positions: []
    }
  ]
}
async function load(quiet = false) {
  if (!taskId.value) return
  const current = ++sequence
  if (!quiet) loading.value = true
  try {
    const response = await api.signingDetail(taskId.value)
    if (current !== sequence) return
    detail.value = response.data
    if (!dirty.value) {
      parties.value = response.data.parties.length ? structuredClone(response.data.parties) : blankParties()
      formVersion = response.data.task.version
    }
    if (!launchDirty.value || response.data.task.status !== 'DRAFT' || response.data.task.flowId) {
      const saved = response.data.parties.find((party) => party.role === 'OUR')
      launchOptions.value = {
        autoSign: saved?.autoSign ?? false,
        seal: saved?.sealId
          ? {
              id: saved.sealId,
              name: saved.sealName || saved.sealId,
              organizationId: saved.organizationId ?? null,
              organizationName: saved.organizationName,
              type: saved.sealType ?? 'UNSUPPORTED',
              status: 'UNKNOWN',
              statusDescription: '发起时所选印章',
              defaultSeal: false,
              width: null,
              height: null,
              selectable: false,
              previewAvailable: true
            }
          : null
      }
      launchVersion = response.data.task.version
      launchDirty.value = false
    }
    error.value = ''
  } catch {
    if (current === sequence) error.value = '签署详情加载失败，可刷新重试'
  } finally {
    if (current === sequence) loading.value = false
  }
}
async function run(action: () => Promise<void>) {
  if (busy.value) return
  busy.value = true
  try {
    await action()
    error.value = ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '操作失败，请重试'
  } finally {
    busy.value = false
  }
}
function editParties(value: SigningParty[]) {
  parties.value = value
  dirty.value = true
}
function editLaunchOptions(value: SigningLaunchOptions) {
  if (!launchDirty.value) launchVersion = detail.value?.task.version ?? 0
  launchOptions.value = value
  launchDirty.value = true
}
function formatFileSize(size: number) {
  if (!size) return '大小未知'
  return size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / (1024 * 1024)).toFixed(2)} MB`
}
function partyStatusTagType(status?: string) {
  if (status === 'SIGNED') return 'success'
  if (status === 'REJECTED') return 'danger'
  if (status === 'SIGNING') return 'primary'
  return 'info'
}
function create() {
  void run(async () => {
    const result = await api.createSigning({
      businessType: businessType.value,
      businessId: businessId.value,
      source: source.value,
      bindingId: bindingId.value
    })
    dirty.value = false
    await router.replace(`/signing/task/${result.data.id}`)
    await load()
    await prepare()
  })
}
async function prepare() {
  if (!detail.value) return
  const task = detail.value.task
  const perform = async () => {
    if (task.source === 'UPLOAD') {
      if (!file.value) throw new Error('请选择完整合同文件')
      await api.uploadSigningFile(task.id, task.version, file.value)
    } else {
      await api.signingAction(task.id, 'prepare', task.version)
    }
    dirty.value = false
    await load()
  }
  if (busy.value) await perform()
  else await run(perform)
}
async function saveParties(confirm: boolean): Promise<boolean> {
  if (!detail.value) return false
  let succeeded = false
  await run(async () => {
    const result = await api.saveSigningParties(detail.value!.task.id, formVersion, parties.value, confirm)
    if (launchDirty.value) launchVersion = result.data.version
    dirty.value = false
    await load()
    ElMessage.success(confirm ? '文件与签章位置已确认' : '签署方信息已保存')
    succeeded = true
  })
  return succeeded
}
async function savePartiesAndContinue(confirmPositions: boolean) {
  const succeeded = await saveParties(confirmPositions)
  if (succeeded) selectStep(confirmPositions ? 3 : 2)
}
async function openPosition() {
  if (!detail.value) return
  const target = window.open('about:blank', '_blank')
  await run(async () => {
    try {
      const result = await api.signingPositionUrl(detail.value!.task.id, detail.value!.task.version)
      openOfficialUrl(result.data.url, target)
      await load()
    } catch (cause) {
      target?.close()
      throw cause
    }
  })
}
async function preview(documentId: string) {
  if (!detail.value || !documentId) return
  const document = detail.value.documents.find((item) => item.id === documentId)
  if (!document) return
  const target = window.open('about:blank', '_blank')
  await run(async () => {
    try {
      const file = await api.signingFile(detail.value!.task.id, documentId)
      await openContractBlob(file.blob, target, file.fileName || document.fileName)
    } catch (cause) {
      target?.close()
      throw cause
    }
  })
}
async function act(action: 'sync' | 'revoke' | 'reconcile' | 'cancel', reason = '', flowId = '') {
  if (!detail.value) return
  await run(async () => {
    await api.signingAction(detail.value!.task.id, action, detail.value!.task.version, reason, flowId)
    dirty.value = false
    if (action === 'cancel') launchDirty.value = false
    await load()
  })
}
async function start() {
  if (!detail.value || !launchReady.value || dirty.value || !positionsConfirmed.value || busy.value || pending.value)
    return
  const task = detail.value.task
  const options = launchOptions.value
  const data = {
    version: launchDirty.value ? launchVersion : task.version,
    autoSign: options.autoSign,
    sealId: options.seal?.id ?? null
  }
  const count = ourParty.value?.positions.length ?? 0
  const mode = options.autoSign ? '自动落章' : '手动签署'
  const sealName = options.seal?.name || options.seal?.id || '由经办人在 e签宝签署页选择'
  try {
    await ElMessageBox.confirm(
      `我方签署方式：${mode}；印章：${sealName}；已确认 ${count} 个我方落章位置。${options.autoSign ? '流程到达我方节点时，平台将自动盖章。' : ''}确认发起签署？`,
      '发起签署',
      { confirmButtonText: '确认并发起签署', type: options.autoSign ? 'warning' : 'info' }
    )
    await run(async () => {
      await api.startSigning(task.id, data)
      launchDirty.value = false
      stepSelectionLocked.value = false
      selectedStep.value = 4
      await load()
    })
  } catch {
    /* 用户取消 */
  }
}
async function revoke() {
  try {
    const result = await ElMessageBox.prompt('请输入撤销原因', '撤销签署', {
      inputValidator: (value: string) => !!value?.trim() || '撤销原因必填'
    })
    await act('revoke', result.value)
  } catch {
    /* 用户取消 */
  }
}
async function cancelDraft() {
  try {
    await ElMessageBox.confirm('尚未创建平台流程的本地草稿将被取消，之后可重新发起。', '取消草稿')
    await act('cancel')
  } catch {
    /* 用户取消 */
  }
}
async function reconcile() {
  try {
    const result = await ElMessageBox.prompt(
      '请先在 e签宝核实创建结果，再填写平台流程 ID。系统会验证该流程包含当前待签文件。',
      '核对平台流程',
      { inputValidator: (value: string) => !!value?.trim() || '流程 ID 必填' }
    )
    await act('reconcile', '', result.value)
  } catch {
    /* 用户取消 */
  }
}
function back() {
  const sourcePath = signingSourceRoute(businessType.value, businessId.value)
  router.push(sourcePath ?? '/signing/task')
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (hasUnsavedChanges.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
watch([source, bindingId, file], () => {
  if (!detail.value) dirty.value = true
})
onBeforeRouteLeave(async () => {
  if (!hasUnsavedChanges.value) return true
  try {
    await ElMessageBox.confirm('页面存在尚未提交的文件、签署方或用章设置，确定离开？', '未保存修改')
    return true
  } catch {
    return false
  }
})
onMounted(async () => {
  window.addEventListener('beforeunload', beforeUnload)
  await run(async () => {
    settings.value = (await api.signingSettings()).data
    if (!taskId.value) {
      if (!businessType.value || !businessId.value) {
        throw new Error('请从签署任务列表或业务单据选择来源后发起签署')
      }
      bindings.value = (await api.signingBindings(businessType.value)).data.filter((item) => item.enabled)
    } else {
      await load()
    }
  })
  timer = setInterval(() => {
    if (
      taskId.value &&
      shouldPollTask.value &&
      document.visibilityState === 'visible' &&
      !busy.value &&
      !loading.value
    ) {
      void load(true)
    }
  }, 15000)
})
onBeforeUnmount(() => {
  ++sequence
  if (timer) clearInterval(timer)
  window.removeEventListener('beforeunload', beforeUnload)
})
</script>

<style scoped lang="scss">
.signing-editor {
  position: relative;
  min-height: calc(100vh - 160px);
}

.document-bar,
.actions,
.stage-heading,
.stage-action,
.document-row,
.document-info,
.create-footer,
.launch-actions,
.archive-panel,
.heading-copy {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.document-bar {
  justify-content: space-between;
  margin-bottom: 18px;
}

.page-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.heading-icon {
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

.heading-copy strong {
  font-size: 20px;
}

.page-alert {
  margin: 14px 0;
}

.workflow-progress {
  margin-bottom: 16px;
}

.workflow-stage {
  margin: 16px 0;
  border-color: var(--el-border-color-lighter);
}

.stage-fade-enter-active,
.stage-fade-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.stage-fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.stage-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.stage-heading {
  flex-wrap: nowrap;
  width: 100%;
}

.stage-number {
  display: inline-flex;
  flex: 0 0 30px;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--el-border-color);
  border-radius: 50%;
  color: var(--el-text-color-secondary);
  font-size: 14px;
  font-weight: 400;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    color 0.18s ease;
}

.stage-number.is-current {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary);
  color: var(--el-color-white);
  font-weight: 600;
}

.stage-number.is-done {
  border-color: var(--el-color-success);
  background: var(--el-color-success);
  color: var(--el-color-white);
}

.stage-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.stage-copy strong {
  color: var(--el-text-color-primary);
  font-size: 15px;
}

.stage-copy span,
.stage-hint {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.55;
}

.document-list {
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.document-row {
  justify-content: space-between;
  padding: 12px 14px;
  transition: background-color 0.15s ease;
}

.document-row:hover {
  background: var(--el-fill-color-lighter);
}

.document-row + .document-row {
  border-top: 1px solid var(--el-border-color-lighter);
}

.document-info {
  min-width: 0;
}

.document-icon {
  display: inline-flex;
  flex: 0 0 36px;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-size: 18px;
}

.document-icon.is-signed {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.document-name {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.document-name strong {
  overflow-wrap: anywhere;
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 500;
}

.document-name span {
  overflow-wrap: anywhere;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.document-kind-tag {
  margin-right: 6px;
  vertical-align: 1px;
}

.stage-action {
  align-items: center;
  gap: 8px 16px;
  justify-content: space-between;
  margin-top: 16px;
}

.stage-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-left: auto;
}

.readonly-hint {
  margin-top: 12px;
}

.upload-control {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.upload-pick {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: 1px dashed var(--el-color-primary-light-5);
  border-radius: 6px;
  color: var(--el-color-primary);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.upload-pick:hover {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.upload-file {
  overflow: hidden;
  max-width: 260px;
  color: var(--el-text-color-regular);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.launch-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 16px;
  border: 1px solid var(--el-color-primary-light-8);
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
}

.launch-panel > .launch-options {
  flex: 0 0 100%;
  min-width: 0;
}
.launch-panel > .launch-checklist {
  flex: 0 0 100%;
}
.launch-panel > .launch-actions {
  width: 100%;
}
.readonly-launch-options {
  margin-bottom: 18px;
}

.launch-checklist {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
}

.launch-check-item {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.launch-check-item .check-icon {
  font-size: 16px;
  color: var(--el-border-color-dark);
}

.launch-check-item.complete {
  color: var(--el-color-success);
}

.launch-check-item.complete .check-icon {
  color: var(--el-color-success);
}

.launch-actions {
  justify-content: flex-end;
}

.platform-summary {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  margin-bottom: 16px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.platform-summary > div {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  padding: 12px 14px;
}

.platform-summary > div + div {
  border-left: 1px solid var(--el-border-color-lighter);
}

.platform-summary span,
.platform-summary strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.platform-summary span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.platform-summary strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 500;
}

.waiting-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 28px 16px;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  text-align: center;
}

.waiting-panel strong {
  color: var(--el-text-color-primary);
  font-size: 15px;
}

.waiting-panel > span:not(.waiting-icon) {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.waiting-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
}

.waiting-icon.is-danger {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.party-status-table {
  width: 100%;
}

.archive-panel {
  justify-content: space-between;
  padding: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.archive-indicator {
  display: flex;
  align-items: center;
  gap: 12px;
}

.archive-badge {
  display: inline-flex;
  flex: 0 0 36px;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
}

.archive-ready .archive-badge {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.archive-failed .archive-badge {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.archive-pending .archive-badge {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
}

.archive-indicator > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.archive-indicator strong {
  color: var(--el-text-color-primary);
  font-size: 14px;
}

.archive-indicator span:not(.archive-badge) {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.history-collapse {
  margin-top: 18px;
}

.create-steps {
  margin: 0 0 24px;
}

.create-footer {
  justify-content: space-between;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.create-footer span {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

@media (max-width: 760px) {
  .stage-heading {
    align-items: flex-start;
  }

  .stage-heading > .el-tag {
    margin-left: auto;
  }

  .launch-checklist {
    flex-direction: column;
  }

  .platform-summary {
    grid-template-columns: 1fr;
  }

  .platform-summary > div + div {
    border-top: 1px solid var(--el-border-color-lighter);
    border-left: 0;
  }

  .create-footer {
    align-items: flex-start;
  }
}
</style>

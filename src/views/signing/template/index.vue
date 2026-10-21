<template>
  <div v-loading="loading" class="app-container template-config">
    <div class="document-bar">
      <div class="page-heading">
        <span class="heading-icon">
          <el-icon><Tickets /></el-icon>
        </span>
        <div class="heading-copy">
          <strong>合同模板配置</strong>
          <span>维护各业务场景的 e签宝合同模板与字段映射</span>
        </div>
      </div>
      <div class="actions">
        <el-button @click="reload">
          <el-icon><Refresh /></el-icon>
          <span>刷新</span>
        </el-button>
      </div>
    </div>

    <el-alert v-if="error" :title="error" type="warning" :closable="false" class="page-alert" />

    <div class="config-layout">
      <aside class="binding-panel">
        <div class="panel-title">业务场景</div>
        <el-select
          :model-value="businessType"
          :disabled="loading"
          placeholder="选择业务场景"
          @change="changeBusinessType"
        >
          <el-option
            v-for="scenario in scenarios"
            :key="scenario.businessType"
            :label="scenario.name"
            :value="scenario.businessType"
          />
        </el-select>
        <div class="panel-title" style="margin-top: 16px">已保存模板</div>
        <div class="binding-list">
          <button
            v-for="binding in bindings"
            :key="binding.id"
            type="button"
            class="binding-item"
            :class="{ 'is-active': form.id === binding.id }"
            @click="choose(binding.id)"
          >
            <div class="binding-item-head">
              <strong>{{ binding.name }}</strong>
              <el-tag size="small" effect="plain" :type="binding.enabled ? 'success' : 'info'">
                {{ binding.enabled ? '启用' : '停用' }}
              </el-tag>
            </div>
            <span class="binding-item-meta">{{ mappedCount(binding) }} 个字段已映射</span>
          </button>
          <el-empty v-if="!bindings.length" description="暂无已保存模板" :image-size="60" />
        </div>
        <el-button class="add-binding" @click="reset">
          <el-icon><Plus /></el-icon>
          <span>新增模板绑定</span>
        </el-button>
      </aside>

      <section class="editor-panel">
        <el-card shadow="never" class="config-card">
          <template #header>
            <div class="card-heading">
              <div class="card-title">
                <strong>基本信息</strong>
                <span>模板名称、平台模板与启用状态</span>
              </div>
              <el-tag v-if="form.id" size="small" effect="plain" type="info">已保存</el-tag>
              <el-tag v-else size="small" effect="plain" type="warning">未保存</el-tag>
            </div>
          </template>
          <el-form label-position="top" class="base-form">
            <div class="base-grid">
              <el-form-item label="模板显示名称" required>
                <el-input
                  v-model="form.name"
                  maxlength="100"
                  placeholder="例如：业务合同标准模板"
                  @input="dirty = true"
                />
              </el-form-item>
              <el-form-item label="业务场景">
                <el-input :model-value="businessName" disabled />
              </el-form-item>
              <el-form-item label="启用状态">
                <div class="switch-row">
                  <el-switch v-model="form.enabled" @change="dirty = true" />
                  <span class="switch-tip">
                    {{ form.enabled ? '发起签署时可以选择该模板' : '发起签署时隐藏该模板' }}
                  </span>
                </div>
              </el-form-item>
              <el-form-item label="e签宝平台模板" required class="platform-field">
                <div class="platform-picker">
                  <el-button class="template-select-button" @click="templateDialogVisible = true">
                    <span class="template-select-name">
                      {{ selectedPlatform?.name || (form.templateId ? '已选择平台模板' : '选择平台模板') }}
                    </span>
                  </el-button>
                  <div v-if="selectedPlatform" class="selected-template-meta">
                    <span>创建时间：{{ formatPlatformTime(selectedPlatform.createTime) }}</span>
                  </div>
                </div>
              </el-form-item>
            </div>
          </el-form>
        </el-card>

        <el-card shadow="never" class="config-card">
          <template #header>
            <div class="card-heading">
              <div class="card-title">
                <strong>字段映射</strong>
                <span>将平台模板控件对应到当前业务场景字段</span>
              </div>
              <div class="card-actions">
                <el-button size="small" :disabled="!form.templateId" @click="editor">
                  <el-icon><EditPen /></el-icon>
                  <span>官方编辑页</span>
                </el-button>
                <el-button size="small" :disabled="!form.templateId" @click="readControls()">
                  <el-icon><MagicStick /></el-icon>
                  <span>读取最新控件</span>
                </el-button>
              </div>
            </div>
          </template>
          <TemplateFieldMapping
            v-model="form.mappings"
            :controls="controls"
            :fields="fields"
            @update:model-value="dirty = true"
          />
        </el-card>

        <el-card v-if="form.id" shadow="never" class="config-card">
          <template #header>
            <div class="card-heading">
              <div class="card-title">
                <strong>试填预览</strong>
                <span>选择满足发起条件的业务单据，使用真实数据检查映射效果</span>
              </div>
            </div>
          </template>
          <div class="preview-row">
            <div v-if="previewSource" class="preview-order-card">
              <span class="order-check">
                <el-icon :size="18"><CircleCheckFilled /></el-icon>
              </span>
              <div class="order-info">
                <strong>{{ previewSource.number }}</strong>
                <span class="order-info-meta">
                  {{ previewSource.counterpartyName }} · {{ previewSource.businessDate }}
                </span>
              </div>
              <el-button link type="primary" :disabled="dirty || loading" @click="openPreviewOrderPicker">
                更换单据
              </el-button>
            </div>
            <el-button v-else :disabled="dirty || loading" @click="openPreviewOrderPicker">
              <el-icon><Search /></el-icon>
              <span>选择业务单据</span>
            </el-button>
            <el-button
              class="preview-action"
              type="primary"
              :disabled="dirty || !previewSource || loading"
              :loading="loading"
              @click="preview"
            >
              <el-icon><View /></el-icon>
              <span>试填并预览</span>
            </el-button>
          </div>
          <p v-if="dirty" class="field-hint">当前有未保存修改，保存后才能预览。</p>
          <p v-else class="field-hint">使用所选业务单据的真实数据生成临时 PDF；不会创建签署任务。</p>
        </el-card>

        <div class="save-bar">
          <span v-if="dirty" class="dirty-tip">有未保存的更改</span>
          <span v-else class="saved-tip">更改已保存</span>
          <el-button type="primary" :disabled="!form.name || !form.templateId" @click="save">校验并保存映射</el-button>
        </div>
      </section>
    </div>

    <el-dialog
      v-model="templateDialogVisible"
      title="选择 e签宝平台模板"
      width="960px"
      append-to-body
      destroy-on-close
      class="platform-template-dialog"
    >
      <div class="platform-dialog-toolbar">
        <span>共 {{ platformTotal }} 个模板</span>
        <el-button size="small" :loading="platformLoading" @click="loadPlatform(platformPage)">
          <el-icon><Refresh /></el-icon>
          <span>刷新</span>
        </el-button>
      </div>
      <el-table
        v-loading="platformLoading"
        :data="platform"
        row-key="id"
        highlight-current-row
        class="platform-template-table"
      >
        <el-table-column prop="name" label="模板名称" min-width="480" show-overflow-tooltip />
        <el-table-column label="创建时间" width="210">
          <template #default="scope">{{ formatPlatformTime(scope.row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="scope">
            <el-button
              link
              type="primary"
              :disabled="form.templateId === scope.row.id"
              @click="selectPlatformTemplate(scope.row)"
            >
              {{ form.templateId === scope.row.id ? '当前模板' : '选择' }}
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="当前页没有可用模板" :image-size="70" />
        </template>
      </el-table>
      <div class="platform-dialog-footer">
        <el-pagination
          background
          layout="prev, pager, next, jumper"
          :current-page="platformPage"
          :page-size="20"
          :total="platformTotal"
          :disabled="platformLoading"
          @current-change="loadPlatform"
        />
      </div>
      <template #footer>
        <el-button @click="templateDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <SigningSourcePickerDialog
      v-model="previewSourceDialogVisible"
      :business-type="businessType"
      :business-name="businessName"
      :selected="previewSource"
      @select="previewSource = $event"
    />
  </div>
</template>
<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CircleCheckFilled, EditPen, MagicStick, Plus, Refresh, Search, Tickets, View } from '@element-plus/icons-vue'
import TemplateFieldMapping from '@/components/signing/TemplateFieldMapping/index.vue'
import { openOfficialUrl, openContractBlob } from '@/components/signing/files'
import * as api from '@/api/signing'
import type {
  TemplateBinding,
  TemplateControl,
  SigningField,
  SigningScenario,
  SigningSource
} from '@/types/api/signing'
import SigningSourcePickerDialog from '@/components/signing/SigningSourcePickerDialog/index.vue'

const route = useRoute()
const scenarios = ref<SigningScenario[]>([])
const businessType = ref(String(route.query.businessType ?? ''))
const businessName = computed(
  () => scenarios.value.find((entry) => entry.businessType === businessType.value)?.name ?? ''
)
const fresh = (): TemplateBinding => ({
  businessType: businessType.value,
  name: '',
  templateId: '',
  enabled: true,
  version: 0,
  mappings: []
})
const form = ref<TemplateBinding>(fresh())
let sequence = 0
const bindings = ref<TemplateBinding[]>([])
const controls = ref<TemplateControl[]>([])
const fields = ref<SigningField[]>([])
interface PlatformTemplate {
  id: string
  name: string
  createTime: number | string | null
}
const platform = ref<PlatformTemplate[]>([])
const platformCache = ref<Record<string, PlatformTemplate>>({})
const platformPage = ref(1)
const platformTotal = ref(0)
const platformLoading = ref(false)
const templateDialogVisible = ref(false)
const selectedPlatform = computed(() => platformCache.value[form.value.templateId] ?? null)
const loading = ref(false)
const dirty = ref(false)
const error = ref('')
const previewSourceDialogVisible = ref(false)
const previewSource = ref<SigningSource | null>(null)

async function changeBusinessType(type: string) {
  if (type === businessType.value || !(await confirmDiscard())) return
  businessType.value = type
  previewSource.value = null
  previewSourceDialogVisible.value = false
  form.value = fresh()
  controls.value = []
  dirty.value = false
  await reload()
}

function mappedCount(binding: TemplateBinding) {
  return binding.mappings.filter((mapping) => mapping.fieldKey).length
}
function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
async function run(action: () => Promise<void>, showToastOnError = false) {
  if (loading.value) return
  loading.value = true
  try {
    await action()
    error.value = ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '操作失败，可重试'
    if (showToastOnError) {
      ElMessage.error({ message: error.value, duration: 0, showClose: true })
    }
  } finally {
    loading.value = false
  }
}
async function reload() {
  if (!businessType.value) return
  await run(async () => {
    const result = await Promise.all([api.signingBindings(businessType.value), api.signingFields(businessType.value)])
    bindings.value = result[0].data
    fields.value = result[1].data
  })
}
async function loadPlatform(page: number) {
  const current = ++sequence
  platformLoading.value = true
  try {
    const result = await api.platformTemplates(page)
    if (current !== sequence) return
    const data = result.data
    const values = data.docTemplates ?? data.list ?? data.items ?? data.records ?? []
    if (!Array.isArray(values)) throw new Error('平台模板列表格式不匹配')
    platform.value = values
      .map((value) => {
        const entry = value as Record<string, unknown>
        return {
          id: String(entry.docTemplateId ?? ''),
          name: String(entry.docTemplateName ?? entry.name ?? '未命名模板'),
          createTime: (entry.createTime ?? entry.createdTime ?? null) as number | string | null
        }
      })
      .filter((value) => value.id)
    platformCache.value = {
      ...platformCache.value,
      ...Object.fromEntries(platform.value.map((template) => [template.id, template]))
    }
    platformPage.value = page
    const total = data.total ?? data.totalCount
    platformTotal.value = total === undefined || total === null ? platform.value.length : Number(total)
    error.value = ''
  } catch (cause) {
    if (current === sequence) {
      error.value = cause instanceof Error ? cause.message : '读取平台模板失败，可重试'
    }
  } finally {
    if (current === sequence) platformLoading.value = false
  }
}
function formatPlatformTime(value: number | string | null) {
  if (value === null || value === '') return '—'
  const numericValue = typeof value === 'number' ? value : Number(value)
  const timestamp = Number.isNaN(numericValue)
    ? Date.parse(String(value))
    : numericValue < 1000000000000
      ? numericValue * 1000
      : numericValue
  if (!Number.isFinite(timestamp)) return '—'
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(timestamp))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}:${part('second')}`
}
async function selectPlatformTemplate(template: PlatformTemplate) {
  if (form.value.templateId === template.id) {
    templateDialogVisible.value = false
    return
  }
  form.value.templateId = template.id
  templateDialogVisible.value = false
  await templateChanged()
}
async function confirmDiscard() {
  if (!dirty.value) return true
  try {
    await ElMessageBox.confirm('当前修改尚未保存，继续将丢失这些修改。', '未保存修改')
    return true
  } catch {
    return false
  }
}
async function reset() {
  if (!(await confirmDiscard())) return
  form.value = fresh()
  previewSource.value = null
  controls.value = []
  templateDialogVisible.value = false
  dirty.value = false
}
async function choose(id?: string) {
  if (form.value.id === id) return
  if (!(await confirmDiscard())) return
  const binding = bindings.value.find((value) => value.id === id)
  if (!binding) {
    form.value = fresh()
    previewSource.value = null
    controls.value = []
    dirty.value = false
    return
  }
  form.value = deepClone(binding)
  if (!platform.value.some((template) => template.id === binding.templateId)) {
    await loadPlatform(1)
  }
  dirty.value = false
  await readControls(false)
}
async function templateChanged() {
  dirty.value = true
  if (form.value.templateId) {
    await readControls(true)
  } else {
    controls.value = []
    form.value.mappings = []
  }
}
async function readControls(markDirty = true) {
  await run(async () => {
    controls.value = (await api.templateControls(form.value.templateId)).data
    const before = form.value.mappings
    form.value.mappings = controls.value
      .filter((value) => !['6', '17', '21'].includes(String(value.componentType ?? value.type)))
      .map((control) => {
        const existing = before.find((value) => value.componentId === control.componentId)
        return {
          componentId: control.componentId,
          componentType: String(control.componentType ?? control.type),
          fieldKey: existing?.fieldKey ?? '',
          columns: existing?.columns ?? {}
        }
      })
    if (markDirty) dirty.value = true
  })
}
async function save() {
  await run(async () => {
    const payload = deepClone(form.value)
    payload.mappings = payload.mappings.filter((value) => value.fieldKey)
    form.value = (await api.saveSigningBinding(payload)).data
    dirty.value = false
    bindings.value = (await api.signingBindings(businessType.value)).data
    ElMessage.success('模板映射已保存')
  })
}
async function editor() {
  const target = window.open('about:blank', '_blank')
  await run(async () => {
    try {
      openOfficialUrl((await api.templateEditorUrl(form.value.templateId)).data, target)
    } catch (cause) {
      target?.close()
      throw cause
    }
  })
}
async function preview() {
  if (!form.value.id || !previewSource.value) return
  const target = window.open('about:blank', '_blank')
  await run(async () => {
    try {
      await openContractBlob(
        await api.previewSigningBinding(form.value.id!, previewSource.value!.id),
        target,
        '合同模板预览.pdf'
      )
    } catch (cause) {
      target?.close()
      throw cause
    }
  }, true)
}
function openPreviewOrderPicker() {
  if (!dirty.value && !loading.value) previewSourceDialogVisible.value = true
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
onBeforeRouteLeave(async () => confirmDiscard())
onMounted(async () => {
  window.addEventListener('beforeunload', beforeUnload)
  try {
    scenarios.value = (await api.signingScenarios()).data
    if (!scenarios.value.some((entry) => entry.businessType === businessType.value)) {
      businessType.value = scenarios.value[0]?.businessType ?? ''
    }
    form.value = fresh()
    await reload()
    await loadPlatform(1)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '业务场景加载失败'
  }
})
onBeforeUnmount(() => {
  ++sequence
  window.removeEventListener('beforeunload', beforeUnload)
})
</script>
<style scoped lang="scss">
.document-bar,
.page-heading,
.actions,
.switch-row,
.platform-picker,
.platform-pager,
.preview-row {
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

.heading-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.heading-copy strong {
  color: var(--el-text-color-primary);
  font-size: 20px;
}

.heading-copy span {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.page-alert {
  margin: 0 0 14px;
}

.config-layout {
  display: grid;
  grid-template-columns: 290px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.binding-panel {
  position: sticky;
  top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-bg-color);
}

.panel-title {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.binding-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: calc(100vh - 300px);
  overflow-y: auto;
}

.binding-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    box-shadow 0.18s ease;
}

.binding-item:hover {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-fill-color-lighter);
}

.binding-item.is-active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  box-shadow: 0 0 0 3px var(--el-color-primary-light-8);
}

.binding-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.binding-item-head strong {
  overflow: hidden;
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.binding-item-meta {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.add-binding {
  width: 100%;
  border-style: dashed;
}

.editor-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.config-card {
  border-color: var(--el-border-color-lighter);
}

.config-card :deep(.el-card__header) {
  padding: 14px 18px;
}

.card-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.card-title {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.card-title strong {
  color: var(--el-text-color-primary);
  font-size: 14px;
}

.card-title span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.base-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 20px;
}

.platform-field {
  grid-column: 1 / -1;
}

.template-select {
  flex: 1;
  max-width: 480px;
}

.platform-picker {
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}

.template-select-button {
  display: flex;
  justify-content: flex-start;
  width: min(100%, 520px);
  min-height: 38px;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease;
}

.template-select-button.el-button:hover:not(.is-disabled),
.template-select-button.el-button:focus-visible {
  border-color: var(--el-color-primary);
  background-color: var(--el-color-primary);
  color: var(--el-color-white);
}

.template-select-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-template-meta,
.platform-dialog-toolbar,
.platform-dialog-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.selected-template-meta {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.platform-dialog-toolbar,
.platform-dialog-footer {
  justify-content: space-between;
  color: var(--el-text-color-secondary);
}

.platform-dialog-toolbar {
  margin-bottom: 12px;
}

.platform-dialog-footer {
  margin-top: 14px;
}

.platform-dialog-footer :deep(.el-pagination) {
  margin-left: auto;
}

.platform-template-table {
  width: 100%;
}

.platform-pager {
  flex-wrap: nowrap;
  gap: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  white-space: nowrap;
}

.switch-tip,
.field-hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.field-hint {
  margin: 6px 0 0;
}

.preview-input {
  max-width: 320px;
}

.preview-row {
  justify-content: space-between;
}

.preview-order-card {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 10px;
  min-width: 0;
  max-width: 560px;
  padding: 8px 12px;
  border: 1px solid var(--el-color-success-light-7);
  border-radius: 8px;
  background: var(--el-color-success-light-9);
}

.order-check {
  display: inline-flex;
  flex: 0 0 auto;
  color: var(--el-color-success);
}

.order-info {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.order-info strong {
  overflow: hidden;
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-info-meta {
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-order-card .el-button {
  flex: 0 0 auto;
}

.preview-action {
  flex: 0 0 auto;
}

.preview-order-pagination {
  margin-top: 14px;
}

.save-bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  padding: 4px 2px;
}

.dirty-tip {
  margin-right: auto;
  color: var(--el-color-warning);
  font-size: 13px;
}

.dirty-tip::before {
  margin-right: 6px;
  content: '●';
}

.saved-tip {
  margin-right: auto;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}

@media (max-width: 960px) {
  .config-layout {
    grid-template-columns: 1fr;
  }

  .binding-panel {
    position: static;
  }

  .binding-list {
    max-height: 240px;
  }
}

@media (max-width: 640px) {
  .base-grid {
    grid-template-columns: 1fr;
  }

  .preview-input {
    max-width: none;
    width: 100%;
  }
}
</style>

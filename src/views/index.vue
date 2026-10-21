<template>
  <div v-loading="loading" class="app-container dashboard">
    <section class="hero">
      <div class="hero-copy">
        <span class="hero-eyebrow">{{ today }}</span>
        <h2>{{ greeting }}，{{ displayName }}</h2>
        <p>{{ heroHint }}</p>
      </div>
      <div class="hero-actions">
        <el-button v-if="canAdd" type="primary" @click="router.push('/purchase/order-document/create')">
          <el-icon><Plus /></el-icon>
          <span>新建采购订单</span>
        </el-button>
        <el-button v-if="canOrder" @click="goOrders">
          <el-icon><Document /></el-icon>
          <span>查看全部订单</span>
        </el-button>
      </div>
    </section>

    <section v-if="canOrder" class="stat-grid">
      <button v-for="stat in stats" :key="stat.key" type="button" class="stat-card" @click="goOrders">
        <span class="stat-icon" :class="`is-${stat.tone}`">
          <el-icon :size="20"><component :is="stat.icon" /></el-icon>
        </span>
        <span class="stat-copy">
          <span class="stat-label">{{ stat.label }}</span>
          <strong class="stat-value">{{ stat.value }}</strong>
        </span>
      </button>
    </section>

    <div class="main-grid" :class="{ 'is-single': !canOrder }">
      <el-card v-if="canOrder" shadow="never" class="panel todo-panel">
        <template #header>
          <div class="panel-head">
            <div class="panel-title">
              <strong>待审核订单</strong>
              <span>提交后等待确认的采购订单</span>
            </div>
            <el-button link type="primary" @click="goOrders">全部订单</el-button>
          </div>
        </template>
        <div v-if="todos.length" class="todo-list">
          <button
            v-for="order in todos"
            :key="order.orderId"
            type="button"
            class="todo-item"
            @click="goOrderDetail(order)"
          >
            <span class="todo-main">
              <strong>{{ order.orderNo }}</strong>
              <span>{{ order.supplierName }}</span>
            </span>
            <span class="todo-side">
              <strong class="todo-amount">{{ formatAmount(order.grossAmount) }}</strong>
              <span>{{ order.orderDate }}</span>
            </span>
          </button>
        </div>
        <el-empty v-else description="当前没有待审核的订单" :image-size="70" />
      </el-card>

      <div class="side-col">
        <el-card shadow="never" class="panel">
          <template #header>
            <div class="panel-head">
              <div class="panel-title">
                <strong>快捷操作</strong>
                <span>常用功能一键直达</span>
              </div>
            </div>
          </template>
          <div class="quick-grid">
            <button
              v-for="action in quickActions"
              :key="action.label"
              type="button"
              class="quick-item"
              @click="openAction(action)"
            >
              <span class="quick-icon">
                <el-icon :size="18"><component :is="action.icon" /></el-icon>
              </span>
              <span class="quick-copy">
                <strong>{{ action.label }}</strong>
                <span>{{ action.desc }}</span>
              </span>
              <el-icon class="quick-arrow"><ArrowRight /></el-icon>
            </button>
          </div>
        </el-card>

        <el-card shadow="never" class="panel">
          <template #header>
            <div class="panel-head">
              <div class="panel-title">
                <strong>电子签署</strong>
                <span>e签宝集成状态</span>
              </div>
            </div>
          </template>
          <div v-if="signing" class="signing-status">
            <div class="status-row">
              <span class="status-dot" :class="signing.enabled ? 'is-ok' : 'is-off'" />
              <span>{{ signing.enabled ? '签署功能已启用' : '签署功能未启用' }}</span>
            </div>
            <div class="status-row">
              <span class="status-dot" :class="signing.configured ? 'is-ok' : 'is-warn'" />
              <span>{{ signing.configured ? '平台凭证已配置' : '平台凭证未配置' }}</span>
            </div>
            <p v-if="!signing.enabled || !signing.configured" class="status-hint">
              需要先在服务端完成 e签宝配置，之后才能发起电子签署。
            </p>
          </div>
          <el-skeleton v-else :rows="2" animated />
        </el-card>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowRight,
  CircleCheckFilled,
  Clock,
  Document,
  FolderChecked,
  Plus,
  Tickets,
  User
} from '@element-plus/icons-vue'
import useUserStore from '@/store/modules/user'
import auth from '@/plugins/auth'
import { listOrders } from '@/api/purchase/order'
import { signingSettings } from '@/api/signing'
import type { Order, OrderStatus } from '@/types/api/purchase/order'
import type { SigningSettings } from '@/types/api/signing'

const router = useRouter()
const userStore = useUserStore()
const canOrder = computed(() => auth.hasPermi('purchase:order:query'))
const canAdd = computed(() => auth.hasPermi('purchase:order:add'))

const loading = ref(false)
const todos = ref<Order[]>([])
const signing = ref<SigningSettings | null>(null)
const stats = ref<{ key: OrderStatus; label: string; tone: string; icon: typeof Document; value: number }[]>([
  { key: 'DRAFT', label: '草稿订单', tone: 'info', icon: Document, value: 0 },
  { key: 'SUBMITTED', label: '待审核', tone: 'warning', icon: Clock, value: 0 },
  { key: 'APPROVED', label: '已审核', tone: 'success', icon: CircleCheckFilled, value: 0 },
  { key: 'CLOSED', label: '已关闭', tone: 'closed', icon: FolderChecked, value: 0 }
])

const displayName = computed(() => userStore.nickName || userStore.name || '同事')
const today = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())
const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 12) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
})
const heroHint = computed(() => {
  const pending = stats.value.find((stat) => stat.key === 'SUBMITTED')?.value ?? 0
  if (!canOrder.value) return '欢迎回来，祝你工作顺利。'
  return pending > 0 ? `今天有 ${pending} 张订单等待审核，优先处理一下吧。` : '当前没有待审核的订单，一切尽在掌握。'
})
const quickActions = computed(() => {
  const actions = [
    {
      label: '新建采购订单',
      desc: '录入供应商与物料明细',
      icon: Plus,
      to: '/purchase/order-document/create',
      perm: 'purchase:order:add'
    },
    {
      label: '采购订单',
      desc: '查询与处理全部订单',
      icon: Document,
      to: '/purchase/order',
      perm: 'purchase:order:query'
    },
    {
      label: '合同模板配置',
      desc: '维护 e签宝模板与字段映射',
      icon: Tickets,
      to: '/signing/template',
      perm: 'signing:template:edit'
    },
    { label: '个人中心', desc: '修改密码与个人资料', icon: User, route: 'Profile', perm: '' }
  ]
  return actions.filter((action) => !action.perm || auth.hasPermi(action.perm))
})

function formatAmount(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return '—'
  const amount = Number(value)
  if (Number.isNaN(amount)) return '—'
  return `¥ ${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function goOrders() {
  router.push('/purchase/order')
}
function goOrderDetail(order: Order) {
  router.push(`/purchase/order-document/${order.orderId}/detail`)
}
function openAction(action: (typeof quickActions.value)[number]) {
  if ('route' in action && action.route) {
    router.push({ name: action.route })
  } else if ('to' in action && action.to) {
    router.push(action.to)
  }
}
async function loadDashboard() {
  if (!canOrder.value) return
  loading.value = true
  try {
    const [draft, submitted, approved, closed, todo] = await Promise.all([
      listOrders({ status: 'DRAFT', pageNum: 1, pageSize: 1 }),
      listOrders({ status: 'SUBMITTED', pageNum: 1, pageSize: 1 }),
      listOrders({ status: 'APPROVED', pageNum: 1, pageSize: 1 }),
      listOrders({ status: 'CLOSED', pageNum: 1, pageSize: 1 }),
      listOrders({ status: 'SUBMITTED', pageNum: 1, pageSize: 5, sortField: 'orderDate', sortDirection: 'desc' })
    ])
    stats.value[0].value = draft.data.total
    stats.value[1].value = submitted.data.total
    stats.value[2].value = approved.data.total
    stats.value[3].value = closed.data.total
    todos.value = todo.data.rows
  } catch {
    // 统计加载失败时保持默认零值，不阻塞页面。
  } finally {
    loading.value = false
  }
}
onMounted(async () => {
  void loadDashboard()
  try {
    signing.value = (await signingSettings()).data
  } catch {
    signing.value = null
  }
})
</script>
<style scoped lang="scss">
.hero {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
  padding: 22px 24px;
  border-radius: 12px;
  background: linear-gradient(120deg, var(--el-color-primary), var(--el-color-primary-light-3));
  color: var(--el-color-white);
}

.hero-eyebrow {
  font-size: 12px;
  letter-spacing: 0.08em;
  opacity: 0.85;
}

.hero-copy h2 {
  margin: 6px 0 4px;
  font-size: 22px;
  font-weight: 600;
}

.hero-copy p {
  margin: 0;
  font-size: 13px;
  opacity: 0.9;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.hero-actions .el-button--primary {
  --el-button-bg-color: var(--el-color-white);
  --el-button-border-color: var(--el-color-white);
  --el-button-text-color: var(--el-color-primary);
  --el-button-hover-bg-color: var(--el-color-primary-light-8);
  --el-button-hover-border-color: var(--el-color-primary-light-8);
  --el-button-hover-text-color: var(--el-color-primary);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-bg-color);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.stat-card:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: var(--el-box-shadow-light);
  transform: translateY(-2px);
}

.stat-icon {
  display: inline-flex;
  flex: 0 0 42px;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
}

.stat-icon.is-info {
  background: var(--el-color-info-light-9);
  color: var(--el-color-info);
}

.stat-icon.is-warning {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
}

.stat-icon.is-success {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.stat-icon.is-closed {
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
}

.stat-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.stat-label {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.stat-value {
  color: var(--el-text-color-primary);
  font-size: 24px;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.main-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 16px;
  align-items: start;
}

.main-grid.is-single {
  grid-template-columns: minmax(0, 1fr);
}

.side-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.panel {
  border-color: var(--el-border-color-lighter);
}

.panel :deep(.el-card__header) {
  padding: 14px 18px;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.panel-title {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.panel-title strong {
  color: var(--el-text-color-primary);
  font-size: 14px;
}

.panel-title span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.todo-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.todo-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.todo-item:hover {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-fill-color-lighter);
}

.todo-main,
.todo-side {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.todo-main {
  flex: 1;
}

.todo-main strong {
  overflow: hidden;
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-main span,
.todo-side span {
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-side {
  flex: 0 0 auto;
  align-items: flex-end;
}

.todo-amount {
  color: var(--el-color-primary);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.quick-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.quick-item {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.quick-item:hover {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
}

.quick-icon {
  display: inline-flex;
  flex: 0 0 34px;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.quick-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.quick-copy strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 500;
}

.quick-copy span {
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-arrow {
  flex: 0 0 auto;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}

.signing-status {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-regular);
  font-size: 13px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.is-ok {
  background: var(--el-color-success);
}

.status-dot.is-warn {
  background: var(--el-color-warning);
}

.status-dot.is-off {
  background: var(--el-text-color-placeholder);
}

.status-hint {
  margin: 2px 0 0;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
  font-size: 12px;
  line-height: 1.6;
}

@media (max-width: 1100px) {
  .stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .main-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .stat-grid {
    grid-template-columns: 1fr;
  }
}
</style>

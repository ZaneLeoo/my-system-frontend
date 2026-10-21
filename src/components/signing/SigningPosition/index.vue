<template>
  <div class="position-config">
    <div class="position-toolbar">
      <div class="toolbar-copy">
        <strong>为最终 PDF 配置双方签章位置</strong>
        <span>在 e签宝官方页面拖放签章并保存，返回后此处会同步显示落章坐标。</span>
      </div>
      <el-button type="primary" :disabled="disabled" @click="emit('open')">
        <el-icon><Position /></el-icon>
        <span>打开官方拖章页面</span>
      </el-button>
    </div>

    <div v-if="rows.length" class="position-stats">
      <div class="stat">
        <span>签章位置</span>
        <strong>{{ rows.length }} 处</strong>
      </div>
      <div class="stat">
        <span>我方</span>
        <strong>{{ countByRole('OUR') }} 处</strong>
      </div>
      <div class="stat">
        <span>对方</span>
        <strong>{{ countByRole('COUNTERPARTY') }} 处</strong>
      </div>
    </div>

    <div v-if="rows.length" class="position-table-wrap">
      <vxe-table :data="rows" border show-overflow max-height="300">
        <vxe-column field="roleLabel" title="签署方" width="120">
          <template #default="{ row }">
            <span class="role-badge" :class="row.role === 'OUR' ? 'is-our' : 'is-counterparty'">
              {{ row.roleLabel }}
            </span>
          </template>
        </vxe-column>
        <vxe-column field="page" title="页码" width="100" />
        <vxe-column field="x" title="X 坐标" min-width="120" />
        <vxe-column field="y" title="Y 坐标" min-width="120" />
      </vxe-table>
    </div>
    <div v-else class="position-empty">
      <span class="empty-icon">
        <el-icon :size="20"><LocationInformation /></el-icon>
      </span>
      <strong>尚未配置签章位置</strong>
      <span>打开官方拖章页面，为双方放置签章后会自动同步到此处。</span>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { LocationInformation, Position } from '@element-plus/icons-vue'
import type { SigningParty } from '@/types/api/signing'
import { useVxe } from '@/plugins/vxe'

useVxe()
const props = defineProps<{ parties: SigningParty[]; disabled: boolean }>()
const emit = defineEmits<{ open: [] }>()
const rows = computed(() =>
  props.parties.flatMap((party) =>
    party.positions.map((position) => ({
      ...position,
      role: party.role,
      roleLabel: party.role === 'OUR' ? '我方' : '对方'
    }))
  )
)

function countByRole(role: SigningParty['role']) {
  return rows.value.filter((row) => row.role === role).length
}
</script>
<style scoped lang="scss">
.position-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 16px 0;
}

.toolbar-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.toolbar-copy strong {
  color: var(--el-text-color-primary);
  font-size: 14px;
}

.toolbar-copy span {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.55;
}

.position-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-bottom: 12px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 10px 14px;
}

.stat + .stat {
  border-left: 1px solid var(--el-border-color-lighter);
}

.stat span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.stat strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 500;
}

.position-table-wrap {
  overflow: hidden;
  border-radius: 8px;
}

.role-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  line-height: 18px;
}

.role-badge.is-our {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.role-badge.is-counterparty {
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
}

.position-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 28px 16px;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  text-align: center;
}

.position-empty strong {
  color: var(--el-text-color-primary);
  font-size: 14px;
}

.position-empty > span:not(.empty-icon) {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.empty-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
}

@media (max-width: 640px) {
  .position-stats {
    grid-template-columns: 1fr;
  }

  .stat + .stat {
    border-top: 1px solid var(--el-border-color-lighter);
    border-left: 0;
  }
}
</style>

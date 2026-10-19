<template>
  <div class="condition-group">
    <div class="group-tools">
      <el-select v-model="node.logic" style="width: 150px">
        <el-option label="全部满足（并且）" value="AND" />
        <el-option label="任一满足（或者）" value="OR" />
      </el-select>
      <el-button @click="addCondition">添加条件</el-button>
      <el-button v-if="depth < 3" @click="addGroup">添加分组</el-button>
      <el-dropdown
        v-if="scope === 'main' && depth < 3 && Object.keys(metadata.relations).length"
        @command="addRelation"
      >
        <el-button>添加明细条件</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-for="(label, key) in metadata.relations" :key="key" :command="key">
              {{ label }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
    <el-empty v-if="!node.children?.length" description="尚未添加条件" :image-size="45" />
    <div v-for="(child, index) in node.children" :key="childIds[index]" class="condition-row">
      <template v-if="child.type === 'condition'">
        <el-select v-model="child.field" filterable placeholder="选择字段" @change="() => changeField(child)">
          <el-option v-for="field in scopedFields" :key="field.fieldKey" :label="field.label" :value="field.fieldKey" />
        </el-select>
        <el-select v-model="child.op" placeholder="查询方式" @change="() => changeOperator(child)">
          <el-option
            v-for="op in fieldOf(child)?.operators || []"
            :key="op"
            :label="operatorLabels[op] || op"
            :value="op"
          />
        </el-select>
        <ConditionValueInput
          v-if="fieldOf(child) && child.op"
          v-model="child.value"
          v-model:value2="child.value2"
          :query-key="metadata.queryKey"
          :field="fieldOf(child)!"
          :op="child.op"
        />
      </template>
      <div v-else class="nested">
        <div v-if="child.type === 'relation'" class="relation-title">
          <strong>{{ metadata.relations[child.relation || ''] }}</strong>
          <el-select v-model="child.mode" style="width: 230px">
            <el-option label="存在一行满足以下条件" value="EXISTS" />
            <el-option label="不存在满足以下条件的行" value="NOT_EXISTS" />
          </el-select>
        </div>
        <ConditionGroup
          :node="child"
          :metadata="metadata"
          :scope="child.type === 'relation' ? child.relation || 'main' : scope"
          :depth="depth + 1"
        />
      </div>
      <el-button text type="danger" @click="remove(index)">移除</el-button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ConditionValueInput from './ConditionValueInput.vue'
import { operatorLabels } from './useQueryDefinition'
import type { QueryMetadata, QueryNode } from '@/types/api/system/query'
const props = withDefaults(
  defineProps<{ node: QueryNode; metadata: QueryMetadata; scope?: string; depth?: number }>(),
  { scope: 'main', depth: 1 }
)
const scopedFields = computed(() => props.metadata.fields.filter((f) => f.sourceKey === props.scope))
let nextId = 0
const childIds = ref<number[]>([])
watch(
  () => props.node.children,
  (children) => {
    childIds.value = (children || []).map(() => ++nextId)
  },
  { immediate: true }
)
function fieldOf(node: QueryNode) {
  return scopedFields.value.find((f) => f.fieldKey === node.field)
}
function push(node: QueryNode) {
  props.node.children ||= []
  props.node.children.push(node)
  childIds.value.push(++nextId)
}
function addCondition() {
  const first = scopedFields.value[0]
  push({ type: 'condition', field: first?.fieldKey, op: first?.defaultOperator })
}
function addGroup() {
  push({ type: 'group', logic: 'AND', children: [] })
}
function addRelation(key: string) {
  push({ type: 'relation', relation: key, mode: 'EXISTS', logic: 'AND', children: [] })
}
function remove(index: number) {
  props.node.children?.splice(index, 1)
  childIds.value.splice(index, 1)
}
function changeField(node: QueryNode) {
  node.op = fieldOf(node)?.defaultOperator
  delete node.value
  delete node.value2
}
function changeOperator(node: QueryNode) {
  delete node.value
  delete node.value2
}
</script>
<style scoped>
.condition-group {
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  padding: 12px;
  min-width: 0;
}
.group-tools,
.relation-title {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.condition-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin-top: 10px;
}
.condition-row > .el-select {
  width: 150px;
  flex-shrink: 0;
}
.nested {
  flex: 1;
  min-width: 0;
}
.relation-title strong {
  margin-right: 8px;
}
</style>

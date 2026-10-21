<template>
  <div class="seal-preview" :class="{ compact }">
    <button v-if="url" type="button" class="preview-image" aria-label="放大印章预览" @click.stop="viewer = true">
      <img :src="url" alt="印章水印预览" />
    </button>
    <div v-else-if="loading" class="preview-placeholder">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载预览</span>
    </div>
    <el-tooltip v-else-if="error" :content="error" placement="top">
      <button type="button" class="preview-placeholder retry" @click.stop="load">
        <el-icon><Refresh /></el-icon>
        <span>预览失败，重试</span>
      </button>
    </el-tooltip>
    <div v-else class="preview-placeholder">
      <el-icon><Stamp /></el-icon>
      <span>暂无预览</span>
    </div>
    <el-image-viewer v-if="viewer && url" :url-list="[url]" teleported @close="viewer = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { Loading, Refresh, Stamp } from '@element-plus/icons-vue'
import { signingSealPreview } from '@/api/signing'
import { getSigningErrorMessage } from '@/utils/signingError'

const props = withDefaults(
  defineProps<{
    taskId: string
    sealId: string
    available?: boolean
    compact?: boolean
  }>(),
  { available: true, compact: false }
)
const url = ref('')
const loading = ref(false)
const error = ref('')
const viewer = ref(false)
let sequence = 0

function release() {
  if (url.value) URL.revokeObjectURL(url.value)
  url.value = ''
  viewer.value = false
}
async function load() {
  const current = ++sequence
  release()
  error.value = ''
  loading.value = false
  if (!props.available || !props.sealId || !props.taskId) return
  loading.value = true
  try {
    const image = await signingSealPreview(props.taskId, props.sealId)
    if (current !== sequence) return
    url.value = URL.createObjectURL(image)
  } catch (cause) {
    if (current === sequence) error.value = getSigningErrorMessage(cause) || '印章预览加载失败'
  } finally {
    if (current === sequence) loading.value = false
  }
}
watch(
  () => [props.taskId, props.sealId, props.available],
  () => {
    void load()
  },
  { immediate: true }
)
onBeforeUnmount(() => {
  sequence++
  release()
})
</script>

<style scoped lang="scss">
.seal-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 148px;
  width: 100%;
}
.seal-preview.compact {
  width: 116px;
  height: 116px;
  flex-shrink: 0;
}
.preview-image {
  width: 100%;
  height: 100%;
  padding: 8px;
  border: 0;
  background: transparent;
  cursor: zoom-in;
}
.preview-image img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.preview-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  height: 100%;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.preview-placeholder .el-icon {
  font-size: 26px;
}
.retry {
  border: 0;
  background: transparent;
  cursor: pointer;
}
.retry:hover {
  color: var(--el-color-primary);
}
</style>

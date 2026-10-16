import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, type ComputedRef } from 'vue'

/** 业务页面可提供已有授权下的选项；独立使用时加载只读参照接口。 */
export function useReferenceOptions<T>(provided: ComputedRef<T[] | undefined>, loader: () => Promise<{ data: T[] }>) {
  const loaded = shallowRef<T[]>([])
  const loading = ref(false)
  const failed = ref(false)
  const ready = ref(false)
  let sequence = 0
  const options = computed(() => provided.value ?? loaded.value)
  async function reload() {
    if (provided.value !== undefined) return
    const current = ++sequence
    loading.value = true
    failed.value = false
    try {
      const result = await loader()
      if (current !== sequence) return
      loaded.value = result.data
      ready.value = true
    } catch {
      if (current === sequence) failed.value = true
    } finally {
      if (current === sequence) loading.value = false
    }
  }
  function ensureLoaded(open: boolean) {
    if (open && !loading.value && (!ready.value || failed.value)) void reload()
  }
  watch(provided, (value) => {
    sequence++
    loading.value = false
    failed.value = false
    if (value === undefined) void reload()
  })
  onMounted(() => {
    if (provided.value === undefined) void reload()
  })
  onBeforeUnmount(() => sequence++)
  return { options, loading, failed, reload, ensureLoaded }
}

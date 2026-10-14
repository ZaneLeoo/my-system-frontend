import { getCurrentInstance, watch, type App } from 'vue'
import VxePCUI, { VxeUI } from 'vxe-pc-ui'
import VxeUITable from 'vxe-table'
import VxeUIPluginRenderElement from '@vxe-ui/plugin-render-element'
import zhCN from 'vxe-pc-ui/lib/language/zh-CN'
import 'vxe-pc-ui/lib/style.css'
import 'vxe-table/lib/style.css'
import '@vxe-ui/plugin-render-element/dist/style.css'
import useSettingsStore from '@/store/modules/settings'

const installedApps = new WeakSet<App>()

/** 在使用 VXE 的页面中调用，保持依赖跟随页面懒加载。 */
export function useVxe() {
  const instance = getCurrentInstance()
  if (!instance) throw new Error('useVxe 必须在组件 setup 中调用')
  const app = instance.appContext.app
  if (!installedApps.has(app)) {
    VxeUI.setI18n('zh-CN', zhCN)
    VxeUI.setLanguage('zh-CN')
    VxeUI.use(VxeUIPluginRenderElement)
    app.use(VxePCUI)
    app.use(VxeUITable)
    installedApps.add(app)
  }
  const settings = useSettingsStore()
  watch(
    () => settings.isDark,
    (dark) => VxeUI.setTheme(dark ? 'dark' : 'light'),
    { immediate: true }
  )
}

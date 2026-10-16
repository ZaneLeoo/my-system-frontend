# MySystem Frontend

基于官方 [RuoYi-Vue3 的 typescript 分支](https://github.com/yangzongzhuan/RuoYi-Vue3/tree/typescript)，
技术栈为 Vue 3、TypeScript、Vite、Element Plus、Pinia。
保留上游 Git 历史和 MIT 许可证，上游说明见 [README.upstream.md](README.upstream.md)。

## 本地开发

需要 Node.js 22.12+、npm 10+。推荐使用 Node.js 22 LTS。

```sh
npm ci
npm run dev
```

访问 http://localhost:5173。开发代理默认转发到 http://127.0.0.1:8080。
可通过 `.env.development.local` 设置 `VITE_APP_BACKEND_URL`，覆盖后端地址。
后端项目位于同级 `../Backend`，运行方式见后端 README。
若依初始化账号：`admin` / `admin123`。

## 工具链

- ESLint：JavaScript / TypeScript / Vue 语法及代码检查。
- Prettier：2 空格、单引号、无分号、LF 换行，脚本左花括号同行。
- EditorConfig：统一编辑器缩进和文件编码。
- VS Code：已提供扩展推荐、保存格式化及 ESLint 修复配置。
- `package-lock.json`：锁定依赖，使用 `npm ci` 安装。

```sh
npm run format
npm run format:check
npm run lint
npm run lint:fix
npm run type-check
npm run build:prod
```

上游页面采用渐进式类型声明，保留 `any` 和带注释的类型抑制；类型检查用于识别后续收紧类型的工作。
当前严格类型检查仍存在上游存量错误，主要涉及组件实例空值、表单类型及动态属性。
初始化时修正了上游遮蔽 Vue 导出的模块声明，使 IDE 能正常识别 Vue 类型；这些严格检查错误没有通过关闭 strict 或批量抑制来隐藏。
`type-check` 目前用于诊断，不作为 CI 门禁；格式检查、ESLint 和生产构建作为 CI 门禁。
生成的 `auto-imports.d.ts` 不参与格式检查。

依赖安装时已更新 Vue、Axios、js-cookie 和 Vite 的兼容补丁/次版本。
`npm audit` 仍报告上游 ECharts 和 SVG/自动导入构建工具链的依赖告警；未使用 `--force` 跨主版本替换上游依赖，后续升级需单独验证。

## 料品档案

菜单“基础资料 → 料品档案”使用 VXE 接口分页列表、列筛选、全量结果排序和六点手柄列拖拽，编码与名称固定左侧、操作固定右侧。编辑／详情采用宽抽屉，分为基本信息、单位设置、采购设置，关闭未保存修改时确认。库存单位首次选择后预填采购及销售单位，后两者可独立修改或清空；税率留空表示未设置。服务端已有数据库需执行 `scripts/apply-item.ps1`，新增菜单后重新登录。当前没有跨单位换算功能。

## Git

- `origin`：`git@github.com:ZaneLeoo/my-system-frontend.git`
- `upstream`：官方 RuoYi-Vue3，来源分支 `typescript`。
- 开发分支：`main`。
- 提交信息统一中文 Conventional Commits，例如 `feat(登录): 优化登录表单交互`。

首次克隆后执行 `git config core.hooksPath .githooks`，启用提交信息校验。
允许 `feat`、`fix`、`docs`、`style`、`refactor`、`perf`、`test`、`build`、`ci`、`chore`、`revert` 前缀，可按需添加提交体。
当前本机已为此仓库配置 GitHub SSH 443 端口。

# 开发约定

- 提交信息使用中文 Conventional Commits：`feat(模块): 中文描述`，必要时添加提交体。
- 使用 npm 和 `package-lock.json`，安装依赖执行 `npm ci`。
- 使用 ESLint + Prettier，2 空格、单引号、无分号，脚本左花括号同行。
- 修改后执行 `npm run format`，提交前执行 `npm run format:check`、`npm run lint`、`npm run build:prod`。
- 上游严格类型检查仍有存量问题，见 README；不要通过关闭 strict、批量加入类型抑制或伪造 Vue 声明来隐藏错误。
- 新增代码应提供明确类型，避免引入新的类型检查错误。
- 业务单据列表的操作列聚焦当前单据的直接操作，如详情、编辑、删除、提交、审核；关联单据查询和生成下游单据等功能放在详情页，按状态与权限展示。
- 保留上游 MIT 许可证和作者说明。

# 贡献指南

感谢你愿意为 NavBlog 做贡献！

## 开发环境

- Node.js ≥ 20（推荐 22）
- pnpm 10

```bash
pnpm install
pnpm start          # http://localhost:7002
```

修改 `data/` 或 `blog.config.yaml` 后需要重新运行 `pnpm start`（它会先执行 `scripts/prepare.ts` 生成 `src/generated/*.json`）。

## 项目结构

| 路径 | 说明 |
| --- | --- |
| `src/app/pages` | 前台页面（首页、文章、归档、分类标签、搜索、关于、404） |
| `src/app/components` | 前台组件（顶栏、侧边栏、目录、页脚、悬浮按钮、Giscus……） |
| `src/app/admin` | 后台（登录、文章列表、编辑器、站点设置、关于页） |
| `src/app/services/blog.service.ts` | 前台数据（设置、文章索引、分类标签） |
| `src/app/services/git.service.ts` | GitHub / Gitee / GitLab API 封装 |
| `src/shared` | 前后台与构建脚本共用：类型、front matter、Markdown 渲染 |
| `src/styles.css` | Tailwind 4 + Fuwari 主题样式（CSS 变量 `--hue` 控制主题色） |
| `scripts/prepare.ts` | 构建前：生成文章索引、`src/generated/*.json`、`src/index.html` |
| `scripts/postbuild.ts` | 构建后：每篇文章的静态 HTML、sitemap、RSS、404 等 |

## 约定

- Angular standalone 组件 + signals，**zoneless**（不要引入 zone.js）；异步更新非 signal 状态时注意手动 `markForCheck`。
- 样式优先使用 Tailwind 工具类；可复用的主题样式写在 `src/styles.css` 的 `@layer components` 中，类名以 `fuwari-` 开头。
- 颜色使用 CSS 变量（`var(--fuwari-primary)` 等），保证深色模式与调色盘正常工作。
- 前台与构建脚本共用的逻辑放到 `src/shared`，不要依赖浏览器或 Node 专有 API。
- 提交 PR 前运行 `pnpm run build` 确认构建通过，并请**不要提交**你自己的文章与设置。

## 提交信息

推荐使用 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)：`feat: ...`、`fix: ...`、`docs: ...`。

## 许可

提交的代码将以 [GPL-3.0](./LICENSE) 协议发布。

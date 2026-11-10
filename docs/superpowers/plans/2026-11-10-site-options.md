# 静态站点配置 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task.

**Goal:** 落地已获用户授权的深浅色、备案、RSS、侧栏反转和 PWA 参数。
**Architecture:** 复用 BlogSettings、theme-settings 规范化、ThemeService、后台设置和 prepare/postbuild。现有项目数据为基准，不创建另一份预览、不更改已有文章。
**Tech Stack:** Angular 21、TypeScript、Tailwind 4、Node、原生浏览器 API；无新依赖。
**Spec:** 本会话最近列出的五项配置及用户“那你开干吧”。已授权连续实施。

## Global Constraints

- 纯静态 Angular/TypeScript，不引入 Vue/React/PHP。
- 默认 system 深浅色、RSS 开启且全文、侧栏左侧；手动偏好优先。
- 自动深色默认 22–7 时，支持跨午夜；同起止表示全天浅色。
- PWA 默认为已有 manifest 行为；名称为空取站点标题，安装 PNG 仅使用 public 内文件并校验 192/512 尺寸；不加离线缓存。
- 加密正文始终不得进入 RSS，RSS 关闭时删除文件和受控入口。
- 保留前序未提交修改；本轮不提交、推送或部署。

## Review Focus

- 自动时段边界、访客手动偏好、存储受限、唤醒后重新判断。
- RSS 关闭再启用和 fullContent=false，不能泄漏加密正文。
- 子路径部署的 manifest、图标、scope 和 start_url。
- 备案链接、颜色和图标路径校验；无字段旧设置正常工作。
- 反转不改变手机正文优先或全宽文章行为。

### Task 1: 设置与主题

Files: src/shared/types.ts、theme-settings.ts、src/app/services/theme.service.ts、src/index.template.html、scripts/prepare.ts、scripts/test-site-options.ts。
Interfaces: normalizeThemeSettings 保留明确 false；resolveDark(settings, stored, systemDark, now) 返回 boolean，可用于浏览器初始脚本和运行时。
- [x] 写默认值、false、时段、偏好测试；运行确认因缺少能力失败。
- [x] 实现规范化和主题启动／定时更新／回到默认按钮；复用现有色相逻辑。
- [x] 测试变绿并构建。

### Task 2: 备案、RSS、PWA 和布局

Files: scripts/site-output.ts、postbuild.ts、prepare.ts、src/index.template.html、src/app/components/footer.component.ts、sidebar.component.ts、src/app/app.component.ts、src/styles.css、scripts/test-site-output.ts。
Interfaces: createManifest(settings,baseHref,publicDir) 生成经校验的 manifest；rssContent(meta,body,full) 输出公开描述。
- [x] 测试 manifest 子路径、图标尺寸与路径、RSS 摘要和密文分支；确认失败。
- [x] 接入构建输出、manifest/订阅入口、备案页脚、反转类名。
- [x] 测试变绿；关闭输出后确认文件和入口不存在；恢复正式构建。

### Task 3: 后台与验收

Files: src/app/admin/settings.page.ts、docs/config.md、docs/blog-config-migration-assessment.md。
- [x] 添加五项设置的编辑入口与说明，保存时沿用规范化校验。
- [x] 运行全套项目脚本测试和生产构建，手机／桌面浏览器验收。
- [x] 进行独立代码审查，修复重要发现并验证；记录未验证范围。

执行记录放 tmp/site-options-progress.md，避免混入前序用户改动的 Git 提交。

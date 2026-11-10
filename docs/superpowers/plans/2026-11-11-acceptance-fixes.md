# 验收缺陷修复 Implementation Plan

> Use superpowers:executing-plans and test-driven-development. 用户已授权修复验收报告，连续执行，保留当前数据与前序未提交修改。

**Goal:** 修复验收报告 1–11，补齐权限测试与 Toast 无障碍反馈（12–13）。
**Architecture:** 复用现有 Git 条件提交、Angular 路由、Web Crypto、prepare/postbuild 和原生 Node 预览服务；不增依赖。
**Spec:** tmp/acceptance/report.md，用户“那你开干吧”。

## Tasks

1. 构建/发布：先扩展真实构建回归（Cloudflare 受限回退、嵌套文件不发布、草稿源与摘要不发布、美元符号），再修 prepare/postbuild 和资产来源。只发布经过验证的顶层非草稿 Markdown，保留仓库完整后台索引。
2. 版本冲突：先复现文章/设置/关于页旧窗口及索引竞态；load 捕获原内容，save 核验最新版本。GitHub 多文件在固定 head 校验后原子提交，GitLab 按 last_commit_id 条件提交，Gitee 全部预检且逐文件按 SHA 写入。失败保留输入，不更新成功状态。
3. 会话：旧 fetchUser 请求不得注销新会话；覆盖 GitHub/Gitee push、GitLab 项目/组权限与 archived 拒绝。
4. 前台：手机菜单统一过滤；动态日期用 RouterLink fragment；只识别首段 admin；文章不存在时也清空共享目录/正文并取消旧请求；错误 Toast alert、普通反馈 status。
5. 预览：非法 URI 返回 400，限制到真实资源根目录，流读取错误不结束服务；测试用临时独立服务器，不攻击当前 7002。
6. 重新跑全套测试/真实构建、手机桌面交互与独立审查。更新 README、配置/后台说明及修复报告。数据哈希与验收前一致。

## Scope / limits

- 不推送、部署或使用真实 Token 写仓库。
- Gitee 没有本项目使用的多文件原子 API；预检阻止已知冲突，若逐文件提交途中失败仍可能部分提交，需提示并重新读取，不能宣称一次事务。
- 不改变已接受的 8 位后台密码、PWA 无离线缓存、动态图文范围或 sitemap 日期 shortcut。
- 执行证据记录 tmp/acceptance-fixes/，本轮不提交前序用户工作。

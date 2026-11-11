# Fork 仓库自动识别

> 使用 superpowers:executing-plans 在当前已授权会话中连续实施，不提交或推送。用户要求继续完成并处理 Fork 问题。

**Goal:** 默认 Fork 不再沿用作者仓库请求；显式配置仍生效。
**Architecture:** 构建脚本解析托管环境或 Git origin，生成完整仓库 URL；Angular 读取生成配置。
**Tech Stack:** Angular/TypeScript、Node.js、现有 js-yaml，无新增依赖。

用户要求继续完成 Git API 修复，并解决 Fork 沿用原作者仓库导致的 403/404。沿用 Angular/TypeScript、纯静态构建，无新增依赖，无提交、推送或真实凭证写入。

实现选择：默认 `gitRepoUrl: auto`，从托管环境或当前 Git origin 解析仓库；默认图片仓库跟随已解析的源码仓库并使用 images 分支。显式 URL 始终优先。无法解析 auto 时停止构建并提示 `pnpm run setup`，不回退到原作者地址。

1. 补失败回归：GitHub Actions、Netlify、Vercel、Git origin、SSH/HTTPS、敏感凭据移除、显式地址、缺少来源。
2. 在构建配置读取中接入识别；初始化向导保留 auto，并允许无 Git 环境输入完整 URL。
3. 默认 YAML 改为 auto；当前没有 origin 的本地仓库关联到用户确认的 Navblog。
4. 用真实配置准备和模拟 Fork 构建检查 generated 配置、请求路径、子路径和静态后台回退；不使用真实 Token 写仓库。
5. 更新 README/配置/部署说明，运行相关回归、Angular 构建与独立复核。保留全部文章、设置和动态数据。

识别来源顺序：GitHub Actions 仓库信息、Netlify REPOSITORY_URL、Vercel 仓库信息、GitLab CI URL、当前 Git origin。自动解析只接受现有支持的公共 Git 平台；自托管或特殊仓库使用完整 URL。分支继续遵循 YAML，不自动切换到临时 PR 分支。

完成：默认 auto、来源解析、敏感信息过滤、初始化 auto 保留/EOF/URL校验、GitLab 参数保留、模拟 Fork 完整构建、README 和配置/部署说明均已更新。累计 110 项回归及 5 组构建验证通过，最终 build/TypeScript/diff 检查通过，独立复核的问题已修复。当前 origin 已关联用户确认的 Navblog；未改动文章、设置或动态内容，未使用真实凭据写仓库。

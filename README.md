<div align="center">

# 🌸 NavBlog

**纯静态部署，却能在线进入后台写作的个人博客系统**

Fuwari 风格主题 · Markdown 文章 · Git 仓库即数据库 · 零服务器 · 零数据库

[功能](#-功能) · [快速开始](#-快速开始) · [部署教程](#-部署教程) · [后台使用](#-后台使用) · [配置](#-配置说明) · [常见问题](#-常见问题)

</div>

---

## ✨ 这是什么

大多数静态博客（Hexo、Hugo、Astro……）写文章都需要：本地写 Markdown → 命令行构建 → git push。换台电脑、拿起手机就没法写了。

**NavBlog 不一样**：它是纯静态网站，可以免费托管在 GitHub Pages / Netlify / Vercel / Cloudflare Pages 上，同时自带一个 `/admin` 管理后台。在任何浏览器里打开后台、用 Git 平台的 Token 登录，就能 **写文章、传图片、改设置**；点击保存后，后台通过 GitHub / Gitee / GitLab 的 API 直接把文件提交回你的仓库，托管平台检测到提交后自动重新构建上线。

```
浏览器 /admin ──(Git API 提交 .md)──▶ 你的 Git 仓库 ──(自动构建)──▶ 静态网站
```

## 📦 功能

**前台**

- 首页文章列表（置顶、封面图、分页）、文章页、归档、分类、标签、全文搜索、关于页、404
- Markdown：代码高亮 + 一键复制、目录（TOC，随滚动高亮）、表格、任务列表、图片懒加载
- Giscus 评论（随深色模式自动切换主题）
- 主题色相调色盘（访客可调，也可固定）、深色模式（默认跟随系统）
- 响应式布局，手机端友好
- **SEO**：构建时为每篇文章生成独立的静态 HTML（标题、描述、Open Graph、JSON-LD、正文预渲染），并生成 `sitemap.xml`、`rss.xml`、`robots.txt`

**后台 `/admin`**

- 使用 GitHub / Gitee / GitLab 的 Access Token 登录（Token 只保存在你自己浏览器的 localStorage）
- 新建 / 编辑 / 删除文章：Markdown 编辑器（工具栏、分屏实时预览、`Ctrl+B/I/K/S` 快捷键）
- 图片上传：粘贴、拖拽或按钮上传，自动存到图片分支并返回 CDN 地址
- 站点设置：标题、头像、横幅、社交链接、菜单、分页、版权协议、Giscus、页脚 HTML……
- 编辑「关于」页
- 保存即提交（GitHub 上一次保存只产生一次提交）

## 🚀 快速开始

> 只想快速上线？跳过本地步骤，直接看 [部署教程](#-部署教程)，全程只需要浏览器。

需要 [Node.js](https://nodejs.org/) ≥ 20 和 [pnpm](https://pnpm.io/)（`npm i -g pnpm`）。

```bash
# 1. Fork 本仓库后 clone 你自己的仓库
git clone https://github.com/<你的用户名>/<你的仓库名>.git
cd <你的仓库名>

# 2. 安装依赖
pnpm install

# 3. 交互式初始化：填写仓库地址、博客标题、作者等（也可以手动改配置文件）
pnpm run setup

# 4. 本地预览 http://localhost:7002
pnpm start

# 5. 推送到仓库，然后按下方部署教程开启自动部署
git add . && git commit -m "init my blog" && git push
```

其他命令：

| 命令 | 说明 |
| --- | --- |
| `pnpm run new "文章标题"` | 在 `data/posts/` 下新建一篇文章 |
| `pnpm run build` | 构建到 `dist/browser` |
| `pnpm run preview` | 预览构建产物 http://localhost:4173 |

## 🌍 部署教程

无论部署到哪里，**第一步都一样**：

1. 点击右上角 **Fork**，把本仓库复制到你自己的账号下（仓库名随意，比如 `blog`）。
2. 在你 Fork 出来的仓库里打开 `blog.config.yaml`，点铅笔图标在线编辑，把 `gitRepoUrl` 和 `imageRepoUrl` 中的仓库地址改成**你自己的仓库地址**，提交。
   > 这一步决定了后台把文章保存到哪个仓库，**必须改**，否则你无法登录后台。

然后任选一个平台：

<details open>
<summary><b>方式一：GitHub Pages（推荐，完全免费，无需注册其他平台）</b></summary>

1. 打开你的仓库 → **Settings** → 左侧 **Pages**。
2. **Build and deployment → Source** 选择 **GitHub Actions**。
3. 打开仓库 **Actions** 标签页，如果提示「Workflows aren't being run on this forked repository」，点击 **I understand my workflows, go ahead and enable them**。
4. 在 Actions 里选择 **Deploy to GitHub Pages** → **Run workflow** 手动触发第一次部署（之后每次提交都会自动部署）。
5. 等待 1～2 分钟，绿色对勾后访问：
   - 仓库名为 `<用户名>.github.io` → `https://<用户名>.github.io/`
   - 其他仓库名 → `https://<用户名>.github.io/<仓库名>/`

> ✅ 子路径（`/<仓库名>/`）和站点地址会由工作流**自动识别**，`blog.config.yaml` 中的 `baseHref` 保持 `/` 即可。
>
> 自定义域名：Settings → Pages → Custom domain 填写域名，并在域名 DNS 添加 CNAME 指向 `<用户名>.github.io`。

</details>

<details>
<summary><b>方式二：Netlify</b></summary>

1. 登录 [Netlify](https://app.netlify.com/) → **Add new site → Import an existing project** → 选择 GitHub 并授权 → 选中你的仓库。
2. 构建配置会从仓库中的 `netlify.toml` 自动读取（构建命令 `pnpm run build`，发布目录 `dist/browser`），直接点 **Deploy**。
3. 部署完成后可在 **Domain management** 中修改子域名或绑定自定义域名。

</details>

<details>
<summary><b>方式三：Vercel</b></summary>

1. 登录 [Vercel](https://vercel.com/new) → **Import Git Repository** → 选中你的仓库。
2. 配置会从 `vercel.json` 自动读取，Framework Preset 选 **Other** 即可，点 **Deploy**。
3. 在 **Settings → Domains** 中可以绑定自定义域名。

</details>

<details>
<summary><b>方式四：Cloudflare Pages</b></summary>

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages → Create → Pages → Connect to Git** → 选中你的仓库。
2. 填写构建配置：
   - Framework preset：**None**
   - Build command：`pnpm run build`
   - Build output directory：`dist/browser`
   - 环境变量：`NODE_VERSION` = `22`
3. 点击 **Save and Deploy**。单页路由所需的 `_redirects` 会在构建时自动生成。

</details>

> 💡 使用 Netlify / Vercel / Cloudflare 时，可以删除 `.github/workflows/deploy-gh-pages.yml`，避免 GitHub Actions 重复构建。
>
> 💡 站点地址（用于 sitemap、RSS、canonical）：Netlify / Vercel / Cloudflare / GitHub Pages 均会自动识别；绑定自定义域名后，建议在 `blog.config.yaml` 中填写 `siteUrl`。

更详细的图文说明见 [docs/deploy.md](./docs/deploy.md)。

## ✍️ 后台使用

### 1. 获取 Access Token

后台通过 Token 调用 Git 平台 API 提交文件，Token 需要对你的博客仓库有**写权限**：

| 平台 | 获取方式 | 所需权限 |
| --- | --- | --- |
| GitHub（推荐 Fine-grained） | [Settings → Developer settings → Fine-grained tokens](https://github.com/settings/personal-access-tokens/new) | Repository access 选你的博客仓库；Permissions → **Contents: Read and write** |
| GitHub（Classic） | [Settings → Developer settings → Tokens (classic)](https://github.com/settings/tokens/new) | 勾选 `repo`（公开仓库也可只勾 `public_repo`） |
| Gitee | [设置 → 私人令牌](https://gitee.com/profile/personal_access_tokens) | `projects` |
| GitLab | [Preferences → Access Tokens](https://gitlab.com/-/user_settings/personal_access_tokens) | `api` |

### 2. 登录与写作

1. 访问 `https://你的站点/admin`，粘贴 Token 登录。
2. **文章** → **写文章**：填写标题、分类、标签、封面，在编辑器里写 Markdown，`Ctrl+S` 保存。
3. 保存后等待 1～2 分钟（托管平台重新构建），刷新前台即可看到新文章。

> 🔒 Token 只保存在当前浏览器的 localStorage 中，不会上传到任何第三方。请勿在公共电脑上登录，用完可点击「退出」。

详细说明见 [docs/admin.md](./docs/admin.md)。

## ⚙️ 配置说明

配置分两部分：

**`blog.config.yaml`** —— 构建相关，只能改文件（修改后需要重新构建）：

```yaml
gitRepoUrl: https://github.com/<你>/<仓库>                  # 博客仓库（GitHub / Gitee / GitLab）
branch: main                                                # 文章所在分支
imageRepoUrl: https://github.com/<你>/<仓库>?branch=images  # 图片存放的仓库与分支（分支不存在会自动创建）
siteUrl: https://blog.example.com                           # 站点域名（不含子路径），留空则自动识别
baseHref: /                                                 # 部署子路径，GitHub Pages 会自动识别
```

**`data/settings.json`** —— 站点外观与功能，推荐在后台 **站点设置** 中修改。包括标题、副标题、头像、Favicon、横幅图、主题色、每页文章数、社交链接、菜单、版权协议、Giscus 评论、页脚 HTML、自定义 `<head>` 代码、不蒜子统计等。

完整字段说明见 [docs/config.md](./docs/config.md)。

### 文章格式

文章放在 `data/posts/<slug>.md`，文件名即文章地址 `/posts/<slug>/`：

```markdown
---
title: 文章标题
date: 2026-11-08 12:00
updated: 2026-11-09 08:00   # 可选，更新时间
category: 随笔              # 可选，分类
tags: [博客, 开始]          # 可选，标签
summary: 文章摘要           # 可选，缺省时自动截取正文
cover: https://...jpg       # 可选，封面图
pinned: true                # 可选，置顶
draft: false                # 可选，草稿不会出现在前台
comments: true              # 可选，是否开启评论
---

正文……
```

## 🗂️ 目录结构

```
blog.config.yaml        仓库地址、分支、图片仓库、站点地址、baseHref
data/
  posts/*.md            文章（YAML front matter + Markdown 正文）
  posts.json            文章索引（构建时自动生成，无需手动维护）
  settings.json         站点设置（后台「站点设置」编辑的就是它）
  about.md              关于页
public/                 静态资源（favicon、默认头像等），原样复制到站点根目录
scripts/                构建脚本（prepare / postbuild / preview / new-post / init）
src/app/                前台页面与组件；src/app/admin 为后台
src/shared/             前台、后台、构建脚本共用的 front matter / Markdown 模块
docs/                   详细文档
```

## ❓ 常见问题

<details>
<summary>后台登录提示「Token 无效」或「无权访问仓库」</summary>

- 检查 `blog.config.yaml` 中的 `gitRepoUrl` 是否已改成**你自己的仓库**，并且已经重新部署。
- 检查 Token 是否勾选了对应权限、是否过期；Fine-grained Token 需要在 Repository access 中选中该仓库。

</details>

<details>
<summary>保存文章后前台没有变化</summary>

保存只是提交到仓库，需要托管平台重新构建（通常 1～2 分钟）。可以到 GitHub Actions / Netlify / Vercel / Cloudflare 的部署记录中查看进度。如果平台没有自动构建，可在站点设置中填写「部署钩子 URL」。

</details>

<details>
<summary>GitHub Pages 页面样式丢失或空白</summary>

确认 Settings → Pages 的 Source 是 **GitHub Actions**（而不是 Deploy from a branch），并检查 Actions 中最近一次运行是否成功。

</details>

<details>
<summary>图片上传后无法显示</summary>

GitHub 图片默认通过 jsDelivr CDN 访问，首次上传后可能需要几十秒生效；国内访问不稳定时，可在站点设置中更换 `GitHub CDN` 域名（如 `gcore.jsdelivr.net`、`fastly.jsdelivr.net`）。私有仓库的图片无法通过 CDN 访问，请使用公开的图片仓库。

</details>

更多问题见 [docs/faq.md](./docs/faq.md)，或在 [Issues](../../issues) 中提问。

## 🙏 致谢

- [xjh22222228/nav](https://github.com/xjh22222228/nav) —— 「纯静态 + Git API 在线编辑」架构来源，本项目基于它改造（GPL-3.0）
- [saicaca/fuwari](https://github.com/saicaca/fuwari) —— 主题设计参考
- [Angular](https://angular.dev/)、[Tailwind CSS](https://tailwindcss.com/)、[marked](https://marked.js.org/)、[highlight.js](https://highlightjs.org/)、[Font Awesome](https://fontawesome.com/)、[Giscus](https://giscus.app/)

## 📄 License

[GPL-3.0](./LICENSE)

<div align="center">

# 🌸 NavBlog

**纯静态部署，却能在线进入后台写作的个人博客系统**

Fuwari 风格主题 · Markdown 文章 · Git 仓库即数据库 · 零服务器 · 零数据库

Angular 21 + TypeScript + Tailwind CSS 4。最新功能说明更新于 **2026-11-10**。

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

- 首页文章列表（置顶、封面容错、分页或自动加载）、文章页、年月归档、分类、标签、关于页、404
- 站内搜索覆盖标题、公开摘要、分类和标签，支持关键词高亮
- **文章密码加密**：浏览器原生 Web Crypto，保存前加密正文，访客输入密码阅读
- **碎碎念 `/moments`**：头像、时间和短文本时间线，保留换行
- Markdown：代码高亮 + 一键复制、目录（TOC，随滚动高亮）、表格、任务列表、图片懒加载
- Giscus 评论（随深色模式自动切换主题）
- 主题色相调色盘（HEX 复制、固定色相）、深浅色（系统／固定／定时切换），访客可恢复站点默认外观
- 侧栏便签公告（可关闭）、最新文章、联系翻转卡片；桌面侧栏可反转，文章可全宽阅读
- 每日文字：多个接口来源独立按天缓存；自定义 `{date} {time} {weekday} {month} {day}` 变量，时间自动更新
- 自定义 CSS、外部 CSS／JS、ICP备案与公安备案、RSS 开关及全文／摘要模式、PWA 安装参数
- 响应式布局，手机端友好
- **SEO**：构建文章及碎碎念静态 HTML，生成 Open Graph、JSON-LD、`sitemap.xml`、`robots.txt` 和可选 RSS；加密文章只预渲染公开信息和解锁提示

**后台 `/admin`**

- 使用 GitHub / Gitee / GitLab 的 Access Token 登录（Token 只保存在你自己浏览器的 localStorage）
- 新建 / 编辑 / 删除文章：Markdown 编辑器（工具栏、分屏实时预览、`Ctrl+B/I/K/S` 快捷键）
- 图片上传：粘贴、拖拽或按钮上传，自动存到图片分支并返回 CDN 地址
- 站点设置：标题、头像、横幅、社交链接、菜单、分页、版权协议、Giscus、页脚 HTML……
- 编辑「关于」页
- 加密文章解锁编辑、修改密码和重新加密
- 碎碎念发布／编辑／删除，Git 文件版本核验避免静默覆盖，删除需页内确认
- **本地演示无需 Token**：在浏览器中试写文章和修改设置，可导出已保存的演示文件
- 保存即提交（GitHub 上一次保存只产生一次提交）

## 🚀 快速开始

> 只想快速上线？跳过本地步骤，直接看 [部署教程](#-部署教程)，全程只需要浏览器。

建议使用 [Node.js](https://nodejs.org/) **22.12 或更新的 22 LTS**，或 Node.js 24；配合 [pnpm](https://pnpm.io/) 10（`npm i -g pnpm@10`）。

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
| `pnpm exec tsx scripts/preview.ts 7002` | 将已构建产物预览在 http://localhost:7002；不会自动重建 |

### 无需 Token 的本地演示

启动后打开 `/admin`，选择 **进入本地演示（无需 Token）**。可编辑文章、碎碎念、关于页和站点设置，保存后点击“查看博客”预览。

**演示修改只存在于当前浏览器，不会写回项目或 Git。** 刷新保留副本，退出演示恢复构建内容；换浏览器不会共享数据。“导出演示数据”可复制已保存的 JSON 文件映射，用于备份或核对后同步到项目。正式发布请修改项目 `data/` 文件，或使用 Token 登录后提交到仓库。

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
   - 环境变量：`NODE_VERSION` = `22`（使用 22.12 或更新版本）
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

其他入口：`/admin/moments` 管理碎碎念，`/admin/about` 编辑关于页，`/admin/settings` 配置主题、公告、每日文字、RSS、PWA 等。

> 🔒 Token 保存在当前浏览器的 localStorage 中，作为请求凭据直接发送给配置的 Git 平台 API。请勿在公共电脑上登录，用完可点击“退出”；自定义脚本只使用可信来源。

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

**`data/settings.json`** —— 站点外观与功能，推荐在后台 **站点设置** 中修改。包括主题及定时深色、横幅、侧栏布局、公告、每日文字、社交链接、RSS、PWA、备案、评论、版权和自定义资源。

**`data/moments.json`** —— 碎碎念数组，通过后台管理；ID 稳定，时间使用带时区的 ISO 格式，正文为纯文本。初始为空数组。

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
hideSidebar: true           # 可选，全宽阅读
---

正文……
```

### 加密文章

在后台编辑器勾选“文章密码加密”，填写并确认至少 12 个字符的密码。正文用 AES-256-GCM 加密，密码通过 PBKDF2-SHA-256 派生密钥；保存到仓库的是公开元信息和密文，密码不会写入文件。阅读和再次编辑均需解锁。

标题、摘要、分类、标签、封面与独立附件仍公开。加密文章只使用手写的公开摘要，留空显示加密提示；搜索、RSS 和静态页面不输出私密正文。不要给明文文章手写 `encrypted: true` 或保存密码字段。已经公开的 Git 明文历史不会因加密而消失。

详见 [文章加密](./docs/post-encryption.md) 和 [碎碎念](./docs/moments.md)。

### 每日文字与安装参数

自定义文字支持 `{date} {time} {weekday} {month} {day}`。`{time}` 使用访客设备本地时间，格式为 `HH:mm`；刷新立即更新，页面打开时随分钟变化，不会因此重新请求接口一言。

PWA 提供名称、颜色、Apple touch 图标及 192／512 PNG 安装图标配置，支持部署子路径；安装 PNG 文件放在 `public/`，构建校验尺寸。当前未提供 Service Worker 或离线阅读，浏览器是否显示安装入口取决于其条件。

## 🗂️ 目录结构

```
blog.config.yaml        仓库地址、分支、图片仓库、站点地址、baseHref
data/
  posts/*.md            文章（YAML front matter + Markdown 正文）
  posts.json            文章索引（构建时自动生成，无需手动维护）
  settings.json         站点设置（后台「站点设置」编辑的就是它）
  about.md              关于页
  moments.json          碎碎念（ID、ISO 时间、纯文本、可选更新时间）
public/                 静态资源（favicon、默认头像等），原样复制到站点根目录
scripts/                构建脚本（prepare / postbuild / preview / new-post / init）
src/app/                前台页面与组件；src/app/admin 为后台
src/shared/             文章解析、加密、动态校验、主题与每日文字等共用模块
docs/                   详细文档
```

## ❓ 常见问题

<details>
<summary>后台登录提示「Token 无效」或「无权访问仓库」</summary>

- 检查 `blog.config.yaml` 中的 `gitRepoUrl` 是否已改成**你自己的仓库**，并且已经重新部署。
- 检查 Token 是否勾选了对应权限、是否过期；Fine-grained Token 需要在 Repository access 中选中该仓库。

</details>

<details>
<summary>本地演示保存了，但重新构建或换浏览器后没有修改</summary>

演示保存只更新当前浏览器副本。请通过“导出演示数据”备份并核对后同步到项目，或在正式后台用 Token 提交。构建读取项目文件，不能自动读取浏览器存储。

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
- Handsome 时光机 —— 碎碎念时间线的 UI 结构参考；本项目使用 Angular 重写，未引入 PHP
- [Angular](https://angular.dev/)、[Tailwind CSS](https://tailwindcss.com/)、[marked](https://marked.js.org/)、[highlight.js](https://highlightjs.org/)、[Font Awesome](https://fontawesome.com/)、[Giscus](https://giscus.app/)

## 📄 License

[GPL-3.0](./LICENSE)

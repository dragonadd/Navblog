# 部署教程

本文详细介绍如何把 NavBlog 部署到 GitHub Pages、Netlify、Vercel、Cloudflare Pages，以及绑定自定义域名、开启后台、配置评论。

- [0. 准备工作（所有平台通用）](#0-准备工作所有平台通用)
- [1. GitHub Pages](#1-github-pages)
- [2. Netlify](#2-netlify)
- [3. Vercel](#3-vercel)
- [4. Cloudflare Pages](#4-cloudflare-pages)
- [5. 部署到 Gitee / GitLab](#5-部署到-gitee--gitlab)
- [6. 部署完成后](#6-部署完成后)

---

## 0. 准备工作（所有平台通用）

### 0.1 Fork 仓库

1. 登录 GitHub，打开 NavBlog 仓库页面，点击右上角 **Fork**。
2. **Repository name** 可以自定义：
   - 想使用 `https://<用户名>.github.io/` 根域名访问，就命名为 `<用户名>.github.io`；
   - 否则随意，比如 `blog`，访问地址为 `https://<用户名>.github.io/blog/`。
3. 点击 **Create fork**。

> 也可以使用仓库页面上的 **Use this template**（如果有）创建一个全新的、不带提交历史的仓库。

### 0.2 修改仓库地址（必须）

后台需要知道把文章提交到哪个仓库。打开你的仓库中的 `blog.config.yaml`，点击右上角铅笔图标在线编辑：

```yaml
gitRepoUrl: https://github.com/<你的用户名>/<你的仓库名>
branch: main
imageRepoUrl: https://github.com/<你的用户名>/<你的仓库名>?branch=images
```

点击 **Commit changes** 保存。

> 如果你在本地开发，可以直接运行 `pnpm run setup`，向导会帮你填好这些值。

### 0.3（可选）修改站点信息

`data/settings.json` 中的标题、作者、头像等，部署完成后可以在后台 **站点设置** 中图形化修改，现在不改也没关系。

---

## 1. GitHub Pages

最推荐的方式：免费、无需注册其他平台、和仓库在一起。

1. 仓库 → **Settings** → 左侧 **Pages**。
2. **Build and deployment → Source** 选择 **GitHub Actions**。
3. 打开仓库的 **Actions** 标签页。Fork 出来的仓库默认禁用工作流，点击绿色按钮 **I understand my workflows, go ahead and enable them**。
4. 左侧选择 **Deploy to GitHub Pages** → 右侧 **Run workflow** → **Run workflow**。
5. 等待 1～2 分钟，任务变成绿色对勾后，点进 `deploy` 任务即可看到站点地址。

之后每次提交（包括在后台保存文章）都会自动触发部署。

**关于子路径**：工作流会通过 `actions/configure-pages` 自动获取站点地址与子路径，并以环境变量 `BLOG_BASE_HREF`、`BLOG_SITE_URL` 传给构建脚本，所以 `blog.config.yaml` 里的 `baseHref` 保持 `/` 就行。

**自定义域名**：

1. Settings → Pages → **Custom domain** 填入域名（如 `blog.example.com`），保存。
2. 到域名服务商添加 DNS 记录：`CNAME blog → <用户名>.github.io`。
3. 等待证书签发后勾选 **Enforce HTTPS**。
4. 重新运行一次工作流（子路径会自动变成 `/`）。

---

## 2. Netlify

1. 登录 <https://app.netlify.com/>，点击 **Add new site → Import an existing project**。
2. 选择 **GitHub** 并授权，选中你的博客仓库。
3. 构建配置会从仓库中的 `netlify.toml` 自动读取：
   - Build command：`pnpm run build`
   - Publish directory：`dist/browser`
   - Node 版本：22
4. 点击 **Deploy**，等待完成。
5. **Site configuration → Domain management** 中可以修改 `xxx.netlify.app` 子域名或绑定自定义域名。

Netlify 会自动监听仓库提交并重新构建。

---

## 3. Vercel

1. 登录 <https://vercel.com/new>，**Import Git Repository**，选择你的博客仓库。
2. **Framework Preset** 选 **Other**；构建命令与输出目录会从 `vercel.json` 读取（`pnpm run build` / `dist/browser`）。
3. 点击 **Deploy**。
4. **Settings → Domains** 中可以绑定自定义域名。

---

## 4. Cloudflare Pages

1. 登录 <https://dash.cloudflare.com/>，进入 **Workers & Pages → Create → Pages → Connect to Git**。
2. 授权 GitHub 并选择你的博客仓库，点击 **Begin setup**。
3. 填写：

   | 项 | 值 |
   | --- | --- |
   | Framework preset | None |
   | Build command | `pnpm run build` |
   | Build output directory | `dist/browser` |
   | Environment variables | `NODE_VERSION` = `22` |

4. 点击 **Save and Deploy**。
5. **Custom domains** 中可以绑定自定义域名（域名托管在 Cloudflare 时最方便）。

单页路由所需的 `_redirects` 文件会在构建时自动生成。

---

## 5. 部署到 Gitee / GitLab

后台同样支持 Gitee 与 GitLab 仓库，`gitRepoUrl` 写成对应地址即可：

```yaml
gitRepoUrl: https://gitee.com/<用户名>/<仓库名>
# 或
gitRepoUrl: https://gitlab.com/<用户名>/<仓库名>
```

构建与托管可以使用 Netlify / Vercel / Cloudflare Pages（它们都支持导入 GitLab 仓库），或使用 GitLab Pages（构建命令 `pnpm run build`，把 `dist/browser` 作为 `public` 产物）。

> Gitee Pages 已停止服务，使用 Gitee 仓库时请搭配其他托管平台，并在站点设置中填写「部署钩子 URL」。

---

## 6. 部署完成后

1. **登录后台**：访问 `https://你的站点/admin`，按 [后台使用指南](./admin.md) 创建 Token 登录。
2. **修改站点设置**：标题、头像、横幅、社交链接等。
3. **配置评论**（可选）：见 [配置说明 → Giscus](./config.md#giscus-评论)。
4. **删除示例文章**，开始写作！

### 平台对比

| | GitHub Pages | Netlify | Vercel | Cloudflare Pages |
| --- | --- | --- | --- | --- |
| 需要额外注册 | 否 | 是 | 是 | 是 |
| 自动构建 | ✅ Actions | ✅ | ✅ | ✅ |
| 国内访问 | 一般 | 一般 | 较差 | 较好 |
| 免费额度 | 充足 | 300 分钟构建/月 | 充足 | 500 次构建/月 |

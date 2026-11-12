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

### 0.2 确认仓库配置（默认无需修改）

当前版本默认使用自动识别，常规 Fork 后通过 Git 集成部署，可以保留 `blog.config.yaml` 中的配置：

```yaml
gitRepoUrl: auto
branch: auto
imageRepoUrl: auto
```

一般选择仓库主分支（通常为 `main`）部署；其他分支由部署者按需选择。保持 `branch: auto`，后台就会跟随托管平台选定的部署分支。

后台仍需要真实的仓库地址，但不要求你手动填写。`pnpm run build` 会从托管平台的仓库信息或 Git `origin` 解析地址，写入 `src/generated/config.json` 并打包给前端；后台使用这个结果提交文章、设置和登录凭证。`imageRepoUrl: auto` 使用同一仓库的 `images` 分支。地址在构建时确定，Token 用于鉴权，不用于推断目标仓库。

| 部署来源 | `gitRepoUrl: auto` 的识别依据 | `branch: auto` 的识别依据 |
| --- | --- | --- |
| GitHub Pages（Actions） | `GITHUB_REPOSITORY` | `GITHUB_REF_NAME` |
| Netlify | `REPOSITORY_URL`，其次 Git `origin` | `BRANCH` |
| Vercel（导入 GitHub 仓库） | `VERCEL_GIT_REPO_OWNER` / `VERCEL_GIT_REPO_SLUG`，其次 Git `origin` | `VERCEL_GIT_COMMIT_REF` |
| Cloudflare Pages | Git `origin` | `CF_PAGES_BRANCH` |
| 本地 Git 克隆 | Git `origin` | 当前本地分支 |

只有以下情况需要手动配置：

- 下载 ZIP 等方式取得源码，且构建环境没有可识别的仓库信息或 Git `origin`。自托管 GitLab、特殊命名空间等无法自动识别的地址也需手动指定。
- 希望后台向另一仓库提交，或图片使用独立仓库。
- 使用旧配置或 Fork 了已填写固定地址的副本：显式 URL 不会被自动覆盖，请改回 `auto`，或改为自己的完整仓库地址。

手动指定时，打开仓库中的 `blog.config.yaml` 在线编辑并提交，或在本地运行 `pnpm run setup`：

```yaml
gitRepoUrl: https://github.com/<你的用户名>/<你的仓库名>
branch: auto
imageRepoUrl: auto
```

独立图片仓库可另填 `imageRepoUrl: https://github.com/<用户名>/<图片仓库>?branch=images`。自动模式无法识别仓库或分支时会停止构建，不会回退到原作者仓库。仓库重命名、切换 `origin` 或修改配置后，请重新运行 `pnpm run build` 并部署，再刷新后台、核对登录页显示的仓库和提交分支后登录。直接上传 `dist/browser` 时也沿用此前构建时的目标仓库，上传操作不会重新识别地址。

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

默认工作流监听 `main` 分支，之后向该分支提交（包括在后台保存文章）会自动触发部署。若选择其他分支，请同步修改 `.github/workflows/deploy-gh-pages.yml` 中的 `on.push.branches`，并从对应分支运行工作流。

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
   - Build command：`npm run build`（配置文件默认值，与 `pnpm run build` 执行同一构建脚本）
   - Publish directory：`dist/browser`
   - Node 版本：22
4. 点击 **Deploy**，等待完成。
5. **Site configuration → Domain management** 中可以修改 `xxx.netlify.app` 子域名或绑定自定义域名。

Netlify 会自动监听仓库提交并重新构建。

---

## 3. Vercel

1. 登录 <https://vercel.com/new>，**Import Git Repository**，选择你的博客仓库。
2. **Framework Preset** 选 **Other**；构建命令与输出目录会从 `vercel.json` 读取（`npm run build` / `dist/browser`，与 `pnpm run build` 执行同一构建脚本）。
3. 点击 **Deploy**。
4. **Settings → Domains** 中可以绑定自定义域名。

---

## 4. Cloudflare Pages

1. 登录 <https://dash.cloudflare.com/>，进入 **Workers & Pages → Create → Pages → Connect to Git**。
2. 授权 GitHub 并选择你的博客仓库，点击 **Begin setup**。
3. 填写：

   | 项 | 值 |
   | --- | --- |
   | Production branch | 仓库主分支，通常为 `main`；也可自行选择其他分支 |
   | Framework preset | None |
   | Build command | `pnpm run build` |
   | Build output directory | `dist/browser` |
   | Environment variables | `NODE_VERSION` = `22` |

4. 点击 **Save and Deploy**。
5. **Custom domains** 中可以绑定自定义域名（域名托管在 Cloudflare 时最方便）。

构建会为 `/admin`、`/admin/` 以及后台登录、设置、编辑等路径生成限定的 `_redirects` 回退，目标为已经生成的 `admin/index.html`。Cloudflare 的规则优先于已有资源，不要添加 `/* /index.html 200`，否则 JS、CSS 和 `data/auth.json` 也会被改写为 HTML。文章和碎碎念使用各自预渲染静态页，未知地址使用 `404.html`；Netlify 的通用回退仍由 `netlify.toml` 管理。

请完整发布 `dist/browser`，确保 `_redirects`、`_headers`、HTML 和哈希命名的 JS/CSS 属于同一次构建。`_headers` 使首页和后台 HTML 重新校验缓存，认证文件保持 no-store；仓库地址修改后，先重新部署，再刷新后台并重新登录。Cloudflare 根域部署的 `baseHref` 保持 `/`。

默认 `gitRepoUrl: auto` 通过 Git `origin` 识别 Cloudflare 连接的仓库，普通 Fork 后无需替换地址。若构建环境没有可用的 Git `origin` 或其他仓库来源，请在 YAML 中填写完整仓库 URL；识别失败会阻止构建。显式填写的 URL 始终保留，因此旧配置中的固定地址仍需核对。各平台识别方式见 [确认仓库配置](#02-确认仓库配置默认无需修改)。

默认 `branch: auto` 读取 Cloudflare 的 `CF_PAGES_BRANCH`，后台向本次部署所选的分支提交。保存文章、设置或密码后，需等待对应分支重新部署。只有需要固定提交到某个分支时，才在 YAML 中显式填写该分支名。

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

# 常见问题

### 后台登录失败

- **「Token 无效」**：Token 复制不完整、已过期，或者选错了平台（GitHub Token 不能用于 Gitee 仓库）。
- **「无权访问仓库」**：`blog.config.yaml` 中的 `gitRepoUrl` 不是你的仓库（Fork 后忘记修改），或 Fine-grained Token 没有选中该仓库。修改配置后需要重新部署。

### 保存成功但前台没变化

保存只是把文件提交到仓库，需要托管平台重新构建：

- GitHub Pages：仓库 **Actions** 页查看运行状态；
- Netlify / Vercel / Cloudflare：在各自控制台查看部署记录。

浏览器也可能缓存了旧页面，尝试强制刷新（`Ctrl+F5`）。

### 保存时提示冲突（409 / sha 不匹配）

在另一个标签页或设备上同时修改了同一文件。刷新后台页面重新打开文章再保存即可。

### GitHub Pages 打开是 README 或 404

Settings → Pages → Source 必须选择 **GitHub Actions**，而不是 Deploy from a branch。

### 页面样式丢失 / 资源 404

通常是子路径设置不正确。使用本仓库自带的 GitHub Actions 工作流时会自动处理；如果你自己写了构建流程，请设置环境变量 `BLOG_BASE_HREF=/<仓库名>/` 或修改 `blog.config.yaml` 的 `baseHref`。

### 图片上传后不显示

- jsDelivr 首次缓存需要一点时间，稍等再刷新；
- 国内网络可在站点设置中把 GitHub CDN 改为 `gcore.jsdelivr.net` 或 `fastly.jsdelivr.net`；
- 图片仓库必须是**公开**仓库，私有仓库无法通过 CDN 访问。

### 评论区不显示

- 检查站点设置中 Giscus 是否已启用、四个 ID 字段是否填写正确；
- 仓库必须公开、开启 Discussions 并安装了 giscus app；
- 文章 front matter 中 `comments: false` 会关闭该文章的评论。

### 如何同步上游更新

在你的仓库页面点击 **Sync fork → Update branch**。你的文章和设置位于 `data/` 和 `blog.config.yaml` 中，一般不会产生冲突；如有冲突，以你自己的 `data/` 为准。

### 能不能在本地写文章

当然可以。直接在 `data/posts/` 中新建 Markdown 文件（或运行 `pnpm run new "标题"`），`git push` 后同样会自动构建。`data/posts.json` 会在构建时自动重新生成，无需手动维护。

### 如何迁移 Hexo / Hugo 等博客的文章

把 Markdown 文件复制到 `data/posts/`，确保 front matter 中有 `title` 和 `date`；`categories` 请改为单个 `category`，`tags` 写成数组即可。

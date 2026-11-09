# 后台使用指南

NavBlog 的后台位于站点的 `/admin` 路径，是一个纯前端页面：它在你的浏览器里直接调用 GitHub / Gitee / GitLab 的 API 读取和提交仓库文件，没有任何中间服务器。

## 创建 Access Token

### GitHub（推荐 Fine-grained Token）

1. 打开 <https://github.com/settings/personal-access-tokens/new>。
2. **Token name** 随意，**Expiration** 建议选一个较长的时间或 No expiration。
3. **Repository access** 选择 **Only select repositories**，选中你的博客仓库。
4. **Permissions → Repository permissions → Contents** 选择 **Read and write**。
5. 点击 **Generate token**，复制以 `github_pat_` 开头的字符串（只显示一次）。

> 使用 Classic Token：<https://github.com/settings/tokens/new>，勾选 `repo` 即可。

### Gitee

<https://gitee.com/profile/personal_access_tokens> → 生成新令牌 → 勾选 `projects`。

### GitLab

<https://gitlab.com/-/user_settings/personal_access_tokens> → Add new token → 勾选 `api`。

## 登录

访问 `https://你的站点/admin`，在 **Access Token** 输入框粘贴 Token，点击登录。后台会校验：

- Token 是否有效；
- Token 所属用户是否有权访问 `blog.config.yaml` 中配置的仓库。

Token 只保存在当前浏览器的 `localStorage` 中。点击左侧 **退出登录** 即可清除。

## 写文章

**文章 → 写文章**：

| 字段 | 说明 |
| --- | --- |
| 标题 | 必填 |
| Slug | 文件名与文章 URL（`/posts/<slug>/`），默认由标题生成；建议使用英文和短横线 |
| 发布时间 | 用于排序和归档 |
| 分类 / 标签 | 可从已有分类标签中选择，标签用逗号分隔 |
| 摘要 | 留空时自动截取正文开头 |
| 封面图 | 可以填写图片地址或直接上传 |
| 置顶 / 草稿 / 评论 | 草稿不会出现在前台；关闭评论后文章页不显示 Giscus |

编辑器支持：

- 工具栏：标题、粗体、斜体、链接、图片、代码块、引用、列表、表格等
- 视图切换：编辑 / 分屏 / 预览
- 快捷键：`Ctrl+B` 粗体、`Ctrl+I` 斜体、`Ctrl+K` 链接、`Ctrl+S` 保存
- 图片：直接 **粘贴** 截图或 **拖拽** 图片到编辑器，自动上传并插入 Markdown

点击 **保存**（或 `Ctrl+S`）后，后台会把文章 `data/posts/<slug>.md` 和索引 `data/posts.json` 一起提交到仓库。托管平台重新构建完成后（1～2 分钟）前台即可看到。

> 修改 Slug 相当于重命名文章，旧地址会失效。

## 图片存储

图片上传到 `blog.config.yaml` 中 `imageRepoUrl` 指定的仓库与分支（默认是同一仓库的 `images` 分支，不存在时自动创建）。使用单独的分支可以避免图片触发博客重新构建，也不会让主分支变得臃肿。

上传后返回的地址：

- GitHub：`https://<CDN 域名>/gh/<用户名>/<仓库>@<分支>/<路径>`（jsDelivr，CDN 域名可在站点设置中修改）
- Gitee：`https://gitee.com/<用户名>/<仓库>/raw/<分支>/<路径>`
- GitLab：`https://gitlab.com/<用户名>/<仓库>/-/raw/<分支>/<路径>`

## 站点设置 / 关于页

- **站点设置**：修改后保存会提交 `data/settings.json`，重新构建后生效。
- **关于页**：编辑 `data/about.md`。

## 部署钩子

如果托管平台不会因为仓库提交自动构建（例如仓库在 Gitee，而托管在 Vercel），可以在平台中创建一个 **Deploy Hook**，把地址填到 **站点设置 → 部署钩子 URL**。后台每次保存后都会请求它触发构建。

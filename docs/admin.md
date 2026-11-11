# 后台使用指南

NavBlog 的后台位于站点的 `/admin` 路径，是一个纯前端页面：它在你的浏览器里直接调用 GitHub / Gitee / GitLab 的 API 读取和提交仓库文件，没有任何中间服务器。

## 本地演示（无需 Token）

碎碎念入口是 `/admin/moments`：填写短文本和发布时间即可发布，支持编辑与页内确认删除。数据存入 `data/moments.json`，本地演示保存在当前浏览器。详见 [碎碎念说明](moments.md)。

启动本地预览后访问 `http://localhost:4173/admin`（`pnpm start` 则为端口 7002），在登录页点击 **进入本地演示（无需 Token）**。

- 可查看和编辑文章、关于页、站点设置；保存后点击 **查看博客** 即可预览。一言 API 修改也可直接测试。
- 未修改的文章从本地静态资源读取，修改的文件副本保存在浏览器 localStorage。刷新后仍保留，同一标签页的演示状态保存在 sessionStorage。
- 图片以 Data URL 在浏览器中预览，占用浏览器存储空间；演示保存不会写入磁盘、调用 Git API 或触发部署。
- 点击 **退出演示** 恢复源码构建出的内容；再次进入演示仍可读取之前的演示修改。
- 仅允许 `localhost`、`127.0.0.1`、IPv6 回环地址使用。线上域名与局域网地址不显示入口，也不会启用演示数据。

演示用于预览和调试。正式内容仍需编辑本地 `data/` 文件，或使用 Token 登录后提交到仓库。`headHtml` 等构建时注入的设置仍需修改源码并重新构建。

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

Token 仅存当前标签页的 `sessionStorage`，刷新可保留，点击 **退出登录** 清除。旧 `localStorage.token` 会在升级后删除，需重新登录。浏览器复制/恢复标签页可能继承会话，关闭不保证不可恢复。

设置登录密码后默认显示密码登录，并保留 Token 兜底。设置页的“登录密码管理”支持独立设置、修改、移除密码：至少 8 位且含字母和数字，建议 12 位以上。只提交加密 Token，不存密码；删除文件不能撤销历史密文里的 Token。详见 [后台认证](authentication.md)。本地演示禁止处理真实登录凭证。

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

文章、站点设置和关于页会记录读取时的内容，保存前核对最新版本。另一窗口已修改文件时会停止保存，当前输入保留；先复制草稿再重新打开编辑页读取新内容。损坏的文章索引会停止操作，不会用旧索引覆盖。

GitHub 多文件提交在固定 Git head 上核验版本，再原子更新分支；GitLab 使用文件 `last_commit_id` 条件提交。Gitee 会先预检全部文件，再逐个按 SHA 更新，过程中失败仍可能部分提交，不能视为一个事务；请检查仓库、重新读取后继续。

GitHub 请求统一使用 `Authorization: Bearer <token>` 和 `Accept: application/vnd.github.v3+json`。单文件写入在 PUT/DELETE 前再次读取文件并核验原 SHA，更新和删除带上文件 SHA；新建文件不带 SHA。文本内容使用 UTF-8 Base64，已编码内容直接传递。请求失败会提示请求方式和接口路径，便于核对仓库地址，不输出 Token 或提交正文。

只有 `data/posts/` 顶层 Markdown 参与文章读取和发布。草稿不会进入公开源码资源或前端索引，但公开仓库里的源文件及 Git 历史仍可被访问。

> 修改 Slug 相当于重命名文章，旧地址会失效。

## 图片存储

图片上传到 `blog.config.yaml` 中 `imageRepoUrl` 指定的仓库与分支（默认是同一仓库的 `images` 分支，不存在时自动创建）。使用单独的分支可以避免图片触发博客重新构建，也不会让主分支变得臃肿。

上传后返回的地址：

- GitHub：`https://<CDN 域名>/gh/<用户名>/<仓库>@<分支>/<路径>`（jsDelivr，CDN 域名可在站点设置中修改）
- Gitee：`https://gitee.com/<用户名>/<仓库>/raw/<分支>/<路径>`
- GitLab：`https://gitlab.com/<用户名>/<仓库>/-/raw/<分支>/<路径>`

## 站点设置 / 关于页

- **站点设置**：修改后保存会提交 `data/settings.json`，重新构建后生效。
- **站点设置 → 主页公告**：侧栏便签，显示正文和可选详情链接，保留换行；允许关闭时右上角显示关闭按钮。标题字段兼容保留但不展示。访客关闭后按公告版本记住状态，修改内容后再次展示；本地演示可直接预览。
- **站点设置 → 自定义 CSS / 外部资源**：填写原始 CSS、每行一个的外部 CSS/JS 地址。支持 HTTPS 或站内路径，保存时去重并检查地址；重新构建后注入，本地演示不直接执行新脚本。只使用可信脚本，外部服务器需要允许 CORS。
- **关于页**：编辑 `data/about.md`。

## 部署钩子

如果托管平台不会因为仓库提交自动构建（例如仓库在 Gitee，而托管在 Vercel），可以在平台中创建一个 **Deploy Hook**，把地址填到 **站点设置 → 部署钩子 URL**。后台每次保存后都会请求它触发构建。
## 文章密码加密

后台编辑器可勾选“文章密码加密”，填写并确认至少 4 个字符的密码。标题和摘要仍公开；摘要留空只显示加密提示。再次编辑时先解锁正文，再保存会重新加密。详见 [文章加密说明](post-encryption.md)。

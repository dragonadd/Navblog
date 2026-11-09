# 配置说明

## blog.config.yaml

构建时读取，修改后需要重新构建（提交到仓库即可自动构建）。

| 字段 | 说明 | 示例 |
| --- | --- | --- |
| `gitRepoUrl` | 博客源码仓库，后台把文章提交到这里。支持 GitHub / Gitee / GitLab；GitLab 可附加 `?projectId=123` | `https://github.com/alice/blog` |
| `branch` | 文章所在分支 | `main` |
| `imageRepoUrl` | 图片存放仓库，`?branch=` 指定分支。留空则使用 `gitRepoUrl` 的 `image` 分支 | `https://github.com/alice/blog?branch=images` |
| `siteUrl` | 站点域名，只填协议 + 域名，不要带子路径和结尾 `/`。用于 sitemap、RSS、canonical、版权链接。留空时会自动从托管平台环境变量识别 | `https://blog.alice.dev` |
| `baseHref` | 站点部署的子路径。GitHub Pages 项目页为 `/<仓库名>/`（GitHub Actions 会自动设置），其他情况保持 `/` | `/` |

### 环境变量

构建时以下环境变量优先于配置文件：

| 变量 | 作用 |
| --- | --- |
| `BLOG_BASE_HREF` | 覆盖 `baseHref` |
| `BLOG_SITE_URL` | `siteUrl` 未填写时使用 |
| `URL` / `VERCEL_PROJECT_PRODUCTION_URL` / `CF_PAGES_URL` | Netlify / Vercel / Cloudflare 自动注入，`siteUrl` 未填写时使用 |

## data/settings.json

推荐在后台 **站点设置** 中修改。

### 基本信息

| 字段 | 说明 |
| --- | --- |
| `title` | 站点标题 |
| `subtitle` | 副标题 / 个人签名，显示在侧边栏 |
| `description` | 站点描述，用于 SEO |
| `keywords` | 关键词，逗号分隔 |
| `author` | 作者昵称 |
| `avatar` | 头像地址，可为绝对地址或相对站点根目录的路径（如 `avatar.svg`，放在 `public/` 下） |
| `favicon` | 网站图标，同上 |
| `since` | 建站年份，显示在页脚 |

### 外观

| 字段 | 说明 |
| --- | --- |
| `heroEnable` | 是否显示首页顶部横幅 |
| `heroImage` | 横幅图片地址 |
| `heroCreditText` / `heroCreditLink` | 横幅右下角署名文字与链接 |
| `themeHue` | 默认主题色相（0～360）。访客也可以通过调色盘自行调整 |
| `themeFixed` | 为 `true` 时隐藏调色盘，固定使用默认色相 |
| `postsPerPage` | 每页文章数 |
| `showCover` | 文章列表是否显示封面图 |

### 社交链接与菜单

```json
"social": [
  { "icon": "fab fa-github", "label": "GitHub", "url": "https://github.com/alice" },
  { "icon": "fas fa-envelope", "label": "Email", "url": "mailto:alice@example.com" },
  { "icon": "fas fa-rss", "label": "RSS", "url": "rss.xml" }
],
"menus": [
  { "name": "友链", "url": "/posts/friends/" },
  { "name": "GitHub", "url": "https://github.com/alice", "blank": true }
]
```

`icon` 使用 [Font Awesome 6](https://fontawesome.com/search?o=r&m=free) 的类名。

### Giscus 评论

1. 在一个**公开**仓库（可以就是博客仓库）的 Settings → General → Features 中开启 **Discussions**。
2. 安装 [giscus app](https://github.com/apps/giscus) 并授权该仓库。
3. 打开 <https://giscus.app/zh-CN>，填写仓库，选择 Discussion 分类（推荐 Announcements），页面下方会生成配置。
4. 把生成的 `data-repo`、`data-repo-id`、`data-category`、`data-category-id` 填到后台 **站点设置 → Giscus 评论**，并勾选启用。

| 字段 | 说明 |
| --- | --- |
| `enable` | 是否启用 |
| `repo` | `用户名/仓库名` |
| `repoId` / `category` / `categoryId` | 从 giscus.app 获取 |
| `mapping` | 文章与 Discussion 的映射方式，推荐 `pathname` |
| `inputPosition` | 输入框位置 `top` / `bottom` |
| `lang` | 界面语言，如 `zh-CN` |

### 其他

| 字段 | 说明 |
| --- | --- |
| `license` / `licenseUrl` | 文章底部版权卡片中的许可协议 |
| `footerHtml` | 页脚自定义 HTML |
| `headHtml` | 注入到 `<head>` 的 HTML，例如统计代码（重新构建后生效） |
| `busuanzi` | 是否启用不蒜子访问统计 |
| `gitHubCDN` | GitHub 图片使用的 jsDelivr 域名，如 `cdn.jsdelivr.net`、`gcore.jsdelivr.net`、`fastly.jsdelivr.net` |
| `actionUrl` | 部署钩子地址，后台保存后自动请求 |

## 文章 front matter

见 [README → 文章格式](../README.md#文章格式)。

## 静态资源

`public/` 目录下的文件会原样复制到站点根目录。例如放入 `public/images/me.png`，即可在设置中把头像填为 `images/me.png`。

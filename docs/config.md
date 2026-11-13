# 配置说明

后台登录密码通过“登录密码管理”单独生成并提交 `data/auth.json`，不保存在 `data/settings.json` 中；文件只存加密 Token。登录会话使用 `sessionStorage`，详见 [后台认证](authentication.md)。

## 外观与站点功能

以下字段位于 `data/settings.json`，在后台“站点设置”中编辑。正式站点重新构建后生效；本地演示的主题、布局及页脚可即时预览，RSS 和 manifest 仍以构建文件为准。

| 字段 | 行为与默认值 |
| --- | --- |
| `appearance` | `system`（默认，跟随系统）、`light`、`dark`、`auto`（按时段） |
| `darkStart` / `darkEnd` | 0–23 整数小时，默认 22 / 7；开始包含，结束不包含；支持跨午夜，同起止表示全天浅色。按访客浏览器本地时间判断 |
| `sidebarReverse` | 兼容旧配置，默认 false；仅作为未设置模块位置时的默认方向，新配置使用 sidebarPositions |
| `sidebarPositions` | 桌面模块选择 left / right / hidden；支持 profile、announcement、stats、latestPosts、moments、blogInfo、contact、categories、tags、toc。左右都有可见模块时显示三栏，全部隐藏时文章居中并保持常规阅读宽度；手机沿用模块开关和原顺序单列 |
| `sidebarMoments` | 默认 true，侧栏显示最新发布的一条碎碎念和时间；“查看碎碎念”进入时间线。关闭后手机和桌面都不显示 |
| `sidebarBlogInfo` | 缺省 false，博客信息模块开关；关闭后手机和桌面都不显示。旧设置文件不会继承已部署的新模块开关 |
| `beiAn` / `beiAnLink` | ICP 备案号及 HTTP(S) 查询链接；未填不显示，链接默认工信部查询网站 |
| `beiAnGongan` | 公安备案文字；提取其中的备案数字生成官方查询链接，无数字时链接到查询首页 |
| `rssEnable` | 默认 true；关闭后构建不输出 rss.xml，HTML 订阅头及侧栏本站 RSS 链接也隐藏 |
| `rssFullContent` | 默认 true；false 时普通文章只输出公开摘要。加密文章在任何模式下均不输出私密正文 |
| `pwaEnable` | 默认 true，保留原有 manifest 功能；关闭后不输出 manifest 或受控的安装相关头标签 |
| `pwaName` / `pwaShortName` | 名称可留空，回退到站点标题；简称可留空，回退到安装名称 |
| `pwaIcon` | 可选 Apple touch 图标，HTTPS 或站内路径；与安装图标分开 |
| `pwaIcon192` / `pwaIcon512` | 安装 PNG 相对路径，文件位于 public/，默认 icons/icon-192x192.png / icons/icon-512x512.png；构建校验尺寸 |
| `pwaIcon192Maskable` / `pwaIcon512Maskable` | 可选 Maskable PNG，相同路径和尺寸要求；图案需自行留足安全区 |
| `pwaThemeColor` / `pwaBackgroundColor` | 六位 HEX，默认 #b8a320 / #ffffff |

访客手动深浅色选择优先；顶栏“恢复站点默认外观”清除这个偏好，恢复系统或定时判断。系统变化、页面唤醒和最长 30 秒轮询更新自动模式；存储被禁用时仍能使用当前页面主题。

PWA 支持安装参数配置，不提供 Service Worker 或离线缓存；安装按钮是否显示由浏览器决定。安装图标只支持本地 PNG，不在构建时下载远程图标。`baseHref` 会写入 manifest 的 scope、start_url 和安装图标 URL。`headHtml` 中手写的其他标签仍由管理员自行管理。

## blog.config.yaml

构建时读取，修改后需要重新构建（提交到仓库即可自动构建）。

`pnpm run build` 将 `blog.config.yaml` 解析为 `src/generated/config.json` 并打包给前端，后台根据解析出的仓库地址和分支调用 Git API。浏览器不会实时读取 YAML；修改配置后需要重新构建、部署，再登录后台。仓库和分支默认使用 `auto`，跟随部署来源。

`auto` 优先使用 GitHub Actions 的仓库信息，其次是 Netlify `REPOSITORY_URL`、Vercel GitHub 仓库信息、GitLab CI 的项目 URL，最后读取 Git `origin`。自动识别支持 github.com、gitee.com、gitlab.com，远程 URL 中的凭据不会写入公开配置。自托管 GitLab或特殊命名空间请填写完整 URL，必要时附加 `projectId`。显式 URL 始终优先；不能含登录凭据，查询参数只支持 `branch` 和 `projectId`。

没有来源时构建会停止并提示初始化。`pnpm run setup` 接受 `auto` 或完整 URL；保留 auto 可让后续 Fork 继续自动识别。输入结束会取消初始化，当前文件不会被写入。

| 字段 | 说明 | 示例 |
| --- | --- | --- |
| `gitRepoUrl` | 默认 `auto`，跟随当前 Fork；也可指定完整 GitHub / Gitee / GitLab URL，GitLab 可附加 `?projectId=123` | `auto` |
| `branch` | 默认 `auto`，跟随托管平台选定的部署分支或当前本地分支；一般使用仓库主分支（通常为 `main`），也可自行指定其他有效分支 | `auto` |
| `imageRepoUrl` | 默认 `auto`，跟随源码仓库的 `images` 分支；独立仓库可填 URL，`?branch=` 指定分支。显式留空保留原 `image` 分支回退 | `auto` |
| `siteUrl` | 站点域名，只填协议 + 域名，不要带子路径和结尾 `/`。用于 sitemap、RSS、canonical、版权链接。留空时会自动从托管平台环境变量识别 | `https://blog.alice.dev` |
| `baseHref` | 站点部署的子路径。GitHub Pages 项目页为 `/<仓库名>/`（GitHub Actions 会自动设置），其他情况保持 `/` | `/` |

### 环境变量

自动分支优先读取 `CF_PAGES_BRANCH`，再依次读取 GitHub 普通分支引用、Netlify `BRANCH`、Vercel `VERCEL_GIT_COMMIT_REF`、GitLab `CI_COMMIT_BRANCH` 和当前本地 Git 分支。标签和 GitHub PR 合并引用不自动作为写入分支；没有来源会停止构建，请显式配置 branch。仓库 URL 中的 `?branch=` 仍可指定实际 Git API 目标，页面会显示该目标分支。

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

### 博客信息

在后台 **站点设置 → 博客信息** 配置，使用现有主题卡片显示文章数目、评论数目、运行天数和最后活动。通过 `sidebarPositions.blogInfo` 选择桌面左侧、右侧或隐藏；手机使用 `sidebarBlogInfo` 开关和原有单列顺序。

| 字段 | 说明 |
| --- | --- |
| `sidebarBlogInfo` | 模块开关，缺省 false，兼容旧配置 |
| `blogStartDate` | 运行起始日期，格式 `YYYY-MM-DD`，独立于版权年份 `since`；留空显示“未配置”，未来日期显示“尚未开始” |
| `blogCommentCount` | 已核实的本站公开评论（含回复）手动快照，只接受非负安全整数；`null` 或未填写表示未配置，`0` 表示已核实没有评论 |
| `blogCommentCountDate` | 快照核实日期，格式 `YYYY-MM-DD`；与评论总数同时填写或同时留空 |

文章数与公开列表使用相同口径，包含公开加密文章，排除草稿和隐藏文章。最后活动取公开文章和碎碎念的发布时间、更新时间中的最新已发生时间；内容日期格式异常或碎碎念数据无法读取时显示“不可用”，空站点显示“暂无活动”。带时区 ISO 时间转换为访客本地时间，无时区的文章日期时间按访客本地时间解释。日期显示精确到日，悬停可查看完整时间。

运行天数按访客本地日历日期相减，起始当天为 0 天，不受夏令时的 23/25 小时影响。页面打开时每分钟检查日期，标签页唤醒时立即更新。

现有 Giscus 集成只加载单篇文章评论，没有全站汇总数据；本模块不请求 Git API 或使用前台 Token。未填快照时明确显示“未配置”；填写后标注手动快照及核实日期，不随新增评论自动变化。请核实本站对应的公开评论（含回复）后更新快照，重新构建部署即可生效。

### 今日一言

主页文章列表上方显示每日文字卡片。在后台 **站点设置 → 每日一言 / 每日文字** 修改，支持多个文字来源和自定义文字。图片不参与获取或展示。

| 字段 | 说明 |
| --- | --- |
| `hitokotoEnable` | 是否启用每日文字，默认开启；关闭后不显示卡片、不请求接口 |
| `hitokotoShowTitle` | 是否显示卡片标题，默认开启；关闭后保留正文和出处 |
| `hitokotoTitle` | 卡片标题，默认“今日一言” |
| `hitokotoSources` | 每行一个来源，最多 5 个；内置名或完整 HTTP(S) 地址 |
| `hitokotoCustomText` | 自定义文字，可独立使用；支持多行与日期变量 |
| `hitokotoShowFrom` | 是否显示作者与出处；单源“正文/出处”覆盖此设置 |
| `hitokotoMaxLength` | 每个来源显示的最大字数，100～4000，默认 1200 |
| `hitokotoApi` | 兼容旧版单一 API 配置；没有 `hitokotoSources` 时沿用，留空默认一言 |

内置来源参考 `daily-push`：`hitokoto`（一言）、`jinrishici`（今日诗词）、`xygeng`（随机句子）、`60s`（每日新闻）、`history`（历史上的今天）。不接入图片源或消息推送功能。

来源写法：

```text
hitokoto
今日诗词 | jinrishici | 出处
随机句子 | xygeng | 正文
我的早报 | https://example.com/today | data.news
https://example.com/quote | data.content
```

地址后的字段路径可省略，程序会优先识别 `hitokoto`、`content`、`text`、`news` 等正文，再查找嵌套内容。支持字符串数组（按行编号）、JSON 字符串和纯文本。明确填写字段路径却取不到内容时会报错，不会擅自显示其他字段。HTML 错误页、图片地址和错误消息不会用作正文。

自定义文字示例：`今天是 {date}，{weekday}，记得记录生活。`。支持 `{date}`、`{time}`、`{weekday}`、`{month}`、`{day}`，以及实际换行或 `\n`。`{time}` 使用访客浏览器当前本地时间（HH:mm）；刷新立即更新，含 `{time}` 的文字在页面打开时自动更新时间，重新唤醒标签页立即校准。自定义文字不再使用按天缓存，接口一言仍独立按天缓存，不因时钟更新重复请求。只用自定义文字时将来源清空。

每位访客按本地日期、接口地址、解析类型和字段路径缓存，各来源独立、并发获取。当天刷新复用，次日更新；页面保持打开时在午夜更新，标签页唤醒时检查日期。修改标题、出处或显示长度会复用正文缓存。失败来源可重试，已成功的来源不会重复请求；禁用 localStorage 时保留页面内存缓存。

外部接口需支持浏览器 CORS，HTTPS 站点使用 HTTPS 接口。公共接口可用性由提供方决定。不要在公开配置中填写私密 API 密钥：纯静态前端无法保密。构建不请求外部接口；本地演示保存后点击“查看博客”即可预览，正式模式保存到 Git 后重新部署生效。

### 主页公告

后台 **站点设置 → 主页公告** 可配置，公告默认显示在侧栏头像卡片下方，可在“桌面侧栏模块位置”中独立选择左侧或右侧。卡片呈极简便签样式；标题和喇叭图标不显示，正文支持 Markdown 并保留换行，关闭按钮位于右上角。隐藏侧栏的页面也不显示公告。缺省配置不启用，不请求任何外部接口。

| 字段 | 说明 |
| --- | --- |
| `announcementEnable` | 是否启用，默认 `false` |
| `announcementTitle` | 兼容保留的标题字段，不在卡片展示；仍参与公告版本判断 |
| `announcementText` | Markdown 正文，支持粗体、斜体、链接、列表、引用、代码、图片和表格，单次换行也保留；原始 HTML 按文字显示 |
| `announcementLink` | 可选“查看详情”链接，允许 HTTP(S) 或站内路径；不允许执行协议、登录凭据、协议相对地址或反斜线 |
| `announcementClosable` | 是否允许访客关闭，默认 `true` |

关闭状态保存在当前站点来源、部署子路径对应的 localStorage 中，刷新和重新访问仍保留。标题、文本或链接任一变化会形成新公告版本并再次展示。禁用公告不删除关闭记录；禁止关闭时不受旧关闭记录影响。不同标签页会同步关闭状态；浏览器禁止存储时仍可在当前页面关闭，但刷新后可能再次展示。

例如，正文填写：

```markdown
**🎉 新博客上线啦！**
*感谢来访，欢迎交流。*

- [阅读最新文章](archive)
- 周末更新
```

Markdown 链接和图片仅允许 HTTP(S) 或站内路径，拒绝执行协议、登录凭据和协议相对地址；危险链接只保留文字。外部链接在新窗口打开并使用 `noopener noreferrer`；站内路径按站点 `baseHref` 解析。渲染结果继续经过 Angular 的默认 HTML 安全过滤，公告标题不会生成文章目录。正式站点保存并部署后生效；本地演示保存后返回主页即可预览。公告由 Angular 渲染，未额外加入无 JavaScript 的预渲染占位内容。

### 自定义 CSS / 外部资源

后台 **站点设置 → 自定义 CSS / 外部资源** 提供 CSS 文本及每行一个的 CSS/JS 地址输入。保存时地址转为 JSON 数组。两开关只控制专用字段，原 `headHtml` 中的手工内容仍独立生效。

| 字段 | 说明 |
| --- | --- |
| `customCssEnable` | 是否注入本区内联 CSS 和外部 CSS，默认 `true`；内容为空时不注入 |
| `customCss` | 原始 CSS 规则，不含 `<style>` 或 `<script>` 标签 |
| `customExternalCss` | 外部 CSS 地址数组，默认 `[]` |
| `customJsEnable` | 是否注入本区外部脚本，默认 `true`；列表为空时不注入 |
| `customExternalJs` | 外部 JS 地址数组，默认 `[]`，按顺序使用 `defer` 加载执行 |

```json
{
  "customCssEnable": true,
  "customCss": ".fuwari-footer { font-size: 14px; }",
  "customExternalCss": ["https://example.com/custom.css"],
  "customJsEnable": true,
  "customExternalJs": ["scripts/custom.js", "https://example.com/widget.js"]
}
```

外部资源必须使用完整 HTTPS 地址，或站内路径；拒绝 HTTP 外部资源、协议相对地址 `//host/...`、`javascript:` / `data:`、登录凭据及控制字符。`scripts/custom.js` 相对 `<base href>`（子路径部署时如 `/blog/scripts/custom.js`），`/scripts/custom.js` 按标准 URL 语义从域名根路径加载。站内资源可放入 `public/`。

构建时将地址规范化、忽略锚点、保留查询参数并去重。同类资源在专用列表与已有 HTML（包括 `headHtml`）重复时只补入缺少的项目；相同内联 CSS 也不重复添加。旧 `headHtml` 内容不会被改写，本来就手写重复的标签应自行清理。自定义样式在生产构建后排到主题样式之后，外部 CSS 在本区内联 CSS 之前。

新外部标签使用 `crossorigin="anonymous"`、`referrerpolicy="no-referrer"`，跨域请求不附带第三方登录凭据或页面来源；外部服务器需返回允许本站来源的 CORS 响应头，否则浏览器会拒绝加载。不会通过代理或关闭浏览器策略绕过 CORS。内联 CSS 防止闭合样式标签并注入脚本，但 CSS 本身仍可引用网络资源，应只配置可信内容。

外部脚本运行在站点页面中，拥有与本站脚本相同的页面权限，跨域属性不能隔离它们；可能读取浏览器中保存的数据（包括后台 Token）。专用资源会进入所有站点 HTML，包括后台；请使用可信资源。关闭本区开关不会删除高级 `headHtml` 中同名资源。

这些设置需要重新构建，`pnpm start` / `pnpm run build` 会读取本地配置；本地演示只保存浏览器副本，不会立刻注入 CSS 或执行新脚本。刷新、切换 Angular 路由不会重复注入；更换配置后重新部署会更新对应资源。

### 社交链接与菜单

```json
"social": [
  { "icon": "fab fa-github", "label": "GitHub", "url": "https://github.com/alice" },
  { "icon": "fas fa-envelope", "label": "Email", "url": "mailto:alice@example.com" },
  { "icon": "fas fa-rss", "label": "RSS", "url": "rss.xml" }
],
"menus": [
  { "name": "友链", "url": "/posts/friends/", "visible": true },
  { "name": "GitHub", "url": "https://github.com/alice", "blank": true },
  {
    "name": "更多",
    "url": "",
    "visible": true,
    "children": [
      { "name": "关于", "url": "/about", "blank": false, "visible": true },
      { "name": "碎碎念", "url": "/moments", "visible": false }
    ]
  }
]
```

`icon` 使用 [Font Awesome 6](https://fontawesome.com/search?o=r&m=free) 的类名。

在后台“顶部菜单显示”控制 `menuHome`、`menuArchive`、`menuCategories`、`menuTags`、`menuMoments`、`menuAbout`，默认都显示；`menuSearch` 和 `mobileMenu` 控制搜索及手机菜单按钮。所有内置开关在手机和桌面一致生效。

额外菜单的 `visible` 默认 true，`blank` 控制新窗口，`children` 是二级菜单数组。父菜单有链接时保留链接和独立展开按钮；没有链接时必须至少有一个子项。父子项均可隐藏，数据不会被删除；全部子项隐藏且父链接为空时不显示该分组。支持 HTTP(S)、站内路径、mailto 和 tel；保存时校验链接，拒绝凭据、危险协议和非空第三层菜单。站内链接按部署 baseHref 解析。顶栏保持 60px 吸顶，菜单过多时在中间区域横向滚动，手机下拉区域可纵向滚动。

侧栏位置示例：`"sidebarPositions": { "profile": "hidden", "announcement": "right", "moments": "left", "toc": "right" }`。`hidden` 只隐藏桌面上的对应模块，手机仍由原有模块开关控制。未指定模块沿用旧 `sidebarReverse`。关闭的模块和首页尚无目录时不占用空栏；桌面没有可见侧栏时保持原双栏文章宽度并居中，文章的“全宽阅读”选项仍可使用完整宽度。

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
| `gitHubCDN` | GitHub 图片使用的 jsDelivr 域名，如 `cdn.jsdelivr.net`、`gcore.jsdelivr.net`、`fastly.jsdelivr.net` |
| `actionUrl` | 部署钩子地址，后台保存后自动请求 |

## 文章 front matter

见 [README → 文章格式](../README.md#文章格式)。

## 静态资源

`public/` 目录下的文件会原样复制到站点根目录。例如放入 `public/images/me.png`，即可在设置中把头像填为 `images/me.png`。

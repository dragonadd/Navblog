# blog.config.js 功能移植评估

> 落地状态更新（2026-11-10）：文章加密、侧栏公告、自定义资源和每日文字已完成。现已补齐默认/定时深浅色、备案字段、RSS 开关/摘要模式、侧栏反转、PWA 名称/颜色/本地安装图标参数。详见 config.md 与 post-encryption.md。下文保留原评估记录，不能将其中“尚未实现”视作当前状态。远程安装图标、离线缓存、多语言、多主题与第三方服务接入仍未实施；19 份 conf 分配置仍缺失。

评估日期：2026-11-10（Asia/Shanghai）。目标项目：`D:\deepseek-work\nav1-main`。

结论：大部分展示、样式和构建产物配置可以在当前 Angular + Tailwind 纯静态架构内实现。评论、统计、搜索托管等服务可以接入外部平台；需要保密的 AI 调用、用户鉴权、Notion 实时缓存刷新则需要构建任务或外部服务。文章密码加密可以保持纯静态，但必须把所有公开产物中的受保护正文改为密文。

本报告仅评估任务 2，尚未移植这些功能。任务 3、任务 4 不在本次范围内。

## 1. 阅读范围与当前架构

已阅读源配置 `D:\deepseek-work\blog.config.js`，以及目标项目的设置类型、后台设置与文章保存逻辑、Markdown 解析、路由、主题、评论、页脚、构建和静态页面生成脚本。

源文件是 NotionNext 配置：使用 CommonJS 的 `require` / `module.exports` 和构建平台环境变量，并依赖 Notion 数据、原主题组件及部分服务端能力。当前项目使用 ESM、Angular、Git 中的 Markdown 文件和 JSON/YAML 配置，不能直接导入该文件获得对应功能。

当前数据链路：

1. `data/settings.json` 保存展示设置，`blog.config.yaml` 保存仓库、部署地址和子路径。
2. Angular 后台直接调用 GitHub / Gitee / GitLab API 提交设置、文章及图片；它是浏览器管理界面，没有自建后台服务器。
3. `scripts/prepare.ts` 生成文章索引、打包设置和首页模板；`ng build` 编译；`scripts/postbuild.ts` 生成文章静态 HTML、RSS、sitemap、robots 和托管回退规则。
4. 浏览器加载打包设置，再读取公开的 `content/posts/*.md` 渲染文章。评论由 Giscus 提供。
5. 正式站点保存设置后，需要重新构建部署；本地演示则保存到浏览器存储并可即时预览。

源文件引用了 19 份 `./conf/*` 配置，但它所在的 `D:\deepseek-work\conf` 目录未提供。**文章加密、公告栏的具体配置键与默认值并未在这份主文件中出现**；以下针对这两个功能的结论是架构评估，不能视为已经核对了原分配置或原实现。其他分配置也按模块用途评估，不杜撰具体键名。

## 2. 主文件中明确出现的配置

“可直接实现”表示无需运行服务器，不表示当前已经有全部开关；“已有”只用于源码中已经核实的能力。

| 原配置 | 当前状态与迁移方案 | 可行性 / 依赖 |
| --- | --- | --- |
| `AUTHOR`、`BIO`、`KEYWORDS`、`BLOG_FAVICON`、`SINCE` | 已有 `author`、`subtitle`、`keywords`、`favicon`、`since`。`BIO` 可映射签名；如需独立简介可另增字段 | 可直接映射 |
| `LINK` | 映射 `blog.config.yaml.siteUrl`；子路径由 `baseHref` 单独管理，影响 canonical、RSS、sitemap | 可直接映射 |
| `THEME` | 当前是单一 Fuwari 风格 Angular 主题，没有 NotionNext 的多主题引擎 | 多主题要另写 Angular 布局；本次保持现有主题，后续主题同步另行处理 |
| `LANG` | 模板、日期和 RSS 目前主要固定中文 | 默认语言可新增；完整多语言需翻译文案、路由和 SEO，不能只改一个键 |
| `APPEARANCE`、`APPEARANCE_DARK_TIME` | 已有手动深浅色、跟随系统与访客偏好保存；缺少站点默认 light/dark/auto 和定时切换设置 | 可直接扩展；需定义访客选择优先级和跨午夜时间段 |
| `CUSTOM_EXTERNAL_CSS`、`CUSTOM_EXTERNAL_JS` | 已有后台 `headHtml`，构建时可注入 `<style>`、`<link>`、`<script>`；尚无专门的 CSS 文本或 URL 列表控件 | 可直接实现；远程资源依赖提供方 |
| `CUSTOM_MENU` | 已有 `menus` 自定义导航，名称、链接、新窗口开关 | 展示能力已有；Notion Menu 类型的数据读取需另写适配 |
| `CAN_COPY` | 默认允许复制，已有代码复制按钮；无全局或逐文章禁复制开关 | 可实现交互限制，但无法防止下载源文件或浏览器取文；不等于内容保护 |
| `LAYOUT_SIDEBAR_REVERSE` | 当前大屏左侧栏、小屏正文优先 | 可用 Angular 条件与 Tailwind/CSS 调整；原主题白名单不适用于目标项目 |
| `GREETING_WORDS`、`GREETING_WORDS_TYPE_SPEED`、`GREETING_WORDS_BACK_SPEED` | 无欢迎语打字动画；可为横幅或签名新增 Angular 组件 | 可直接实现；考虑关闭动画和减少动态效果偏好 |
| `BEI_AN`、`BEI_AN_LINK`、`BEI_AN_GONGAN` | 页脚 `footerHtml` 已可放备案链接；无独立字段 | 可直接新增专门字段；已有 HTML 能覆盖基本展示 |
| `ENABLE_RSS`、`RSS_FULL_CONTENT` | 当前构建固定生成最近 20 篇全文 RSS，并注入订阅入口 | 可增加开关与全文/摘要选项；关闭时同时处理输出文件和入口 |
| `PSEUDO_STATIC` | 当前使用 `/posts/<slug>/` 路由和目录 `index.html` | 可实现 `.html` 路由，但需同步路由、链接、输出文件、canonical、RSS、sitemap 和托管规则；旧地址跳转需保留兼容 |
| `UUID_REDIRECT` | 当前只用 slug，没有 Notion UUID 映射 | 有旧 URL / UUID → slug 对照后可做静态跳转页或托管重定向；没有映射不能自动还原 |
| `INNER_PAGE_URL_PARENT_PATH` | 当前 Markdown 不具备 Notion 内嵌子页面数据结构 | 如需要可另建父子文章模型与路由；需内容适配，无法直接映射 |
| `API_BASE_URL`、`NOTION_PAGE_ID` | 当前从 Git 文件读取内容，不请求 Notion；原字段还含按语言选择的页面 ID | 可写构建时 Notion 导入器；可能需要访问凭据、数据转换、网络与重新部署。不建议把私密凭据放进前端 |
| `NEXT_REVALIDATE_SECOND` | Next.js ISR 服务端缓存刷新参数，当前没有 ISR | 不能原样移植；可用 CI 定时导入/构建。前端定时拉数据不能同时更新静态 HTML 与 RSS |
| `REVALIDATION_TOKEN` | 原 `/api/revalidate` 的服务端校验密钥 | 不能作为前端公开配置移植；当前发布可用 Git 自动部署或现有 `actionUrl`。如需安全 webhook，使用托管平台/外部服务保管密钥 |

### PWA 配置单独评估

当前 `public/manifest.webmanifest` 已有名称、主题色、背景色及 192/512 PNG 图标，HTML 也已引用 manifest；未找到 Service Worker 注册或离线缓存实现。已有 manifest 不代表已有完整离线 PWA。

| 原配置 | 实现方式 | 可行性 |
| --- | --- | --- |
| `PWA_ENABLE` | 控制 manifest / 安装入口；若增加 Service Worker，关闭时还要正确注销和更新缓存 | 纯静态可实现 |
| `PWA_NAME`、`PWA_SHORT_NAME` | 构建时生成 manifest，不再固定为 NavBlog | 可直接实现 |
| `PWA_ICON` | 设置 apple-touch-icon 等页面图标；与安装图标分开 | 可直接实现 |
| `PWA_ICON_192`、`PWA_ICON_512` | 配置有效尺寸的 PNG 安装图标，可后台上传 | 可直接实现，需检查资源尺寸 |
| `PWA_ICON_192_MASKABLE`、`PWA_ICON_512_MASKABLE` | manifest 新增 `purpose: maskable` 图标 | 可直接实现，需准备留足安全区的图标 |
| `PWA_THEME_COLOR`、`PWA_BACKGROUND_COLOR` | 构建时输出 manifest 和相应页面元信息 | 可直接实现 |
| 离线阅读（扩展能力） | 可使用 Angular 官方 Service Worker，配置资源范围、更新提示与后台/API 缓存排除 | 无需业务服务器；需要 HTTPS、额外构建配置及缓存更新设计 |

## 3. 三个重点功能

### 3.1 文章加密：纯静态可做，工作量较大

推荐使用浏览器原生 Web Crypto：PBKDF2 派生密钥、AES-GCM 加密正文，保存随机 salt、IV、算法版本和密文。CryptoJS 也是可选库，但它并非外部后台服务，也不是实现加密的必要依赖；不能仅用 Base64 或前端隐藏正文。

建议链路：后台编辑器输入密码 → 在浏览器中加密 → 向 Git 提交密文 → 构建生成锁定文章占位页 → 访客输入密码后在浏览器解密并渲染 Markdown。密码与派生密钥不写入公开设置或静态包。修改文章时先解密，保存时重新加密。

当前必须同步改动的公开出口：

| 出口 | 当前行为 | 加密后要求 |
| --- | --- | --- |
| `data/posts/<slug>.md` 与 Git 历史 | 保存明文文章 | 受保护正文提交前加密；公开仓库的旧明文历史仍可能被访问，不能宣称旧内容已被隐藏 |
| `dist/browser/content/posts/*.md` | Angular assets 原样复制 | 仅发布密文，避免旁路下载明文 |
| `postbuild.ts` 文章 HTML | 预渲染全文 | 只生成公开元信息、锁定提示，不生成受保护正文 |
| 文章索引与摘要 | `normalizeMeta` 可从正文自动截摘要 | 加密文章只用作者明确提供的公开摘要，或显示“加密文章”；不从受保护正文提取 |
| `rss.xml` | 发布文章全文 | 跳过受保护正文，仅输出公开摘要/链接，或排除文章 |
| SEO 与搜索数据 | 描述、JSON-LD 和现有搜索可使用摘要；未来全文搜索可能索引正文 | 仅保留允许公开的元信息；加密正文不进入搜索索引与静态描述 |
| 图片、附件与评论 | 往往通过独立公开 URL / 外部服务提供 | 正文加密不保护公开图床或评论；需要保护的附件另行加密或走鉴权服务 |

这是共享密码下的静态密文阅读方案。访客可以下载密文进行离线猜测，强密码很关键；密码泄露后只能重新加密并发布。若目标是会员权限、收费内容、逐用户授权、撤销访问或限制密码尝试，需要外部鉴权和受控内容服务。无法只靠公开静态文件保证这些能力。

最低验收：错误密码不显示正文；正确密码解密；编辑后仍为密文；公开源文件、构建输出、RSS、摘要与搜索数据均找不到测试正文；密码与密钥不进入 Git、日志或前端包；普通文章流程继续正常。

### 3.2 自定义 CSS / 外部脚本：现有架构即可支持

现在已经可以在后台 **站点设置 → 版权与高级 → 注入 head 的 HTML** 中填写：

```html
<style>
  .fuwari-footer { font-size: 14px; }
</style>
<link rel="stylesheet" href="https://example.com/custom.css">
<script defer src="https://example.com/custom.js"></script>
```

保存提交到 Git，重新部署后，`prepare.ts` 注入 HTML 模板，静态文章页继承这些内容。这里的“后台注入”是现有 Angular 管理界面配置构建产物，不需要 PHP 或新增业务服务器。

确认后建议提供独立的“自定义 CSS”文本框、外部 CSS/JS URL 列表及开关，以减少手写标签错误；沿用现有字段时要避免重复注入，并明确外部 JS 加载顺序和 `defer`。外部脚本运行在站点上下文，应只配置可信来源；正式设置页已经支持 Git Token 操作，不能把未知第三方脚本视为隔离组件。

最低验收：后台保存后构建生效；首页、文章页、直接刷新均有样式；禁用或删除后不再注入；相对路径适配 `baseHref`；不重复加载同一资源。纯本地演示的 `headHtml` 目前不会即时重新构建模板，预览行为要单独说明或设计。

### 3.3 公告栏：无需外部服务

主文件没有公告栏具体键；可在当前项目新增一个 Angular 公告组件，通过 `data/settings.json` 配置启用、标题、文本、链接、显示范围，以及可选的关闭按钮。

简单公告直接使用文本绑定；如要 Markdown，可复用解析器并约束允许的 HTML。公告独立配置，不与每日一言混用。若允许访客关闭，可按公告 ID / 内容版本记录 localStorage，发布新公告后重新展示。

可在首页文章列表上方、站点顶部或侧栏显示，位置等确认后确定。后台保存并重新部署即可，不需要数据库。只有要求公告实时推送、不部署立即全站更新或多人集中管理时，才需要外部内容 API。

最低验收：开关有效；正文和链接显示正确；新公告版本再次展示；无 localStorage 权限时仍可阅读；小屏不遮挡导航；构建出的非 JS 页面是否也展示公告应明确决定。

## 4. 主文件引用的分配置模块

以下 19 个模块都缺少实际文件，不能确认全部配置项与取值。若要精确逐项对照，需要读取原项目对应分配置；当前可先按功能类别选择范围。

| 引用模块 | 架构可行性与现有基础 |
| --- | --- |
| `comment.config` | Giscus 已有；其他托管评论可以接入。自托管评论需外部部署服务 |
| `contact.config` | 社交链接已有，可映射平台、图标和链接 |
| `post.config` | 分类、标签、置顶、封面、分页、摘要、字数、目录、逐文章评论已有；文章加密需要第 3.1 节的完整链路 |
| `analytics.config` | 不蒜子已有，统计脚本可注入；数据收集与报表由外部统计平台提供 |
| `image.config` | Git 图床、可选 CDN、图片懒加载已有；本地缩放和压缩可放在构建阶段，实时图片代理/鉴权需要外部服务 |
| `font.config` | 本地或远程字体、字号等样式可直接实现；远程字体依赖其托管方 |
| `right-click-menu` | 自定义右键菜单可用 Angular 实现；限制复制只影响交互 |
| `code.config` | highlight.js、代码语言标题和复制已有，可扩展样式；其他语法能力需核对原配置 |
| `animation.config` | CSS/Angular 动效可实现，控制性能及减少动态效果偏好 |
| `widget.config` | 客服、宠物、播放器等需看原组件；本地挂件可改写 Angular，托管客服/音乐 API 等依赖外部服务、跨域与浏览器自动播放规则 |
| `ad.config` | 可挂广告平台提供的脚本/组件；账号、平台审核和投放由第三方负责 |
| `plugin.config` | Algolia 等托管搜索可接入；也可构建本地公开全文索引。当前搜索只覆盖标题、摘要、分类和标签，未提供全文索引 |
| `ai.config` | AI 摘要可在构建阶段生成并保存，密钥留在 CI；浏览器实时 AI 聊天一般需要服务代理、用量限制和密钥保管 |
| `performance.config` | 静态资源压缩、缓存头、懒加载、预加载可适配；Next 服务端缓存配置不能直接复用 |
| `top-tag.config` | 当前逐文章 `pinned` 与置顶排序已有；按标签全局置顶可在数据排序阶段扩展 |
| `layout-map.config` | 通过 Angular 路由与布局组件实现对应能力；原主题组件和 Next 路由代码不能原样搬入 |
| `notion.config` | 仅在选择接入 Notion 后需要；建议构建时导入 Markdown/元数据，保留当前发布链路 |
| `dev.config` | 原框架开发参数需逐项判断；Angular 的编译、路由和调试配置另行对应 |
| `techgrow.config` | 公众号导流展示可接插件；如需“关注后验证并解锁”则要平台验证服务，且与正文加密/受控分发一起设计 |

## 5. 配置移植的共同约束

- 新增功能仍使用 Angular、TypeScript、Tailwind/CSS 与静态构建脚本；不引入 Vue、React 或 PHP。
- 公开展示设置进入 `data/settings.json` 和 `BlogSettings`，提供后台输入与明确默认值；仓库/路径信息继续使用 `blog.config.yaml`。
- 环境变量统一解析类型。源文件多处写 `process.env.X || true`，环境变量字符串 `"false"` 会被当作真值；复制这个写法会让开关失效。布尔、数字、时间数组和 URL 列表需分别解析。
- 缺少字段时使用默认值，明确的 `false` 要保留。旧版一言配置现已采用此原则。
- 密钥仅留在管理员输入、CI secret 或外部服务；不得随公开设置进入浏览器包。可供公开读取的搜索查询凭据应与有写权限的密钥区分。
- 修改路由、RSS、预渲染或加密时，同步检查所有构建产物，确保首页、直接刷新、子路径部署和 SEO 入口一致。

## 6. 建议落地顺序（待确认）

| 顺序 | 功能 | 原因 |
| --- | --- | --- |
| 1 | 公告栏 + 专用自定义 CSS / 外部资源配置 | 直接满足重点需求，沿用现有后台和静态构建，改动范围清晰 |
| 2 | 默认深浅色 / 定时切换、备案字段、RSS 开关与摘要模式、侧栏反转 | 主要是现有能力的配置化 |
| 3 | PWA 参数配置；需要时再做离线缓存 | manifest 基础已有，离线缓存另做一轮更新与存储设计 |
| 4 | 文章密码加密 | 必须先明确保护范围，再改保存、构建、RSS、摘要和阅读链路 |
| 5 | 外部评论 / 搜索 / AI / Notion 导入 | 根据实际需求和服务选择分别接入，避免引入不使用的依赖 |

`.html` URL、多语言和多主题属于范围较大的兼容改造，建议有明确需求时再排期。用户确认本报告和首批范围后，再逐一实现；当前不自动改动任务 2 的功能配置。

## 7. 任务 1 收尾核查

旧会话改动仍在，相关源码已经读取核对：

| 文件 | 确认结果 |
| --- | --- |
| `data/settings.json` | `hitokotoEnable`、`hitokotoShowTitle` 默认均为 `true` |
| `src/shared/types.ts` | 两个可选布尔字段已定义，兼容旧设置 |
| `src/app/admin/settings.page.ts` | 后台两开关、隐藏标题时禁用标题输入、`??=` 保留明确 false、总开关关闭时跳过来源校验、保存均已实现 |
| `src/app/components/hitokoto.component.ts` | 标题条件显示；关闭总开关不渲染卡片，不启动内容加载、午夜定时器或可见性刷新 |
| `src/app/services/hitokoto.service.ts` | `getDaily` 在解析来源、读缓存、生成文字或发请求之前检查总开关，关闭直接返回空结果 |
| `src/app/pages/home.page.ts` | 每日文字组件已置于主页文章列表之前 |
| `docs/config.md` | 两个开关、旧 API 兼容、多源和每日缓存行为已有说明 |

无需补写两个开关的业务逻辑；本轮新增三个有针对性的回归用例，验证关闭时跳过无效来源和缓存、隐藏标题时保留内容，以及保存刷新后两个 false 值仍保留。

生产构建 `pnpm run build` 已通过，包括数据准备、Angular 生产编译和静态页面生成；初始包约 446.62 kB。首次在受限沙箱中运行时，tsx 因 Node 的 `uv_os_get_passwd` 返回 ENOMEM 而无法启动；相同命令在获准的沙箱外执行后正常完成。

自动回归验证 `node --import tsx --test scripts/test-hitokoto.ts scripts/test-daily-text.ts scripts/test-local-demo.ts` 共 **30 项全部通过**，包括本轮新增的三个开关用例。`git diff --check` 已通过。

使用已安装的 Edge 无界面浏览器，对生产构建产物进行了独立本地演示验证，**6 项全部通过，页面运行时错误为 0**：

1. 后台隐藏标题后，首页保留正文、作者与出处，不输出标题节点。
2. 关闭总开关后，无效来源也能保存，不影响关闭功能。
3. 返回首页与刷新后都不输出卡片，不新增接口请求。
4. 重新进入设置后，两个开关的 `false` 均保留。
5. 重新启用并显示标题后恢复自定义标题，当天正文复用缓存；整个启用/关闭/再启用流程的测试 API 只请求 1 次。
6. 在无旧缓存的全新浏览器上下文中首次打开已禁用的站点，卡片不存在，测试 API 请求数为 0。

浏览器测试使用模拟文字响应，避免真实公共接口波动；未访问 Git API、部署钩子或真实一言接口。实际公共接口仍需允许站点 CORS。临时验证脚本及截图位于已被 Git 忽略的 `tmp/` 目录，未引入测试框架或业务依赖。

任务 1（含标题开关、功能总开关）收尾完成。任务 2 当前只产出了本评估报告，等待确认落地范围。

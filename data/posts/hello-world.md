---
title: "你好，NavBlog"
date: "2026-11-08 20:00"
category: "随笔"
tags: ["NavBlog", "开始"]
summary: "博客搭好啦！这是一篇示例文章，介绍 NavBlog 是怎么工作的，以及接下来你可以做什么。"
pinned: true
---

欢迎来到你的新博客 🎉 这是一篇**示例文章**，你可以在后台把它删除或修改。

NavBlog 由 [nav 导航](https://github.com/xjh22222228/nav) 改造而来，保留了它最棒的特性：**纯静态部署，却能在线进入后台编辑**。

## 它是怎么工作的

1. 每篇文章都是仓库 `data/posts/` 目录下的一个 Markdown 文件；
2. 访问 `/admin`，用 GitHub / Gitee / GitLab 的 Access Token 登录；
3. 在后台写完文章点击保存，后台会通过 Git 平台 API 把文章提交回仓库；
4. 托管平台（GitHub Pages / Netlify / Vercel / Cloudflare Pages）检测到提交后自动重新构建，一两分钟后新文章就上线了。

## 接下来做什么

- [ ] 进入后台 → **站点设置**，修改标题、头像、横幅图、社交链接
- [ ] 进入后台 → **关于页**，写一段自我介绍
- [ ] 配置 Giscus 评论（可选）
- [ ] 删除这篇示例文章，写下你的第一篇博客

## 构建时生成静态页面

构建时会为每篇文章生成独立的 HTML 文件，包含标题、描述、Open Graph 信息和文章正文，对搜索引擎友好。同时还会生成 `sitemap.xml` 和 `rss.xml`。

### 代码高亮

```ts
function hello(name: string): string {
  return `Hello, ${name}!`
}

console.log(hello('NavBlog'))
```

### 表格

| 功能 | 状态 |
| ---- | ---- |
| 文章 / 归档 / 分类 / 标签 / 搜索 | ✅ |
| 在线后台写作 + 图片上传 | ✅ |
| Giscus 评论 | ✅ |
| 色相调色盘 / 深色模式 | ✅ |

> 玫瑰会有花期，爱你不分朝夕。

# 碎碎念 / 时光机

前台 `/moments` 是头像、日期与短文本卡片组成的时间线，借鉴 Handsome `cross.php` / `component/say.php` 的展示结构，全部以 Angular / TypeScript 重写。正文为纯文本，支持换行；不解析 HTML 或 Markdown。最新发布在前。

后台 `/admin/moments` 支持发布、编辑、删除。发布时间用本地日期时间输入，保存为带时区的 ISO 时间。编辑未改发布时间时，保留原来的秒和毫秒。文字最多 5000 个字符。

数据保存在 `data/moments.json`：

```json
[
  {
    "id": "a-stable-id",
    "date": "2026-11-10T08:00:00+08:00",
    "text": "第一行\n第二行",
    "updated": "2026-11-10T09:00:00+08:00"
  }
]
```

后台新增 ID 使用浏览器原生 UUID；`updated` 可省略。文件初始为空数组，不附带示例动态。

保存和删除调用原有 Git API。每次操作先读取最新列表，校验 JSON、文本、时间和重复 ID；格式损坏会停止操作，不用空数组覆盖。写入绑定读取版本；旧编辑窗口发现同一条动态已更新时提示冲突并保留草稿。GitHub/Gitee 使用 SHA 条件写入，GitLab 使用 `last_commit_id`，本地演示使用原内容核验。

本地演示只保存浏览器副本，查看时间线可即时预览，“导出演示数据”包含 `data/moments.json`。正式站点通过 Git 提交并重新构建部署后生效。导出的副本不会自动成为项目数据，仍需同步到项目。

构建会生成 `/moments/index.html` 的非 JS 静态内容，文本被转义且换行保留；sitemap 包含时间线。文章 RSS 和文章搜索保持原范围，不混入动态。

sitemap 的日期当前取最新发布的动态，修改较早动态不会推进这个日期；页面本身仍正常重新构建更新。

本轮未加入图片、点赞、评论、朋友圈 RSS 聚合或多作者。动态都是公开内容，不要填写密码、Token 或其他需要保密的信息。

验证：`scripts/test-moments.ts`、`test-moments-git.ts`、`test-local-demo.ts` 的动态用例，以及 `test-moments-build.ts` 的真实静态构建。

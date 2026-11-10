---
title: Markdown 写作示例
date: 2026-11-07 10:30
updated: 2026-11-10 02:11
category: 教程
tags:
  - Markdown
  - 写作
cover: missing-cover.png
hideSidebar: true
---

这篇文章展示了博客支持的 Markdown 语法，写文章时可以参考。

## 文字样式

**粗体**、*斜体*、~~删除线~~、`行内代码`，以及 [链接](https://github.com)。

## 列表

- 无序列表项
- 另一项
  - 嵌套项

1. 有序列表
2. 第二项

- [x] 已完成任务
- [ ] 未完成任务

## 引用

> 这是一段引用文字。

## 代码块

```python
def fib(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a

print([fib(i) for i in range(10)])
```

```bash
pnpm install
pnpm run build
```

## 图片

![风景](https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80)

## 分隔线

---

以上就是常用语法啦。

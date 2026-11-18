import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { PATHS, readSettings } from './lib'

test('静态首页按5篇或自定义篇数分页，自动加载模式不生成分页', async () => {
  const parent = path.resolve(
    process.env['NAVBLOG_TEST_OUTPUT_DIR'] || os.tmpdir(),
  )
  const root = fs.mkdtempSync(path.join(parent, 'navblog-list-build-'))
  const originalPaths = { ...PATHS }
  const settings = readSettings()
  const template = fs
    .readFileSync(path.join(PATHS.dist, 'index.html'), 'utf8')
    .replace(/<div id="prerender"[\s\S]*?(?=<app-root>)/, '')
  try {
    PATHS.postsDir = path.join(root, 'posts')
    PATHS.settings = path.join(root, 'settings.json')
    PATHS.auth = path.join(root, 'auth.json')
    PATHS.about = path.join(root, 'about.md')
    PATHS.moments = path.join(root, 'moments.json')
    fs.mkdirSync(PATHS.postsDir)
    fs.writeFileSync(PATHS.about, '列表展示测试')
    fs.writeFileSync(PATHS.moments, '[]')
    for (let index = 1; index <= 8; index++) {
      fs.writeFileSync(
        path.join(PATHS.postsDir, `post-${index}.md`),
        `---\ntitle: 文章 ${index}\ndate: '2026-11-16 00:00'\n---\n正文 ${index}\n`,
      )
    }
    for (const [mode, size, counts] of [
      ['page', 5, [5, 3]],
      ['page', 3, [3, 3, 2]],
      ['scroll', 1, [8]],
    ] as const) {
      PATHS.dist = path.join(root, `${mode}-${size}`)
      fs.mkdirSync(PATHS.dist)
      fs.writeFileSync(path.join(PATHS.dist, 'index.html'), template)
      fs.writeFileSync(
        PATHS.settings,
        JSON.stringify({ ...settings, listMode: mode, postsPerPage: size }),
      )
      const module = new URL('./postbuild.ts', import.meta.url)
      module.searchParams.set('test', `${mode}-${size}`)
      await import(module.href)
      const displayed: string[] = []
      for (let page = 1; page <= counts.length; page++) {
        const route = page === 1 ? '' : `page/${page}`
        const html = fs.readFileSync(
          path.join(PATHS.dist, route, 'index.html'),
          'utf8',
        )
        const shell = html.match(/<div id="prerender"[\s\S]*?<app-root>/)?.[0]
        assert.ok(shell)
        const slugs = [...shell.matchAll(/href="posts\/([^"/]+)\/"/g)].map(
          (match) => match[1],
        )
        assert.equal(slugs.length, counts[page - 1])
        displayed.push(...slugs)
      }
      assert.equal(new Set(displayed).size, 8)
      assert.equal(
        fs.existsSync(path.join(PATHS.dist, 'page')),
        mode === 'page',
      )
    }
  } finally {
    Object.assign(PATHS, originalPaths)
    assert.ok(path.resolve(root).startsWith(parent + path.sep))
    fs.rmSync(root, { recursive: true, force: true })
  }
})

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { PATHS, ROOT } from './lib'

const original = fs.existsSync(PATHS.moments)
  ? fs.readFileSync(PATHS.moments, 'utf8')
  : null
const fixture = {
  id: 'static-moment-check',
  date: '2026-11-10T01:00:00Z',
  text: "<script>not-executable</script>\n换行验收 & 文本\n价格 $$5；匹配 $&；后缀 $'",
}
const log = path.join(ROOT, 'tmp', 'moments-build.log')
fs.mkdirSync(path.dirname(log), { recursive: true })
fs.writeFileSync(
  path.join(ROOT, 'tmp', 'moments-before-build.json'),
  original || '[]',
)
async function command(script: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: ROOT,
      windowsHide: true,
    })
    child.stdout.on('data', (data) => fs.appendFileSync(log, data))
    child.stderr.on('data', (data) => fs.appendFileSync(log, data))
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`构建失败，详见 ${log}`)),
    )
  })
}
async function build() {
  await command('node_modules/tsx/dist/cli.mjs', ['scripts/prepare.ts'])
  await command('node_modules/@angular/cli/bin/ng.js', ['build'])
  await command('node_modules/tsx/dist/cli.mjs', ['scripts/postbuild.ts'])
}
try {
  fs.writeFileSync(PATHS.moments, JSON.stringify([fixture]))
  await build()
  const html = fs.readFileSync(
    path.join(PATHS.dist, 'moments', 'index.html'),
    'utf8',
  )
  assert.ok(html.includes('id="prerender"'))
  assert.ok(html.includes('id="moment-static-moment-check"'))
  assert.ok(
    html.includes(
      '&lt;script&gt;not-executable&lt;/script&gt;\n换行验收 &amp; 文本',
    ),
  )
  assert.ok(!html.includes('<script>not-executable</script>'))
  assert.ok(html.includes("价格 $$5；匹配 $&amp;；后缀 $'"))
  assert.equal(
    JSON.parse(
      fs.readFileSync(path.join(PATHS.generated, 'moments.json'), 'utf8'),
    )[0].text,
    fixture.text,
  )
  if (fs.existsSync(path.join(PATHS.dist, 'sitemap.xml')))
    assert.ok(
      fs
        .readFileSync(path.join(PATHS.dist, 'sitemap.xml'), 'utf8')
        .includes('/moments/'),
    )
  console.log(
    '[moments-build] 静态页、文本转义、换行、锚点和 sitemap 检查通过。',
  )
} finally {
  if (original === null) fs.unlinkSync(PATHS.moments)
  else fs.writeFileSync(PATHS.moments, original)
  await build()
  console.log('[moments-build] 验收动态已移除，正式构建已恢复。')
}

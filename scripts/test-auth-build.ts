/** 临时测试密文构建；不使用真实凭证，结束后恢复原 auth 与正式构建。 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { PATHS, ROOT, readConfig } from './lib'
import { authIdentity, encryptAuth, parseAuth } from '../src/shared/auth'
import { parseRepo } from '../src/app/services/git.service'

const original = fs.existsSync(PATHS.auth)
  ? fs.readFileSync(PATHS.auth, 'utf8')
  : null
const token = 'TEST_TOKEN_' + randomUUID(),
  password = 'Test1234!' + randomUUID()
const config = readConfig(),
  identity = authIdentity(parseRepo(config.gitRepoUrl, config.branch))
const log = path.join(ROOT, 'tmp', 'auth-build.log')
fs.mkdirSync(path.dirname(log), { recursive: true })
if (original !== null)
  fs.writeFileSync(path.join(ROOT, 'tmp', 'auth-before-build.json'), original)
async function command(script: string, args: string[], success = true) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: ROOT,
      windowsHide: true,
    })
    child.stdout.on('data', (b) => fs.appendFileSync(log, b))
    child.stderr.on('data', (b) => fs.appendFileSync(log, b))
    child.on('error', reject)
    child.on('exit', (code) =>
      (success ? code === 0 : code !== 0)
        ? resolve()
        : reject(new Error(`认证构建验证失败，请检查 ${log}`)),
    )
  })
}
async function build() {
  await command('node_modules/tsx/dist/cli.mjs', ['scripts/prepare.ts'])
  await command('node_modules/@angular/cli/bin/ng.js', ['build'])
  await command('node_modules/tsx/dist/cli.mjs', ['scripts/postbuild.ts'])
}
function files(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? files(path.join(dir, e.name))
        : [path.join(dir, e.name)],
    )
}
try {
  fs.writeFileSync(PATHS.auth, await encryptAuth(token, password, identity))
  await build()
  const authPath = path.join(PATHS.dist, 'data', 'auth.json')
  assert.equal(
    parseAuth(fs.readFileSync(authPath, 'utf8')).format,
    'navblog-auth',
  )
  for (const file of files(PATHS.dist)) {
    const bytes = fs.readFileSync(file)
    assert.ok(
      !bytes.includes(Buffer.from(token)),
      `Token 泄漏：${path.relative(ROOT, file)}`,
    )
    assert.ok(
      !bytes.includes(Buffer.from(password)),
      `密码泄漏：${path.relative(ROOT, file)}`,
    )
    if (file !== authPath && /\.(json|html|xml)$/.test(file))
      assert.ok(
        !bytes.includes(Buffer.from('navblog-auth')),
        `密文进入非认证数据：${file}`,
      )
  }
  fs.writeFileSync(PATHS.auth, JSON.stringify({ token }))
  await command('node_modules/tsx/dist/cli.mjs', ['scripts/prepare.ts'], false)
  fs.unlinkSync(PATHS.auth)
  await build()
  assert.ok(!fs.existsSync(authPath))
  assert.ok(!fs.existsSync(path.join(PATHS.generated, 'auth', 'auth.json')))
  console.log(
    '[auth-build] 密文专用输出、无Token/密码泄漏、明文拒绝、移除后无残留验证通过。',
  )
} finally {
  if (original === null) {
    if (fs.existsSync(PATHS.auth)) fs.unlinkSync(PATHS.auth)
  } else fs.writeFileSync(PATHS.auth, original)
  await build()
  console.log('[auth-build] 已恢复原认证文件和正式构建。')
}

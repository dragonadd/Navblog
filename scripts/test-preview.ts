import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import net from 'node:net'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { PATHS, ROOT, readConfig } from './lib'

async function startPreview() {
  const reservation = net.createServer()
  await new Promise<void>((resolve) =>
    reservation.listen(0, '127.0.0.1', resolve),
  )
  const port = (reservation.address() as net.AddressInfo).port
  await new Promise<void>((resolve) => reservation.close(() => resolve()))
  const child = spawn(
    process.execPath,
    ['node_modules/tsx/dist/cli.mjs', 'scripts/preview.ts', String(port)],
    {
      cwd: ROOT,
      windowsHide: true,
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('临时预览未启动'))
    }, 8000)
    child.stdout.on('data', (data) => {
      if (String(data).includes('预览地址')) {
        clearTimeout(timer)
        resolve()
      }
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`临时预览提前退出 ${code}`))
    })
  })
  const request = (route: string) =>
    new Promise<{ status: number; text: string } | null>((resolve) => {
      const req = http.get(
        { hostname: '127.0.0.1', port, path: route },
        (res) => {
          let text = ''
          res.on('data', (chunk) => (text += chunk))
          res.on('end', () => resolve({ status: res.statusCode!, text }))
          res.on('error', () => resolve(null))
        },
      )
      req.on('error', () => resolve(null))
      req.setTimeout(3000, () => {
        req.destroy()
        resolve(null)
      })
    })
  const stop = async () => {
    if (child.exitCode === null) {
      const exited = new Promise<void>((resolve) =>
        child.once('exit', () => resolve()),
      )
      child.kill()
      await exited
    }
  }
  return { request, stop }
}

test('非法URI返回400且独立预览进程继续服务', async () => {
  const server = await startPreview(),
    base = readConfig().baseHref
  try {
    assert.equal((await server.request(base + '%E0%A4'))?.status, 400)
    assert.equal((await server.request(base))?.status, 200)
    assert.equal(
      (await server.request(base + 'data/not-found.json'))?.status,
      404,
    )
  } finally {
    await server.stop()
  }
})

test('预览拒绝读取同前缀兄弟目录', async () => {
  const backup = path.join(
    path.dirname(PATHS.dist),
    'browser-backup-' + randomUUID(),
  )
  fs.mkdirSync(backup)
  fs.writeFileSync(path.join(backup, 'private.txt'), 'OUTSIDE_PUBLIC_ROOT')
  const server = await startPreview(),
    base = readConfig().baseHref
  try {
    const response = await server.request(
      base + '%2e%2e/' + path.basename(backup) + '/private.txt',
    )
    assert.equal(response?.status, 403)
    assert.ok(!response?.text.includes('OUTSIDE_PUBLIC_ROOT'))
    assert.equal((await server.request(base))?.status, 200)
  } finally {
    await server.stop()
    assert.ok(
      path
        .resolve(backup)
        .startsWith(
          path.resolve(path.dirname(PATHS.dist)) + path.sep + 'browser-backup-',
        ),
    )
    fs.rmSync(backup, { recursive: true, force: true })
  }
})

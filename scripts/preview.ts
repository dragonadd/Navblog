// 本地预览 dist/browser（模拟静态托管：存在的文件直接返回，目录返回 index.html，否则 SPA 回退）
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { PATHS, readConfig } from './lib'

const { baseHref } = readConfig()
const port = Number(process.env.PORT || process.argv[2] || 4173)
const root = fs.realpathSync(PATHS.dist)
const inside = (file: string) =>
  file === root || file.startsWith(root + path.sep)
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
}

http
  .createServer((req, res) => {
    let url: string
    try {
      url = decodeURIComponent((req.url || '/').split('?')[0])
      if (url.includes('\0')) throw new Error()
    } catch {
      res.writeHead(400)
      res.end('Invalid URL')
      return
    }
    if (!url.startsWith(baseHref)) {
      res.writeHead(302, { Location: baseHref })
      res.end()
      return
    }
    url = url.slice(baseHref.length)
    let file = path.resolve(root, url)
    if (!inside(file)) {
      res.writeHead(403)
      res.end()
      return
    }
    let status = 200
    try {
      if (fs.existsSync(file) && fs.statSync(file).isDirectory())
        file = path.join(file, 'index.html')
      if (!fs.existsSync(file)) {
        file = path.join(root, path.extname(url) ? '404.html' : 'index.html')
        status = path.extname(url) ? 404 : 200
      }
      if (!inside(fs.realpathSync(file))) {
        res.writeHead(403)
        res.end()
        return
      }
      res.writeHead(status, {
        'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      })
      fs.createReadStream(file)
        .on('error', () => {
          if (res.headersSent) res.destroy()
          else {
            res.writeHead(500)
            res.end('Unable to read resource')
          }
        })
        .pipe(res)
    } catch {
      res.writeHead(500)
      res.end('Unable to read resource')
    }
  })
  .listen(port, () =>
    console.log(`预览地址: http://localhost:${port}${baseHref}`),
  )

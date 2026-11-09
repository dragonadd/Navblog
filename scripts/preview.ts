// 本地预览 dist/browser（模拟静态托管：存在的文件直接返回，目录返回 index.html，否则 SPA 回退）
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { PATHS, readConfig } from './lib'

const { baseHref } = readConfig()
const port = Number(process.env.PORT || process.argv[2] || 4173)
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
    let url = decodeURIComponent((req.url || '/').split('?')[0])
    if (!url.startsWith(baseHref)) {
      res.writeHead(302, { Location: baseHref })
      res.end()
      return
    }
    url = url.slice(baseHref.length)
    let file = path.join(PATHS.dist, url)
    if (!file.startsWith(PATHS.dist)) {
      res.writeHead(403)
      res.end()
      return
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html')
    let status = 200
    if (!fs.existsSync(file)) {
      file = path.join(PATHS.dist, path.extname(url) ? '404.html' : 'index.html')
      status = path.extname(url) ? 404 : 200
    }
    res.writeHead(status, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
  .listen(port, () => console.log(`预览地址: http://localhost:${port}${baseHref}`))

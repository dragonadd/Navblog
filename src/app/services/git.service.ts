// Git 平台 API（GitHub / Gitee / GitLab）
// 移植并简化自 https://github.com/xjh22222228/nav src/api/index.ts (GPL-3.0)
import { Injectable, inject, signal } from '@angular/core'
import { Base64 } from 'js-base64'
import { BlogService } from './blog.service'

export type Provider = 'github' | 'gitee' | 'gitlab'

export interface RepoInfo {
  provider: Provider
  host: string
  owner: string
  repo: string
  branch: string
  projectId: string
}

export interface FileChange {
  path: string
  /** 文本内容；null 表示删除 */
  content: string | null
  /** 已经是 base64（图片等二进制） */
  base64?: boolean
}

const TOKEN_KEY = 'token'
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

export function parseRepo(url: string, defaultBranch = 'main'): RepoInfo {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return { provider: 'github', host: 'github.com', owner: '', repo: '', branch: defaultBranch, projectId: '' }
  }
  const host = u.hostname
  const provider: Provider = host.includes('github') ? 'github' : host.includes('gitee') ? 'gitee' : 'gitlab'
  const [owner = '', repo = ''] = u.pathname.replace(/^\/|\.git$|\/$/g, '').split('/')
  return {
    provider,
    host,
    owner,
    repo,
    branch: u.searchParams.get('branch') || defaultBranch,
    projectId: u.searchParams.get('projectId') || '',
  }
}

@Injectable({ providedIn: 'root' })
export class GitService {
  private blog = inject(BlogService)
  readonly repo = parseRepo(this.blog.config.gitRepoUrl, this.blog.config.branch || 'main')
  readonly imageRepo = this.blog.config.imageRepoUrl
    ? parseRepo(this.blog.config.imageRepoUrl, 'image')
    : { ...this.repo, branch: 'image' }
  readonly token = signal<string>(localStorage.getItem(TOKEN_KEY) || '')
  readonly user = signal<{ name: string; avatar: string } | null>(null)
  readonly busy = signal(false)

  get providerName() {
    return { github: 'GitHub', gitee: 'Gitee', gitlab: 'GitLab' }[this.repo.provider]
  }

  get tokenHelpUrl() {
    return {
      github: 'https://github.com/settings/tokens/new?scopes=repo&description=blog-admin',
      gitee: 'https://gitee.com/profile/personal_access_tokens',
      gitlab: `https://${this.repo.host}/-/user_settings/personal_access_tokens`,
    }[this.repo.provider]
  }

  private apiBase(r: RepoInfo = this.repo) {
    if (r.provider === 'github') return 'https://api.github.com'
    if (r.provider === 'gitee') return 'https://gitee.com/api/v5'
    return `https://${r.host}/api/v4`
  }

  private projectPath(r: RepoInfo) {
    return r.projectId || encodeURIComponent(`${r.owner}/${r.repo}`)
  }

  private async request<T = any>(
    method: string,
    path: string,
    body?: unknown,
    r: RepoInfo = this.repo,
    token = this.token(),
  ): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json;charset=utf-8' }
    if (token) headers['Authorization'] = r.provider === 'gitlab' ? `Bearer ${token}` : `token ${token}`
    if (r.provider === 'github') headers['Accept'] = 'application/vnd.github+json'
    const res = await fetch(this.apiBase(r) + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    })
    const text = await res.text()
    let data: any = text
    try {
      data = text ? JSON.parse(text) : null
    } catch {}
    if (!res.ok) {
      const msg = data?.message || data?.error || res.statusText
      const err: any = new Error(`${res.status} ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`)
      err.status = res.status
      throw err
    }
    return data as T
  }

  isLogin() {
    return !!this.token()
  }

  /** 校验 Token，并要求 Token 所属用户就是仓库所有者 */
  async login(token: string) {
    token = token.trim()
    const r = this.repo
    const path = r.provider === 'gitlab' ? '/user' : '/user'
    const data = await this.request('GET', path, undefined, r, token)
    const name = data.login || data.username
    if (r.owner && name && name.toLowerCase() !== r.owner.toLowerCase()) {
      // 组织仓库：检查是否有写权限
      try {
        await this.request('GET', r.provider === 'gitlab' ? `/projects/${this.projectPath(r)}` : `/repos/${r.owner}/${r.repo}`, undefined, r, token)
      } catch {
        throw new Error(`Token 用户 ${name} 无权访问仓库 ${r.owner}/${r.repo}`)
      }
    }
    localStorage.setItem(TOKEN_KEY, token)
    this.token.set(token)
    this.user.set({ name, avatar: data.avatar_url })
  }

  async fetchUser() {
    if (!this.token() || this.user()) return
    try {
      const data = await this.request('GET', '/user')
      this.user.set({ name: data.login || data.username, avatar: data.avatar_url })
    } catch (e: any) {
      if (e.status === 401) this.logout()
    }
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY)
    this.token.set('')
    this.user.set(null)
  }

  /** 读取仓库文件，不存在返回 null */
  async getFile(path: string, r: RepoInfo = this.repo): Promise<{ content: string; sha: string } | null> {
    try {
      if (r.provider === 'gitlab') {
        const d = await this.request(
          'GET',
          `/projects/${this.projectPath(r)}/repository/files/${encodeURIComponent(path)}?ref=${encodeURIComponent(r.branch)}`,
          undefined,
          r,
        )
        return { content: Base64.decode(d.content), sha: d.blob_id }
      }
      const d = await this.request(
        'GET',
        `/repos/${r.owner}/${r.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(r.branch)}&t=${Date.now()}`,
        undefined,
        r,
      )
      if (Array.isArray(d) || !d) return null
      // GitHub 对大于 1MB 的文件 content 为空，改用 blob 接口
      if (!d.content && d.sha && r.provider === 'github') {
        const blob = await this.request('GET', `/repos/${r.owner}/${r.repo}/git/blobs/${d.sha}`, undefined, r)
        return { content: Base64.decode(blob.content), sha: d.sha }
      }
      return { content: Base64.decode(d.content || ''), sha: d.sha }
    } catch (e: any) {
      if (e.status === 404) return null
      throw e
    }
  }

  /** 一次提交多个文件（GitHub/GitLab 为单次提交，Gitee 逐个提交） */
  async commit(changes: FileChange[], message: string, r: RepoInfo = this.repo) {
    this.busy.set(true)
    try {
      if (r.provider === 'github') await this.commitGitHub(changes, message, r)
      else if (r.provider === 'gitlab') await this.commitGitLab(changes, message, r)
      else await this.commitGitee(changes, message, r)
      if (r === this.repo) this.triggerDeploy()
    } finally {
      this.busy.set(false)
    }
  }

  private async commitGitHub(changes: FileChange[], message: string, r: RepoInfo) {
    const base = `/repos/${r.owner}/${r.repo}`
    const ref = await this.request('GET', `${base}/git/ref/heads/${encodeURIComponent(r.branch)}`, undefined, r)
    const headSha = ref.object.sha
    const head = await this.request('GET', `${base}/git/commits/${headSha}`, undefined, r)
    const tree: any[] = []
    for (const c of changes) {
      if (c.content === null) {
        tree.push({ path: c.path, mode: '100644', type: 'blob', sha: null })
      } else if (c.base64) {
        const blob = await this.request('POST', `${base}/git/blobs`, { content: c.content, encoding: 'base64' }, r)
        tree.push({ path: c.path, mode: '100644', type: 'blob', sha: blob.sha })
      } else {
        tree.push({ path: c.path, mode: '100644', type: 'blob', content: c.content })
      }
    }
    const newTree = await this.request('POST', `${base}/git/trees`, { base_tree: head.tree.sha, tree }, r)
    const commit = await this.request(
      'POST',
      `${base}/git/commits`,
      { message, tree: newTree.sha, parents: [headSha] },
      r,
    )
    await this.request('PATCH', `${base}/git/refs/heads/${encodeURIComponent(r.branch)}`, { sha: commit.sha }, r)
  }

  private async commitGitLab(changes: FileChange[], message: string, r: RepoInfo) {
    const actions = []
    for (const c of changes) {
      const exists = !!(await this.getFile(c.path, r))
      if (c.content === null) {
        if (exists) actions.push({ action: 'delete', file_path: c.path })
        continue
      }
      actions.push({
        action: exists ? 'update' : 'create',
        file_path: c.path,
        content: c.base64 ? c.content : Base64.encode(c.content),
        encoding: 'base64',
      })
    }
    if (!actions.length) return
    await this.request(
      'POST',
      `/projects/${this.projectPath(r)}/repository/commits`,
      { branch: r.branch, commit_message: message, actions },
      r,
    )
  }

  private async commitGitee(changes: FileChange[], message: string, r: RepoInfo) {
    for (const c of changes) {
      const path = `/repos/${r.owner}/${r.repo}/contents/${c.path.split('/').map(encodeURIComponent).join('/')}`
      const old = await this.getFile(c.path, r)
      if (c.content === null) {
        if (old) {
          const q = new URLSearchParams({ sha: old.sha, message, branch: r.branch, access_token: this.token() })
          await this.request('DELETE', `${path}?${q}`, undefined, r)
        }
        continue
      }
      const body: any = {
        access_token: this.token(),
        message,
        branch: r.branch,
        content: c.base64 ? c.content : Base64.encode(c.content),
      }
      if (old) body.sha = old.sha
      await this.request(old ? 'PUT' : 'POST', path, body, r)
    }
  }

  /** GitHub：图片分支不存在时创建空分支 */
  private async ensureBranch(r: RepoInfo) {
    if (r.provider !== 'github') return
    const base = `/repos/${r.owner}/${r.repo}`
    try {
      await this.request('GET', `${base}/git/ref/heads/${encodeURIComponent(r.branch)}`, undefined, r)
    } catch (e: any) {
      if (e.status !== 404) throw e
      const commit = await this.request(
        'POST',
        `${base}/git/commits`,
        { message: 'rebot(CI): create image branch', tree: EMPTY_TREE, parents: [] },
        r,
      )
      await this.request('POST', `${base}/git/refs`, { ref: `refs/heads/${r.branch}`, sha: commit.sha }, r)
    }
  }

  /** 上传图片到图片仓库，返回 CDN 地址 */
  async uploadImage(file: File): Promise<string> {
    const r = this.imageRepo
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(String(fr.result))
      fr.onerror = reject
      fr.readAsDataURL(file)
    })
    const content = dataUrl.split(',')[1]
    const ext = (file.name.split('.').pop() || file.type.split('/')[1] || 'png').toLowerCase()
    const path = `${Date.now()}.${ext}`
    this.busy.set(true)
    try {
      await this.ensureBranch(r)
      const msg = `rebot(CI): upload image ${path}`
      if (r.provider === 'gitlab') {
        await this.commitGitLab([{ path, content, base64: true }], msg, r)
      } else {
        const body: any = { message: msg, branch: r.branch, content }
        if (r.provider === 'gitee') body.access_token = this.token()
        await this.request(r.provider === 'github' ? 'PUT' : 'POST', `/repos/${r.owner}/${r.repo}/contents/${path}`, body, r)
      }
    } finally {
      this.busy.set(false)
    }
    return this.cdnUrl(path, r)
  }

  cdnUrl(path: string, r: RepoInfo = this.imageRepo) {
    if (r.provider === 'gitee') return `https://gitee.com/${r.owner}/${r.repo}/raw/${r.branch}/${path}`
    if (r.provider === 'gitlab') return `https://${r.host}/${r.owner}/${r.repo}/-/raw/${r.branch}/${path}?ref_type=heads`
    const cdn = this.blog.settings().gitHubCDN || 'cdn.jsdelivr.net'
    return `https://${cdn}/gh/${r.owner}/${r.repo}@${r.branch}/${path}`
  }

  /** 请求部署钩子（Vercel / Netlify / Cloudflare Deploy Hook） */
  triggerDeploy() {
    const url = this.blog.settings().actionUrl
    if (!url) return
    fetch(url, { method: 'POST', mode: 'no-cors' }).catch(() => {
      new Image().src = url
    })
  }
}

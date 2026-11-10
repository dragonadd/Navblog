import { Injectable, signal } from '@angular/core'

export function isLocalPreview(hostname: string): boolean {
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(
    hostname.toLowerCase(),
  )
}

/** 本地后台演示：浏览器中的文件副本，与 Token 和远程仓库分离。 */
@Injectable({ providedIn: 'root' })
export class LocalDemoService {
  readonly available = isLocalPreview(location.hostname)
  private key = `navblog:local-demo:v1:${new URL(document.baseURI).pathname}`
  readonly active = signal(this.available && this.readSession())
  private files: Record<string, string | null> = this.loadFiles()

  enter() {
    if (!this.available)
      throw new Error('本地演示仅可在 localhost 或回环地址使用')
    try {
      sessionStorage.setItem(this.key, 'active')
    } catch {}
    this.active.set(true)
  }

  exit() {
    try {
      sessionStorage.removeItem(this.key)
    } catch {}
    this.active.set(false)
  }

  exportFiles(): string {
    if (!this.available || !this.active()) throw new Error('请先进入本地演示')
    return JSON.stringify(this.files, null, 2)
  }

  read(path: string): string | null | undefined {
    if (!this.active() || !Object.hasOwn(this.files, path)) return undefined
    return this.files[path]
  }

  readJson<T>(path: string, fallback: T): T {
    const value = this.read(path)
    if (value == null) return fallback
    try {
      const parsed = JSON.parse(value)
      if (
        Array.isArray(fallback)
          ? Array.isArray(parsed)
          : parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      )
        return parsed as T
    } catch {}
    return fallback
  }

  save(
    changes: {
      path: string
      content: string | null
      expectedContent?: string | null
    }[],
  ) {
    if (!this.available || !this.active()) throw new Error('请先进入本地演示')
    const files = this.loadFiles()
    for (const change of changes) {
      if (change.expectedContent !== undefined) {
        const current = Object.hasOwn(files, change.path)
          ? files[change.path]
          : Object.hasOwn(this.files, change.path)
            ? null
            : change.expectedContent
        if (current !== change.expectedContent)
          throw new Error('动态已被其他窗口修改，请刷新后重试')
      }
    }
    for (const change of changes) files[change.path] = change.content
    try {
      localStorage.setItem(this.key, JSON.stringify(files))
    } catch {
      throw new Error('无法保存本地演示数据，请检查浏览器存储权限或空间')
    }
    this.files = files
  }

  private readSession(): boolean {
    try {
      return sessionStorage.getItem(this.key) === 'active'
    } catch {
      return false
    }
  }

  private loadFiles(): Record<string, string | null> {
    if (!this.available) return {}
    try {
      const files: unknown = JSON.parse(localStorage.getItem(this.key) || '{}')
      if (files && typeof files === 'object' && !Array.isArray(files)) {
        return Object.fromEntries(
          Object.entries(files).filter(
            ([, value]) => value === null || typeof value === 'string',
          ),
        )
      }
    } catch {}
    return {}
  }
}

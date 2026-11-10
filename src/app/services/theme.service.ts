import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core'
import { BlogService } from './blog.service'
import { resolveDark } from '../../shared/theme-settings'

const HUE_KEY = 'fuwari-theme-hue'
const DARK_KEY = 'blog-dark'

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private blog = inject(BlogService)
  private destroyRef = inject(DestroyRef)
  private preference: string | null = (() => {
    try {
      return localStorage.getItem(DARK_KEY)
    } catch {
      return null
    }
  })()
  readonly defaultHue = Number.isFinite(Number(this.blog.settings().themeHue))
    ? Math.min(360, Math.max(0, Number(this.blog.settings().themeHue)))
    : 52
  readonly dark = signal(document.documentElement.classList.contains('dark'))
  readonly hue = signal<number>(
    this.blog.settings().themeFixed
      ? this.defaultHue
      : ((window as any).__BLOG_CURRENT_HUE__ ?? this.defaultHue),
  )

  constructor() {
    this.applyHue(this.hue())
    if (typeof window.matchMedia !== 'function') return
    const system = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () =>
      this.applyDark(
        resolveDark(this.blog.settings(), this.preference, system.matches),
      )
    const onStorage = (event: StorageEvent) => {
      if (event.key !== DARK_KEY && event.key !== null) return
      try {
        this.preference = localStorage.getItem(DARK_KEY)
      } catch {
        this.preference = null
      }
      update()
    }
    effect(update)
    const timer = setInterval(update, 30_000)
    system.addEventListener('change', update)
    window.addEventListener('storage', onStorage)
    document.addEventListener('visibilitychange', update)
    this.destroyRef.onDestroy(() => {
      clearInterval(timer)
      system.removeEventListener('change', update)
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', update)
    })
  }

  toggleDark() {
    const v = !this.dark()
    this.preference = v ? '1' : '0'
    this.applyDark(v)
    try {
      localStorage.setItem(DARK_KEY, v ? '1' : '0')
    } catch {}
  }

  resetAppearance() {
    this.preference = null
    try {
      localStorage.removeItem(DARK_KEY)
    } catch {}
    this.applyDark(
      resolveDark(
        this.blog.settings(),
        null,
        window.matchMedia('(prefers-color-scheme: dark)').matches,
      ),
    )
  }

  private applyDark(value: boolean) {
    this.dark.set(value)
    document.documentElement.classList.toggle('dark', value)
  }

  setHue(hue: number) {
    hue = Math.max(0, Math.min(360, Math.round(hue)))
    this.hue.set(hue)
    this.applyHue(hue)
    try {
      if (hue === this.defaultHue) localStorage.removeItem(HUE_KEY)
      else localStorage.setItem(HUE_KEY, String(hue))
    } catch {}
  }

  resetHue() {
    this.setHue(this.defaultHue)
  }

  get hex(): string {
    const h = this.hue(),
      s = this.dark() ? 0.75 : 0.85,
      l = this.dark() ? 0.62 : 0.45
    const a = s * Math.min(l, 1 - l)
    const channel = (n: number) => {
      const k = (n + h / 30) % 12
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
        .toString(16)
        .padStart(2, '0')
    }
    return '#' + channel(0) + channel(8) + channel(4)
  }

  private applyHue(hue: number) {
    document.documentElement.style.setProperty('--hue', String(hue))
  }
}

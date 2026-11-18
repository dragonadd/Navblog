import { Component, computed, effect, inject, signal } from '@angular/core'
import { BlogService } from '../services/blog.service'
import { HitokotoService, type DailyPart } from '../services/hitokoto.service'
import { dailyTextLimit, limitDailyText, renderDailyTemplate } from '../../shared/daily-text'

@Component({
  selector: 'app-hitokoto',
  template: `
    @if (enabled()) {
    <section class="fuwari-card mb-4 p-5 md:p-6" [attr.aria-labelledby]="showTitle() ? 'hitokoto-title' : null" [attr.aria-label]="showTitle() ? null : '每日文字'" [attr.aria-busy]="loading()">
      @if (showTitle()) {
      <h2 id="hitokoto-title" class="fuwari-section-title mb-3 text-sm">
        <i class="fas fa-quote-left mr-2" aria-hidden="true"></i>{{ title() }}
      </h2>
      }
      <div aria-live="polite">
        @for (q of parts(); track $index) {
          <figure class="border-b border-dashed border-[var(--fuwari-border)] py-3 first:pt-0 last:border-0 last:pb-0">
            <blockquote class="text-base leading-relaxed whitespace-pre-line break-words md:text-lg">{{ q.text }}</blockquote>
            @if (q.attribution && (q.from || q.author)) {
              <figcaption class="fuwari-muted mt-3 text-right text-xs">
                — {{ q.author }}{{ q.from ? '《' + q.from + '》' : '' }}
              </figcaption>
            }
          </figure>
        }
        @if (!parts().length && loading()) {
          <p class="fuwari-muted text-sm">正在拾取今天的一句话…</p>
        } @else if (!parts().length && !failures().length) {
          <p class="fuwari-muted text-sm">尚未配置每日文字。</p>
        }
        @if (failures().length) {
          <div class="fuwari-muted mt-2 flex items-center gap-3 text-sm">
            <span>{{ parts().length ? '部分来源暂时无法获取，已显示可用内容。' : '今日文字暂时无法获取。' }}</span>
            <button type="button" class="fuwari-btn shrink-0 !py-1 !text-xs" (click)="retry()" [disabled]="loading()">重试</button>
          </div>
        }
      </div>
    </section>
    }
  `,
})
export class HitokotoComponent {
  private blog = inject(BlogService)
  private hitokoto = inject(HitokotoService)
  readonly enabled = computed(() => this.blog.settings().hitokotoEnable !== false)
  readonly showTitle = computed(() => this.blog.settings().hitokotoShowTitle !== false)
  readonly title = computed(() => this.blog.settings().hitokotoTitle?.trim() || '今日一言')
  private readonly fetchedParts = signal<DailyPart[]>([])
  private readonly now = signal(new Date())
  readonly parts = computed(() => this.fetchedParts().map(part => part.template
    ? { ...part, text: limitDailyText(renderDailyTemplate(part.template, this.now()), dailyTextLimit(this.blog.settings().hitokotoMaxLength)) }
    : part))
  readonly loading = signal(true)
  readonly failures = signal<string[]>([])
  retry = () => {}

  constructor() {
    effect((onCleanup) => {
      const settings = this.blog.settings()
      let active = true
      let requestVersion = 0
      let timer: ReturnType<typeof setTimeout>
      this.fetchedParts.set([])
      this.failures.set([])
      if (settings.hitokotoEnable === false) { this.loading.set(false); return }
      const tick = () => this.now.set(new Date())
      tick()
      const clockTimer = settings.hitokotoCustomText?.includes('{time}') ? setInterval(tick, 1000) : undefined

      const load = async () => {
        const version = ++requestVersion
        this.loading.set(true)
        this.failures.set([])
        try {
          const content = await this.hitokoto.getDaily(settings)
          if (active && version === requestVersion) {
            this.fetchedParts.set(content.parts)
            tick()
            this.failures.set(content.failures)
          }
        } catch (error) {
          if (active && version === requestVersion) this.failures.set([error instanceof Error ? error.message : '获取失败'])
        } finally {
          if (active && version === requestVersion) this.loading.set(false)
        }
      }

      // 保持页面打开时也跨天更新；后台标签页唤醒时重新检查缓存日期。
      const scheduleMidnight = () => {
        const now = new Date()
        const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
        timer = setTimeout(() => {
          void load()
          scheduleMidnight()
        }, midnight.getTime() - now.getTime() + 100)
      }
      const onVisible = () => {
        if (document.visibilityState === 'visible') { tick(); void load() }
      }
      this.retry = () => { void load() }
      void load()
      scheduleMidnight()
      document.addEventListener('visibilitychange', onVisible)
      onCleanup(() => {
        active = false
        clearTimeout(timer)
        if (clockTimer !== undefined) clearInterval(clockTimer)
        document.removeEventListener('visibilitychange', onVisible)
      })
    })
  }
}

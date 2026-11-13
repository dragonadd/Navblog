import { Component, DestroyRef, computed, inject, signal } from '@angular/core'
import { BlogService } from '../services/blog.service'
import { readBlogInfo } from '../../shared/blog-info'
import { formatMomentDate } from '../../shared/moments'

@Component({
  selector: 'app-blog-info',
  template: `
    <section class="fuwari-card p-4" aria-label="博客信息">
      <h2 class="fuwari-section-title mb-3">博客信息</h2>
      <dl class="divide-y divide-[var(--fuwari-border)] text-sm">
        <div class="flex items-center justify-between gap-2 pb-3">
          <dt class="fuwari-muted flex items-center gap-2">
            <i class="far fa-file-alt w-4 text-center" aria-hidden="true"></i
            >文章数目
          </dt>
          <dd
            class="fuwari-chip !block min-w-0 max-w-[55%] !px-2 !py-0.5 text-right text-xs break-all tabular-nums"
            title="公开文章，包含加密文章；排除草稿和隐藏文章"
          >
            {{ info().articleCount }}
          </dd>
        </div>
        <div class="flex items-center justify-between gap-2 py-3">
          <dt class="fuwari-muted flex items-center gap-2">
            <i class="far fa-comment w-4 text-center" aria-hidden="true"></i
            >评论数目
          </dt>
          <dd
            class="fuwari-chip !block min-w-0 max-w-[55%] !px-2 !py-0.5 text-right text-xs break-all tabular-nums"
            [title]="
              info().commentCount === null
                ? '尚未配置已核实的评论总数快照'
                : '手动快照，截至 ' + info().commentCountDate
            "
          >
            {{ info().commentCount === null ? '未配置' : info().commentCount }}
          </dd>
        </div>
        <div class="flex items-center justify-between gap-2 py-3">
          <dt class="fuwari-muted flex items-center gap-2">
            <i
              class="far fa-calendar-alt w-4 text-center"
              aria-hidden="true"
            ></i
            >运行天数
          </dt>
          <dd
            class="fuwari-chip !block min-w-0 max-w-[55%] !px-2 !py-0.5 text-right text-xs break-all tabular-nums"
            [title]="
              settings().blogStartDate
                ? '起始日期：' +
                  settings().blogStartDate +
                  '；按访客本地日历计算，起始当天为 0 天'
                : '请在站点设置中填写运行起始日期'
            "
          >
            @if (info().runningDays !== null) {
              {{ info().runningDays }} 天
            } @else {
              {{ settings().blogStartDate ? '尚未开始' : '未配置' }}
            }
          </dd>
        </div>
        <div class="flex items-center justify-between gap-2 pt-3">
          <dt class="fuwari-muted flex items-center gap-2">
            <i class="fas fa-wave-square w-4 text-center" aria-hidden="true"></i
            >最后活动
          </dt>
          <dd
            class="fuwari-chip !block min-w-0 max-w-[55%] !px-1.5 !py-0.5 text-right text-xs break-all tabular-nums"
          >
            @if (info().lastActivity; as activity) {
              <time [attr.datetime]="activity" [title]="activityTime()">{{
                activityTime().split(' ')[0]
              }}</time>
            } @else {
              {{ info().activityUnavailable ? '不可用' : '暂无活动' }}
            }
          </dd>
        </div>
      </dl>
      <p class="fuwari-muted mt-3 text-xs leading-relaxed">
        @if (info().commentCount !== null) {
          评论为手动快照，截至 {{ info().commentCountDate }}。
        } @else {
          全站评论总数尚未配置。
        }
      </p>
      @if (info().activityUnavailable) {
        <p class="fuwari-muted mt-2 text-xs leading-relaxed">
          内容日期或碎碎念数据不可用，无法确定最后活动。
        </p>
      }
    </section>
  `,
})
export class BlogInfoComponent {
  private readonly blog = inject(BlogService)
  readonly settings = this.blog.settings
  private readonly now = signal(new Date())
  private readonly moments = computed(() => {
    this.settings()
    try {
      return this.blog.getMoments()
    } catch {
      return null
    }
  })
  readonly info = computed(() =>
    readBlogInfo(
      this.settings(),
      this.blog.allPosts(),
      this.moments(),
      this.now(),
    ),
  )
  readonly activityTime = computed(() => {
    const activity = this.info().lastActivity
    return activity ? formatMomentDate(activity) : ''
  })

  constructor() {
    const update = () => this.now.set(new Date())
    const timer = setInterval(update, 60000)
    document.addEventListener('visibilitychange', update)
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', update)
    })
  }
}

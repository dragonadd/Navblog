import { Component, computed, inject } from '@angular/core'
import { BlogService } from '../services/blog.service'
import { AnnouncementStateService } from '../services/announcement-state.service'
import {
  announcementVersion,
  readAnnouncement,
} from '../../shared/announcement'

@Component({
  selector: 'app-announcement',
  template: `
    @if (visible()) {
      <section class="fuwari-card relative p-4" aria-label="站点公告">
        <div class="min-w-0" [class.pr-7]="announcement().closable">
          @if (announcement().text) {
            <p class="text-sm leading-relaxed whitespace-pre-line break-words">
              {{ announcement().text }}
            </p>
          }
          @if (announcement().link) {
            <a
              class="fuwari-link mt-3 inline-flex items-center gap-2 text-sm"
              [href]="link()"
              [attr.target]="external() ? '_blank' : null"
              rel="noopener noreferrer"
              >查看详情<i
                class="fas fa-arrow-right text-xs"
                aria-hidden="true"
              ></i
            ></a>
          }
        </div>
        @if (announcement().closable) {
          <button
            type="button"
            class="fuwari-tool-btn absolute top-2 right-2 !h-7 !w-7"
            aria-label="关闭公告"
            title="关闭公告"
            (click)="close()"
          >
            <i class="fas fa-times" aria-hidden="true"></i>
          </button>
        }
      </section>
    }
  `,
})
export class AnnouncementComponent {
  private readonly blog = inject(BlogService)
  private readonly state = inject(AnnouncementStateService)
  readonly announcement = computed(() => readAnnouncement(this.blog.settings()))
  readonly version = computed(() => announcementVersion(this.announcement()))
  readonly visible = computed(() => {
    const a = this.announcement()
    return (
      a.enabled &&
      !!(a.text || a.link) &&
      (!a.closable || this.state.dismissed() !== this.version())
    )
  })
  readonly link = computed(() => this.blog.url(this.announcement().link))
  readonly external = computed(
    () => !!this.link() && new URL(this.link()).origin !== location.origin,
  )

  close() {
    this.state.dismiss(this.version())
  }
}

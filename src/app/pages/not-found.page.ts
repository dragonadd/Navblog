import { Component, inject } from '@angular/core'
import { RouterLink } from '@angular/router'
import { BlogService } from '../services/blog.service'

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink],
  template: `
    <div class="fuwari-card p-12 text-center">
      <div class="text-6xl font-bold text-[var(--fuwari-primary)]">404</div>
      <p class="fuwari-muted mt-3">页面走丢了~</p>
      <a routerLink="/" class="fuwari-btn solid mt-6"><i class="fas fa-home"></i>返回首页</a>
    </div>
  `,
})
export class NotFoundPage {
  constructor() {
    inject(BlogService).setTitle('404')
  }
}

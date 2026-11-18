import { Component, inject, signal } from '@angular/core'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'
import { BlogService } from '../services/blog.service'
import { renderMarkdown } from '../../shared/markdown'
import { parseFrontMatter } from '../../shared/frontmatter'

@Component({
  selector: 'app-about-page',
  template: `
    <article class="fuwari-card p-5 md:p-8">
      @if (html()) {
        <div class="prose-blog" [innerHTML]="html()"></div>
      } @else {
        <div class="fuwari-muted py-16 text-center"><i class="fas fa-spinner fa-spin mr-2"></i>加载中…</div>
      }
    </article>
  `,
})
export class AboutPage {
  private blog = inject(BlogService)
  private sanitizer = inject(DomSanitizer)
  readonly html = signal<SafeHtml>('')
  constructor() {
    this.blog.setTitle('关于')
    this.blog
      .getAboutSource()
      .then((src) => this.html.set(this.sanitizer.bypassSecurityTrustHtml(renderMarkdown(parseFrontMatter(src).body).html)))
      .catch(() => this.html.set('<p>暂无内容</p>'))
  }
}

import { Component, HostListener, OnInit, computed, inject, input, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Router, RouterLink } from '@angular/router'
import { AdminStore } from './admin-store.service'
import { MdEditorComponent } from './md-editor.component'
import { GitService } from '../services/git.service'
import { ToastService } from '../services/toast.service'
import { BlogService } from '../services/blog.service'
import { slugify } from '../../shared/frontmatter'
import type { PostMeta } from '../../shared/types'

function now() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

@Component({
  selector: 'app-editor-page',
  imports: [FormsModule, RouterLink, MdEditorComponent],
  template: `
    @if (loading()) {
      <div class="fuwari-card fuwari-muted p-16 text-center"><i class="fas fa-spinner fa-spin mr-2"></i>正在从仓库读取文章…</div>
    } @else {
      <div class="flex flex-col gap-4">
        <div class="fuwari-card p-5">
          <div class="mb-4 flex flex-wrap items-center gap-3">
            <h1 class="fuwari-section-title !text-lg">{{ isNew() ? '写文章' : '编辑文章' }}</h1>
            <div class="ml-auto flex gap-2">
              <a class="fuwari-btn" routerLink="/admin"><i class="fas fa-arrow-left"></i>返回</a>
              <button class="fuwari-btn solid" (click)="save()" [disabled]="saving()">
                <i [class]="saving() ? 'fas fa-spinner fa-spin' : 'fas fa-cloud-upload-alt'"></i>{{ draft ? '保存草稿' : '发布' }}
              </button>
            </div>
          </div>
          <input class="fuwari-input !py-3 !text-xl !font-bold" [(ngModel)]="title" (ngModelChange)="onTitle()" placeholder="文章标题" />
          <div class="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label class="fuwari-label">Slug（文件名 / URL）</label>
              <input class="fuwari-input" [(ngModel)]="slug" (ngModelChange)="slugTouched = true" placeholder="my-post" />
            </div>
            <div>
              <label class="fuwari-label">发布时间</label>
              <input class="fuwari-input" [(ngModel)]="date" placeholder="YYYY-MM-DD HH:mm" />
            </div>
            <div>
              <label class="fuwari-label">分类</label>
              <input class="fuwari-input" [(ngModel)]="category" list="cat-list" placeholder="选择或输入分类" />
              <datalist id="cat-list">
                @for (c of categories(); track c) { <option [value]="c"></option> }
              </datalist>
            </div>
            <div>
              <label class="fuwari-label">标签（逗号分隔）</label>
              <input class="fuwari-input" [(ngModel)]="tags" placeholder="标签1, 标签2" />
            </div>
          </div>
          @if (allTags().length) {
            <div class="mt-2 flex flex-wrap gap-1.5">
              @for (t of allTags(); track t) {
                <button type="button" class="fuwari-chip !py-0.5 !text-xs" (click)="addTag(t)">+ {{ t }}</button>
              }
            </div>
          }
          <div class="mt-4 grid gap-4 md:grid-cols-[1fr_1fr]">
            <div>
              <label class="fuwari-label">摘要（留空自动截取正文）</label>
              <textarea class="fuwari-input" rows="2" [(ngModel)]="summary"></textarea>
            </div>
            <div>
              <label class="fuwari-label">封面图</label>
              <div class="flex gap-2">
                <input class="fuwari-input" [(ngModel)]="cover" placeholder="https://..." />
                <button type="button" class="fuwari-btn shrink-0" (click)="coverInput.click()" title="上传封面">
                  <i [class]="uploading() ? 'fas fa-spinner fa-spin' : 'fas fa-upload'"></i>
                </button>
                <input #coverInput type="file" accept="image/*" class="hidden" (change)="uploadCover($event)" />
              </div>
              @if (cover) { <img [src]="cover" class="mt-2 h-16 rounded-lg object-cover" alt="" /> }
            </div>
          </div>
          <div class="mt-4 flex flex-wrap gap-5 text-sm">
            <label class="flex cursor-pointer items-center gap-2"><input type="checkbox" class="accent-[var(--fuwari-primary)]" [(ngModel)]="pinned" />置顶</label>
            <label class="flex cursor-pointer items-center gap-2"><input type="checkbox" class="accent-[var(--fuwari-primary)]" [(ngModel)]="draft" />草稿（不在前台显示）</label>
            <label class="flex cursor-pointer items-center gap-2"><input type="checkbox" class="accent-[var(--fuwari-primary)]" [(ngModel)]="comments" />允许评论</label>
            <span class="fuwari-muted ml-auto text-xs">Ctrl + S 保存</span>
          </div>
        </div>
        <app-md-editor [(value)]="body" />
      </div>
    }
  `,
})
export class EditorPage implements OnInit {
  private store = inject(AdminStore)
  private git = inject(GitService)
  private toast = inject(ToastService)
  private router = inject(Router)
  private blog = inject(BlogService)
  readonly slugParam = input<string>('', { alias: 'slug' })
  readonly isNew = computed(() => !this.slugParam())
  readonly loading = signal(false)
  readonly saving = signal(false)
  readonly uploading = signal(false)
  readonly categories = computed(() => [...new Set(this.store.posts().map((p) => p.category).filter(Boolean))] as string[])
  readonly allTags = computed(() => [...new Set(this.store.posts().flatMap((p) => p.tags))])

  title = ''
  slug = ''
  slugTouched = false
  date = now()
  updated = ''
  category = ''
  tags = ''
  summary = ''
  cover = ''
  pinned = false
  draft = false
  comments = true
  body = ''
  private original?: PostMeta
  private dirty = false

  async ngOnInit() {
    this.blog.setTitle(this.isNew() ? '写文章' : '编辑文章')
    if (!this.store.loaded()) this.store.loadIndex().catch(() => {})
    if (this.isNew()) return
    this.loading.set(true)
    try {
      const res = await this.store.loadPost(this.slugParam())
      if (!res) {
        this.toast.error('仓库中找不到该文章')
        this.router.navigateByUrl('/admin')
        return
      }
      const m = res.meta
      this.original = m
      this.title = m.title
      this.slug = m.slug
      this.slugTouched = true
      this.date = m.date
      this.updated = m.updated || ''
      this.category = m.category || ''
      this.tags = m.tags.join(', ')
      // 只保留用户手写的摘要（自动摘要不回填）
      this.summary = String(res.data['summary'] ?? res.data['description'] ?? '')
      this.cover = m.cover || ''
      this.pinned = !!m.pinned
      this.draft = !!m.draft
      this.comments = m.comments !== false
      this.body = res.body
    } catch (e: any) {
      this.toast.error('读取失败：' + e.message)
    } finally {
      this.loading.set(false)
    }
  }

  onTitle() {
    if (!this.slugTouched) this.slug = slugify(this.title)
  }

  addTag(t: string) {
    const list = this.tags.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
    if (!list.includes(t)) list.push(t)
    this.tags = list.join(', ')
  }

  async uploadCover(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    this.uploading.set(true)
    try {
      this.cover = await this.git.uploadImage(file)
      this.toast.success('封面上传成功')
    } catch (err: any) {
      this.toast.error('上传失败：' + err.message)
    } finally {
      this.uploading.set(false)
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault()
      this.save()
    }
  }

  async save() {
    if (this.saving()) return
    const slug = slugify(this.slug || this.title)
    if (!this.title.trim()) return this.toast.error('请填写标题')
    if (!slug) return this.toast.error('请填写 slug')
    const oldSlug = this.original?.slug
    if (slug !== oldSlug && this.store.posts().some((p) => p.slug === slug)) {
      return this.toast.error(`slug「${slug}」已存在`)
    }
    const meta: PostMeta = {
      slug,
      title: this.title.trim(),
      date: this.date.trim() || now(),
      category: this.category.trim() || undefined,
      tags: this.tags.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
      summary: this.summary.trim() || undefined,
      cover: this.cover.trim() || undefined,
      pinned: this.pinned,
      draft: this.draft,
      comments: this.comments ? undefined : false,
    }
    if (oldSlug) meta.updated = now()
    this.saving.set(true)
    try {
      await this.store.savePost(meta, this.body, oldSlug)
      this.slug = slug
      this.original = meta
      this.toast.success('保存成功，等待重新部署后生效')
      if (this.isNew() || slug !== oldSlug) this.router.navigate(['/admin/edit', slug], { replaceUrl: true })
    } catch (e: any) {
      this.toast.error('保存失败：' + e.message)
    } finally {
      this.saving.set(false)
    }
  }
}

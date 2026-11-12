import {
  Component,
  HostListener,
  OnInit,
  OnDestroy,
  computed,
  inject,
  input,
  signal,
} from '@angular/core'
import { FormsModule } from '@angular/forms'
import { Router, RouterLink } from '@angular/router'
import { AdminStore } from './admin-store.service'
import { MdEditorComponent } from './md-editor.component'
import { GitService } from '../services/git.service'
import { ToastService } from '../services/toast.service'
import { BlogService } from '../services/blog.service'
import { slugify } from '../../shared/frontmatter'
import type { PostMeta } from '../../shared/types'
import { LocalDemoService } from '../services/local-demo.service'
import { decryptPostBody } from '../../shared/post-crypto'

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
      <div class="fuwari-card fuwari-muted p-16 text-center">
        <i class="fas fa-spinner fa-spin mr-2"></i
        >{{ demo.active() ? '正在读取本地演示文章…' : '正在从仓库读取文章…' }}
      </div>
    } @else {
      <div class="flex flex-col gap-4">
        <div class="fuwari-card p-5">
          <div class="mb-4 flex flex-wrap items-center gap-3">
            <h1 class="fuwari-section-title !text-lg">
              {{ isNew() ? '写文章' : '编辑文章' }}
            </h1>
            <div class="ml-auto flex gap-2">
              <a class="fuwari-btn" routerLink="/admin"
                ><i class="fas fa-arrow-left"></i>返回</a
              >
              <button
                class="fuwari-btn solid"
                (click)="save()"
                [disabled]="saving() || locked() || loadFailed()"
              >
                <i
                  [class]="
                    saving()
                      ? 'fas fa-spinner fa-spin'
                      : 'fas fa-cloud-upload-alt'
                  "
                ></i
                >{{
                  demo.active() ? '保存到本地演示' : draft ? '保存草稿' : '发布'
                }}
              </button>
            </div>
          </div>
          <input
            class="fuwari-input !py-3 !text-xl !font-bold"
            [(ngModel)]="title"
            (ngModelChange)="onTitle()"
            placeholder="文章标题"
          />
          <div class="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label class="fuwari-label">Slug（文件名 / URL）</label>
              <input
                class="fuwari-input"
                [(ngModel)]="slug"
                (ngModelChange)="slugTouched = true"
                placeholder="my-post"
              />
            </div>
            <div>
              <label class="fuwari-label">发布时间</label>
              <input
                class="fuwari-input"
                [(ngModel)]="date"
                placeholder="YYYY-MM-DD HH:mm"
              />
            </div>
            <div>
              <label class="fuwari-label">分类</label>
              <input
                class="fuwari-input"
                [(ngModel)]="category"
                list="cat-list"
                placeholder="选择或输入分类"
              />
              <datalist id="cat-list">
                @for (c of categories(); track c) {
                  <option [value]="c"></option>
                }
              </datalist>
            </div>
            <div>
              <label class="fuwari-label">标签（逗号分隔）</label>
              <input
                class="fuwari-input"
                [(ngModel)]="tags"
                placeholder="标签1, 标签2"
              />
            </div>
          </div>
          @if (allTags().length) {
            <div class="mt-2 flex flex-wrap gap-1.5">
              @for (t of allTags(); track t) {
                <button
                  type="button"
                  class="fuwari-chip !py-0.5 !text-xs"
                  (click)="addTag(t)"
                >
                  + {{ t }}
                </button>
              }
            </div>
          }
          <div class="mt-4 grid gap-4 md:grid-cols-[1fr_1fr]">
            <div>
              <label class="fuwari-label">{{
                encrypted
                  ? '公开摘要（留空显示加密提示）'
                  : '摘要（留空自动截取正文）'
              }}</label>
              <textarea
                class="fuwari-input"
                rows="2"
                [(ngModel)]="summary"
              ></textarea>
            </div>
            <div>
              <label class="fuwari-label">封面图</label>
              <div class="flex gap-2">
                <input
                  class="fuwari-input"
                  [(ngModel)]="cover"
                  placeholder="https://..."
                />
                <button
                  type="button"
                  class="fuwari-btn shrink-0"
                  (click)="coverInput.click()"
                  title="上传封面"
                >
                  <i
                    [class]="
                      uploading() ? 'fas fa-spinner fa-spin' : 'fas fa-upload'
                    "
                  ></i>
                </button>
                <input
                  #coverInput
                  type="file"
                  accept="image/*"
                  class="hidden"
                  (change)="uploadCover($event)"
                />
              </div>
              @if (cover) {
                <img
                  [src]="cover"
                  class="mt-2 h-16 rounded-lg object-cover"
                  alt=""
                />
              }
            </div>
          </div>
          <div class="mt-4 flex flex-wrap gap-5 text-sm">
            <label class="flex cursor-pointer items-center gap-2"
              ><input
                type="checkbox"
                class="accent-[var(--fuwari-primary)]"
                [(ngModel)]="pinned"
              />置顶</label
            >
            <label class="flex cursor-pointer items-center gap-2"
              ><input
                type="checkbox"
                class="accent-[var(--fuwari-primary)]"
                [(ngModel)]="draft"
              />草稿（不在前台显示）</label
            >
            <label class="flex cursor-pointer items-center gap-2"
              ><input
                type="checkbox"
                class="accent-[var(--fuwari-primary)]"
                [(ngModel)]="hidden"
              />隐藏文章（仅搜索和直链可见）</label
            >
            <label class="flex cursor-pointer items-center gap-2"
              ><input
                type="checkbox"
                class="accent-[var(--fuwari-primary)]"
                [(ngModel)]="comments"
              />允许评论</label
            >
            <label class="flex items-center gap-2"
              ><input
                type="checkbox"
                [(ngModel)]="hideSidebar"
              />隐藏侧栏（全宽阅读）</label
            >
            <span class="fuwari-muted ml-auto text-xs">Ctrl + S 保存</span>
          </div>
          <div class="mt-4 border-t border-[var(--fuwari-border)] pt-4">
            <label class="flex items-center gap-2 text-sm"
              ><input
                type="checkbox"
                [(ngModel)]="encrypted"
                [disabled]="locked()"
              />文章密码加密</label
            >
            @if (encrypted && !locked()) {
              <div class="mt-3 grid gap-3 md:grid-cols-2">
                <label class="fuwari-label"
                  >{{
                    hasExistingPassword()
                      ? '新密码（留空沿用解锁密码）'
                      : '加密密码（至少 4 个字符）'
                  }}<input
                    class="fuwari-input mt-1"
                    type="password"
                    [(ngModel)]="password"
                    autocomplete="new-password"
                    aria-label="文章加密密码"
                /></label>
                <label class="fuwari-label"
                  >确认新密码<input
                    class="fuwari-input mt-1"
                    type="password"
                    [(ngModel)]="passwordConfirm"
                    autocomplete="new-password"
                    aria-label="确认文章加密密码"
                /></label>
              </div>
              <p class="fuwari-muted mt-2 text-xs">
                正文提交前加密；标题、公开摘要、分类、标签和封面仍对外可见。密码不会保存到仓库或浏览器存储。
              </p>
            }
            @if (originalEncrypted() && !encrypted && !locked()) {
              <p class="mt-2 text-sm text-orange-500">
                关闭加密后，保存将公开发布完整正文。
              </p>
            }
          </div>
        </div>
        @if (locked()) {
          <form class="fuwari-card p-5" (submit)="unlockForEditing($event)">
            <p class="mb-3 text-sm">这篇文章已加密，请先解锁正文再编辑。</p>
            <div class="flex flex-col gap-3 sm:flex-row">
              <input
                class="fuwari-input"
                type="password"
                name="unlock"
                [(ngModel)]="unlockPassword"
                autocomplete="off"
                aria-label="编辑解锁密码"
                required
              /><button
                class="fuwari-btn solid shrink-0"
                type="submit"
                [disabled]="unlocking()"
              >
                {{ unlocking() ? '解锁中…' : '解锁编辑' }}
              </button>
            </div>
            @if (unlockError()) {
              <p class="mt-3 text-sm text-red-500" role="alert">
                {{ unlockError() }}
              </p>
            }
          </form>
        } @else if (!loadFailed()) {
          <app-md-editor [(value)]="body" />
        }
      </div>
    }
  `,
})
export class EditorPage implements OnInit, OnDestroy {
  readonly demo = inject(LocalDemoService)
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
  readonly locked = signal(false)
  readonly loadFailed = signal(false)
  readonly unlocking = signal(false)
  readonly unlockError = signal('')
  readonly hasExistingPassword = signal(false)
  readonly originalEncrypted = signal(false)
  readonly categories = computed(
    () =>
      [
        ...new Set(
          this.store
            .posts()
            .map((p) => p.category)
            .filter(Boolean),
        ),
      ] as string[],
  )
  readonly allTags = computed(() => [
    ...new Set(this.store.posts().flatMap((p) => p.tags)),
  ])

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
  hidden = false
  hideSidebar = false
  comments = true
  body = ''
  encrypted = false
  password = ''
  passwordConfirm = ''
  unlockPassword = ''
  private existingPassword = ''
  private encryptedBody = ''
  private alive = true
  private original?: PostMeta
  private dirty = false

  async ngOnInit() {
    this.blog.setTitle(this.isNew() ? '写文章' : '编辑文章')
    if (!this.store.loaded()) this.store.loadIndex().catch(() => {})
    if (this.isNew()) return
    this.loading.set(true)
    try {
      const res = await this.store.loadPost(this.slugParam())
      if (!this.alive) return
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
      this.summary = String(
        res.data['summary'] ?? res.data['description'] ?? '',
      )
      this.cover = m.cover || ''
      this.pinned = !!m.pinned
      this.draft = !!m.draft
      this.hidden = !!m.hidden
      this.hideSidebar = !!m.hideSidebar
      this.comments = m.comments !== false
      this.encrypted = !!m.encrypted
      this.originalEncrypted.set(this.encrypted)
      this.locked.set(this.encrypted)
      this.encryptedBody = this.encrypted ? res.body : ''
      this.body = this.encrypted ? '' : res.body
    } catch (e: any) {
      this.loadFailed.set(true)
      this.toast.error('读取失败：' + e.message)
    } finally {
      this.loading.set(false)
    }
  }

  async unlockForEditing(event: Event) {
    event.preventDefault()
    if (this.unlocking()) return
    this.unlocking.set(true)
    this.unlockError.set('')
    const password = this.unlockPassword
    this.unlockPassword = ''
    try {
      const body = await decryptPostBody(this.encryptedBody, password)
      if (!this.alive) return
      this.body = body
      this.existingPassword = password
      this.hasExistingPassword.set(true)
      this.locked.set(false)
      this.encryptedBody = ''
    } catch (e: any) {
      if (this.alive) this.unlockError.set(e.message)
    } finally {
      if (this.alive) this.unlocking.set(false)
    }
  }

  onTitle() {
    if (!this.slugTouched) this.slug = slugify(this.title)
  }

  addTag(t: string) {
    const list = this.tags
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean)
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
    if (
      this.saving() ||
      this.locked() ||
      this.loading() ||
      this.loadFailed() ||
      !this.alive
    )
      return
    const password = this.encrypted
      ? this.password || this.existingPassword
      : undefined
    if (this.encrypted && !password)
      return this.toast.error('请填写文章加密密码')
    if (
      this.encrypted &&
      (this.password || this.passwordConfirm) &&
      this.password !== this.passwordConfirm
    )
      return this.toast.error('两次输入的新密码不一致')
    const slug = slugify(this.slug || this.title)
    if (!this.title.trim()) return this.toast.error('请填写标题')
    if (!slug) return this.toast.error('请填写 slug')
    const oldSlug = this.original?.slug
    if (slug !== oldSlug && this.store.posts().some((p) => p.slug === slug)) {
      return this.toast.error(`slug「${slug}」已存在`)
    }
    const meta: PostMeta = {
      encrypted: this.encrypted || undefined,
      slug,
      title: this.title.trim(),
      date: this.date.trim() || now(),
      category: this.category.trim() || undefined,
      tags: this.tags
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean),
      summary: this.summary.trim() || undefined,
      cover: this.cover.trim() || undefined,
      hideSidebar: this.hideSidebar || undefined,
      pinned: this.pinned,
      draft: this.draft,
      hidden: this.hidden || undefined,
      comments: this.comments ? undefined : false,
    }
    if (oldSlug) meta.updated = now()
    this.saving.set(true)
    try {
      await this.store.savePost(meta, this.body, oldSlug, password)
      if (!this.alive) return
      this.existingPassword = password || ''
      this.hasExistingPassword.set(!!password)
      this.originalEncrypted.set(!!meta.encrypted)
      this.password = ''
      this.passwordConfirm = ''
      this.slug = slug
      this.original = meta
      this.toast.success(
        this.demo.active()
          ? '已保存到本地演示，查看博客即可预览'
          : '保存成功，等待重新部署后生效',
      )
      if (this.isNew() || slug !== oldSlug)
        this.router.navigate(['/admin/edit', slug], { replaceUrl: true })
    } catch (e: any) {
      this.toast.error('保存失败：' + e.message)
    } finally {
      this.saving.set(false)
    }
  }

  ngOnDestroy() {
    this.alive = false
    this.body =
      this.password =
      this.passwordConfirm =
      this.unlockPassword =
      this.existingPassword =
      this.encryptedBody =
        ''
  }
}

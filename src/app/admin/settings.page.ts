import { ChangeDetectorRef, Component, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { AdminStore } from './admin-store.service'
import { ToastService } from '../services/toast.service'
import { BlogService } from '../services/blog.service'
import { GitService } from '../services/git.service'
import type { BlogSettings } from '../../shared/types'

@Component({
  selector: 'app-settings-page',
  imports: [FormsModule],
  template: `
    <div class="flex flex-col gap-4">
      <div class="fuwari-card flex items-center p-5">
        <h1 class="fuwari-section-title !text-lg">站点设置</h1>
        <button class="fuwari-btn solid ml-auto" (click)="save()" [disabled]="saving() || !s">
          <i [class]="saving() ? 'fas fa-spinner fa-spin' : 'fas fa-cloud-upload-alt'"></i>保存
        </button>
      </div>

      @if (!s) {
        <div class="fuwari-card fuwari-muted p-16 text-center"><i class="fas fa-spinner fa-spin mr-2"></i>加载中…</div>
      } @else {
        <div class="fuwari-card p-5">
          <div class="fuwari-section-title mb-4">基本信息</div>
          <div class="grid gap-4 md:grid-cols-2">
            <div><label class="fuwari-label">站点标题</label><input class="fuwari-input" [(ngModel)]="s.title" /></div>
            <div><label class="fuwari-label">副标题 / 个人签名</label><input class="fuwari-input" [(ngModel)]="s.subtitle" /></div>
            <div class="md:col-span-2"><label class="fuwari-label">站点描述（SEO）</label><textarea class="fuwari-input" rows="2" [(ngModel)]="s.description"></textarea></div>
            <div><label class="fuwari-label">关键词（逗号分隔）</label><input class="fuwari-input" [(ngModel)]="s.keywords" /></div>
            <div><label class="fuwari-label">作者</label><input class="fuwari-input" [(ngModel)]="s.author" /></div>
            <div>
              <label class="fuwari-label">头像</label>
              <div class="flex gap-2">
                <input class="fuwari-input" [(ngModel)]="s.avatar" />
                <button class="fuwari-btn shrink-0" (click)="pick('avatar')"><i class="fas fa-upload"></i></button>
              </div>
            </div>
            <div>
              <label class="fuwari-label">Favicon</label>
              <div class="flex gap-2">
                <input class="fuwari-input" [(ngModel)]="s.favicon" />
                <button class="fuwari-btn shrink-0" (click)="pick('favicon')"><i class="fas fa-upload"></i></button>
              </div>
            </div>
            <div><label class="fuwari-label">建站年份</label><input class="fuwari-input" type="number" [(ngModel)]="s.since" /></div>
            <div><label class="fuwari-label">每页文章数</label><input class="fuwari-input" type="number" min="1" [(ngModel)]="s.postsPerPage" /></div>
          </div>
        </div>

        <div class="fuwari-card p-5">
          <div class="fuwari-section-title mb-4">外观</div>
          <div class="grid gap-4 md:grid-cols-2">
            <div class="md:col-span-2 flex flex-wrap gap-5 text-sm">
              <label class="flex items-center gap-2"><input type="checkbox" [(ngModel)]="s.heroEnable" />显示顶部横幅</label>
              <label class="flex items-center gap-2"><input type="checkbox" [(ngModel)]="s.showCover" />列表显示封面</label>
              <label class="flex items-center gap-2"><input type="checkbox" [(ngModel)]="s.themeFixed" />固定主题色（隐藏调色盘）</label>
              <label class="flex items-center gap-2"><input type="checkbox" [(ngModel)]="s.busuanzi" />不蒜子访问统计</label>
            </div>
            <div class="md:col-span-2">
              <label class="fuwari-label">横幅图片</label>
              <div class="flex gap-2">
                <input class="fuwari-input" [(ngModel)]="s.heroImage" />
                <button class="fuwari-btn shrink-0" (click)="pick('heroImage')"><i class="fas fa-upload"></i></button>
              </div>
            </div>
            <div><label class="fuwari-label">横幅署名文字</label><input class="fuwari-input" [(ngModel)]="s.heroCreditText" /></div>
            <div><label class="fuwari-label">横幅署名链接</label><input class="fuwari-input" [(ngModel)]="s.heroCreditLink" /></div>
            <div class="md:col-span-2">
              <label class="fuwari-label">默认主题色相：{{ s.themeHue }}</label>
              <input type="range" min="0" max="360" step="5" class="fuwari-hue-slider" [(ngModel)]="s.themeHue" />
            </div>
          </div>
        </div>

        <div class="fuwari-card p-5">
          <div class="mb-4 flex items-center">
            <div class="fuwari-section-title">社交链接</div>
            <button class="fuwari-btn ml-auto !py-1 !text-xs" (click)="s.social.push({ icon: 'fab fa-github', label: '', url: '' })"><i class="fas fa-plus"></i>添加</button>
          </div>
          <p class="fuwari-muted mb-3 text-xs">图标使用 Font Awesome 类名，如 fab fa-github、fab fa-bilibili、fas fa-envelope、fab fa-weixin</p>
          @for (item of s.social; track $index) {
            <div class="mb-2 grid grid-cols-[2rem_1fr_1fr_2fr_auto] items-center gap-2">
              <i [class]="item.icon + ' text-center text-[var(--fuwari-primary)]'"></i>
              <input class="fuwari-input" [(ngModel)]="item.icon" placeholder="图标" />
              <input class="fuwari-input" [(ngModel)]="item.label" placeholder="名称" />
              <input class="fuwari-input" [(ngModel)]="item.url" placeholder="链接（mailto: 也可以）" />
              <button class="fuwari-tool-btn hover:!text-red-500" (click)="s.social.splice($index, 1)"><i class="far fa-trash-alt"></i></button>
            </div>
          }
        </div>

        <div class="fuwari-card p-5">
          <div class="mb-4 flex items-center">
            <div class="fuwari-section-title">额外顶部菜单</div>
            <button class="fuwari-btn ml-auto !py-1 !text-xs" (click)="s.menus.push({ name: '', url: '', blank: true })"><i class="fas fa-plus"></i>添加</button>
          </div>
          @for (item of s.menus; track $index) {
            <div class="mb-2 grid grid-cols-[1fr_2fr_auto_auto] items-center gap-2">
              <input class="fuwari-input" [(ngModel)]="item.name" placeholder="名称" />
              <input class="fuwari-input" [(ngModel)]="item.url" placeholder="链接" />
              <label class="flex items-center gap-1 text-xs whitespace-nowrap"><input type="checkbox" [(ngModel)]="item.blank" />新窗口</label>
              <button class="fuwari-tool-btn hover:!text-red-500" (click)="s.menus.splice($index, 1)"><i class="far fa-trash-alt"></i></button>
            </div>
          } @empty {
            <p class="fuwari-muted text-sm">暂无，内置菜单：首页 / 归档 / 分类 / 标签 / 关于</p>
          }
        </div>

        <div class="fuwari-card p-5">
          <div class="fuwari-section-title mb-2">Giscus 评论</div>
          <p class="fuwari-muted mb-4 text-xs">
            在 <a class="fuwari-link" href="https://giscus.app/zh-CN" target="_blank" rel="noopener">giscus.app</a>
            按提示开启仓库 Discussions 并安装 giscus App，然后把生成的 repo / repoId / category / categoryId 填到下面。
          </p>
          <div class="grid gap-4 md:grid-cols-2">
            <label class="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" [(ngModel)]="s.giscus.enable" />启用评论</label>
            <div><label class="fuwari-label">repo（用户名/仓库）</label><input class="fuwari-input" [(ngModel)]="s.giscus.repo" /></div>
            <div><label class="fuwari-label">repoId</label><input class="fuwari-input" [(ngModel)]="s.giscus.repoId" /></div>
            <div><label class="fuwari-label">category</label><input class="fuwari-input" [(ngModel)]="s.giscus.category" /></div>
            <div><label class="fuwari-label">categoryId</label><input class="fuwari-input" [(ngModel)]="s.giscus.categoryId" /></div>
            <div>
              <label class="fuwari-label">映射方式</label>
              <select class="fuwari-input" [(ngModel)]="s.giscus.mapping">
                <option value="pathname">pathname</option>
                <option value="url">url</option>
                <option value="title">title</option>
                <option value="og:title">og:title</option>
              </select>
            </div>
            <div>
              <label class="fuwari-label">输入框位置</label>
              <select class="fuwari-input" [(ngModel)]="s.giscus.inputPosition">
                <option value="top">顶部</option>
                <option value="bottom">底部</option>
              </select>
            </div>
            <div><label class="fuwari-label">语言</label><input class="fuwari-input" [(ngModel)]="s.giscus.lang" /></div>
          </div>
        </div>

        <div class="fuwari-card p-5">
          <div class="fuwari-section-title mb-4">版权与高级</div>
          <div class="grid gap-4 md:grid-cols-2">
            <div><label class="fuwari-label">文章许可协议</label><input class="fuwari-input" [(ngModel)]="s.license" /></div>
            <div><label class="fuwari-label">协议链接</label><input class="fuwari-input" [(ngModel)]="s.licenseUrl" /></div>
            <div class="md:col-span-2"><label class="fuwari-label">页脚自定义 HTML</label><textarea class="fuwari-input font-mono" rows="3" [(ngModel)]="s.footerHtml"></textarea></div>
            <div class="md:col-span-2"><label class="fuwari-label">注入 &lt;head&gt; 的 HTML（统计代码等，重新构建后生效）</label><textarea class="fuwari-input font-mono" rows="3" [(ngModel)]="s.headHtml"></textarea></div>
            <div><label class="fuwari-label">GitHub 图片 CDN 域名</label><input class="fuwari-input" [(ngModel)]="s.gitHubCDN" placeholder="cdn.jsdelivr.net" /></div>
            <div><label class="fuwari-label">部署钩子 URL（保存后自动请求）</label><input class="fuwari-input" [(ngModel)]="s.actionUrl" placeholder="Vercel / Netlify / Cloudflare Deploy Hook" /></div>
          </div>
        </div>
      }
    </div>
    <input #file type="file" accept="image/*" class="hidden" (change)="onFile($event)" />
  `,
})
export class SettingsPage {
  private store = inject(AdminStore)
  private toast = inject(ToastService)
  private git = inject(GitService)
  private cdr = inject(ChangeDetectorRef)
  s: BlogSettings | null = null
  readonly saving = signal(false)
  private target: 'avatar' | 'favicon' | 'heroImage' = 'avatar'

  constructor() {
    inject(BlogService).setTitle('站点设置')
    this.store
      .loadSettings()
      .then((s) => {
        s.social ||= []
        s.menus ||= []
        s.giscus ||= { enable: false, repo: '', repoId: '', category: '', categoryId: '', mapping: 'pathname', strict: '0', reactionsEnabled: '1', inputPosition: 'top', lang: 'zh-CN' }
        this.s = s
        this.cdr.markForCheck()
      })
      .catch((e) => this.toast.error('读取失败：' + e.message))
  }

  pick(target: 'avatar' | 'favicon' | 'heroImage') {
    this.target = target
    ;(document.querySelector('app-settings-page input[type=file]') as HTMLInputElement)?.click()
  }

  async onFile(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file || !this.s) return
    try {
      this.s[this.target] = await this.git.uploadImage(file)
      this.cdr.markForCheck()
      this.toast.success('上传成功')
    } catch (err: any) {
      this.toast.error('上传失败：' + err.message)
    }
  }

  async save() {
    if (!this.s) return
    this.saving.set(true)
    try {
      const s = { ...this.s, since: Number(this.s.since), postsPerPage: Number(this.s.postsPerPage) || 8, themeHue: Number(this.s.themeHue) }
      s.social = s.social.filter((x) => x.url)
      s.menus = s.menus.filter((x) => x.url && x.name)
      await this.store.saveSettings(s)
      this.toast.success('保存成功，重新部署后生效')
    } catch (e: any) {
      this.toast.error('保存失败：' + e.message)
    } finally {
      this.saving.set(false)
    }
  }
}

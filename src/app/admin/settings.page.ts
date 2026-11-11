import { ChangeDetectorRef, Component, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { AdminStore } from './admin-store.service'
import { ToastService } from '../services/toast.service'
import { BlogService } from '../services/blog.service'
import { GitService } from '../services/git.service'
import type { BlogSettings, MenuLink } from '../../shared/types'
import {
  DAILY_TEXT_SOURCES,
  parseDailySources,
  sourceText,
  dailyTextLimit,
} from '../../shared/daily-text'
import { LocalDemoService } from '../services/local-demo.service'
import { normalizeAnnouncementLink } from '../../shared/announcement'
import {
  normalizeThemeSettings,
  SIDEBAR_MODULES,
} from '../../shared/theme-settings'
import type { SidebarModule, SidebarSide } from '../../shared/types'
import { LoginPasswordComponent } from '../components/login-password.component'
import { normalizeCustomResources } from '../../shared/custom-resources'

@Component({
  selector: 'app-settings-page',
  imports: [FormsModule, LoginPasswordComponent],
  template: `
    <div class="flex flex-col gap-4">
      <div class="fuwari-card flex items-center p-5">
        <h1 class="fuwari-section-title !text-lg">站点设置</h1>
        <button
          class="fuwari-btn solid ml-auto"
          (click)="save()"
          [disabled]="saving() || !s"
        >
          <i
            [class]="
              saving() ? 'fas fa-spinner fa-spin' : 'fas fa-cloud-upload-alt'
            "
          ></i
          >保存
        </button>
      </div>

      @if (!s) {
        <div class="fuwari-card fuwari-muted p-16 text-center">
          <i class="fas fa-spinner fa-spin mr-2"></i>加载中…
        </div>
      } @else {
        <app-login-password />
        <div class="fuwari-card p-5">
          <div class="fuwari-section-title mb-4">基本信息</div>
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="fuwari-label">站点标题</label
              ><input class="fuwari-input" [(ngModel)]="s.title" />
            </div>
            <div>
              <label class="fuwari-label">副标题 / 个人签名</label
              ><input class="fuwari-input" [(ngModel)]="s.subtitle" />
            </div>
            <div class="md:col-span-2">
              <label class="fuwari-label">站点描述（SEO）</label
              ><textarea
                class="fuwari-input"
                rows="2"
                [(ngModel)]="s.description"
              ></textarea>
            </div>
            <div>
              <label class="fuwari-label">关键词（逗号分隔）</label
              ><input class="fuwari-input" [(ngModel)]="s.keywords" />
            </div>
            <div>
              <label class="fuwari-label">作者</label
              ><input class="fuwari-input" [(ngModel)]="s.author" />
            </div>
            <div>
              <label class="fuwari-label">头像</label>
              <div class="flex gap-2">
                <input class="fuwari-input" [(ngModel)]="s.avatar" />
                <button class="fuwari-btn shrink-0" (click)="pick('avatar')">
                  <i class="fas fa-upload"></i>
                </button>
              </div>
            </div>
            <div>
              <label class="fuwari-label">Favicon</label>
              <div class="flex gap-2">
                <input class="fuwari-input" [(ngModel)]="s.favicon" />
                <button class="fuwari-btn shrink-0" (click)="pick('favicon')">
                  <i class="fas fa-upload"></i>
                </button>
              </div>
            </div>
            <div>
              <label class="fuwari-label">建站年份</label
              ><input
                class="fuwari-input"
                type="number"
                [(ngModel)]="s.since"
              />
            </div>
            <div>
              <label class="fuwari-label">每页文章数</label
              ><input
                class="fuwari-input"
                type="number"
                min="1"
                [(ngModel)]="s.postsPerPage"
              />
            </div>
          </div>
        </div>

        <div class="fuwari-card p-5">
          <div class="fuwari-section-title mb-4">外观</div>
          <div class="grid gap-4 md:grid-cols-2">
            <label class="fuwari-label"
              >默认深浅色<select
                class="fuwari-input mt-1"
                [(ngModel)]="s.appearance"
              >
                <option value="system">跟随系统</option>
                <option value="light">浅色</option>
                <option value="dark">深色</option>
                <option value="auto">按时段切换</option>
              </select></label
            >
            @if (s.appearance === 'auto') {
              <label class="fuwari-label"
                >深色开始小时（0–23）<input
                  class="fuwari-input mt-1"
                  type="number"
                  min="0"
                  max="23"
                  step="1"
                  [(ngModel)]="s.darkStart"
              /></label>
              <label class="fuwari-label"
                >深色结束小时（0–23）<input
                  class="fuwari-input mt-1"
                  type="number"
                  min="0"
                  max="23"
                  step="1"
                  [(ngModel)]="s.darkEnd"
              /></label>
            }
            <p class="fuwari-muted text-xs md:col-span-2">
              访客手动选择优先。顶栏“恢复站点默认外观”可恢复系统或定时切换；开始和结束相同表示全天浅色。
            </p>
            <section
              class="rounded-2xl border border-[var(--fuwari-border)] p-4 md:col-span-2"
              aria-labelledby="sidebar-position-title"
            >
              <h3 class="fuwari-section-title mb-2" id="sidebar-position-title">
                桌面侧栏模块位置
              </h3>
              <p class="fuwari-muted mb-3 text-xs">
                每个模块可分别放在左侧或右侧，显示开关沿用下方主题设置。手机按原顺序显示一列；全宽文章隐藏全部侧栏。
              </p>
              <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                @for (module of sidebarModules; track module.key) {
                  <label class="fuwari-label"
                    >{{ module.label }}位置
                    <select
                      class="fuwari-input mt-1"
                      [ngModel]="s.sidebarPositions?.[module.key]"
                      (ngModelChange)="setSidebarPosition(module.key, $event)"
                    >
                      <option value="left">左侧</option>
                      <option value="right">右侧</option>
                    </select>
                  </label>
                }
              </div>
            </section>
            <div class="md:col-span-2 flex flex-wrap gap-5 text-sm">
              <label class="flex items-center gap-2"
                ><input
                  type="checkbox"
                  [(ngModel)]="s.heroEnable"
                />显示顶部横幅</label
              >
              <label class="flex items-center gap-2"
                ><input
                  type="checkbox"
                  [(ngModel)]="s.showCover"
                />列表显示封面</label
              >
              <label class="flex items-center gap-2"
                ><input
                  type="checkbox"
                  [(ngModel)]="s.themeFixed"
                />固定主题色（隐藏调色盘）</label
              >
              <label class="flex items-center gap-2"
                ><input
                  type="checkbox"
                  [(ngModel)]="s.busuanzi"
                />不蒜子访问统计</label
              >
            </div>
            <div class="md:col-span-2">
              <label class="fuwari-label">横幅图片</label>
              <div class="flex gap-2">
                <input class="fuwari-input" [(ngModel)]="s.heroImage" />
                <button class="fuwari-btn shrink-0" (click)="pick('heroImage')">
                  <i class="fas fa-upload"></i>
                </button>
              </div>
            </div>
            <div>
              <label class="fuwari-label">横幅署名文字</label
              ><input class="fuwari-input" [(ngModel)]="s.heroCreditText" />
            </div>
            <div>
              <label class="fuwari-label">横幅署名链接</label
              ><input class="fuwari-input" [(ngModel)]="s.heroCreditLink" />
            </div>
            <div class="md:col-span-2">
              <label class="fuwari-label">默认主题色相：{{ s.themeHue }}</label>
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                class="fuwari-hue-slider"
                [(ngModel)]="s.themeHue"
              />
            </div>
          </div>
        </div>

        <div class="fuwari-card p-5">
          <h2 class="fuwari-section-title mb-4">Fuwari 布局与阅读体验</h2>
          <div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            @for (option of themeToggles; track option.key) {
              <label class="flex items-center gap-2 text-sm"
                ><input type="checkbox" [(ngModel)]="s[option.key]" />{{
                  option.label
                }}</label
              >
            }
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <label class="fuwari-label"
              >列表方式<select
                class="fuwari-input mt-1"
                [(ngModel)]="s.listMode"
              >
                <option value="page">分页</option>
                <option value="scroll">自动加载 / 加载更多</option>
              </select></label
            >
            <label class="fuwari-label"
              >桌面封面列宽（200–360px）<input
                type="number"
                class="fuwari-input mt-1"
                min="200"
                max="360"
                [(ngModel)]="s.coverWidth"
            /></label>
            @for (option of themeTexts; track option.key) {
              <label class="fuwari-label"
                >{{ option.label
                }}<input class="fuwari-input mt-1" [(ngModel)]="s[option.key]"
              /></label>
            }
          </div>
        </div>

        <div class="fuwari-card p-5">
          <h2 class="fuwari-section-title mb-4">RSS 订阅</h2>
          <div class="flex flex-wrap gap-5 text-sm">
            <label class="flex items-center gap-2"
              ><input type="checkbox" [(ngModel)]="s.rssEnable" />启用 RSS
              订阅</label
            >
            <label class="flex items-center gap-2"
              ><input
                type="checkbox"
                [(ngModel)]="s.rssFullContent"
                [disabled]="!s.rssEnable"
              />普通文章 RSS 输出全文</label
            >
          </div>
          <p class="fuwari-muted mt-3 text-xs">
            关闭全文时只输出公开摘要。加密文章始终只输出公开摘要和阅读链接。正式站点重新构建后生效。
          </p>
        </div>
        <div class="fuwari-card p-5">
          <h2 class="fuwari-section-title mb-4">PWA 安装参数</h2>
          <label class="flex items-center gap-2 text-sm"
            ><input type="checkbox" [(ngModel)]="s.pwaEnable" />启用 PWA
            manifest</label
          >
          <div class="mt-4 grid gap-4 md:grid-cols-2">
            @for (option of pwaTexts; track option.key) {
              <label class="fuwari-label"
                >{{ option.label
                }}<input
                  class="fuwari-input mt-1"
                  [(ngModel)]="s[option.key]"
                  [disabled]="!s.pwaEnable"
              /></label>
            }
            <label class="fuwari-label"
              >主题色（六位 HEX）<input
                class="fuwari-input mt-1"
                [(ngModel)]="s.pwaThemeColor"
                [disabled]="!s.pwaEnable"
                placeholder="#b8a320"
            /></label>
            <label class="fuwari-label"
              >背景色（六位 HEX）<input
                class="fuwari-input mt-1"
                [(ngModel)]="s.pwaBackgroundColor"
                [disabled]="!s.pwaEnable"
                placeholder="#ffffff"
            /></label>
          </div>
          <p class="fuwari-muted mt-3 text-xs">
            名称留空取站点标题。安装图标放在 public/，填写相对 PNG
            路径；构建验证真实 192×192 或 512×512 尺寸。Maskable
            可留空，使用时请给图案留足安全区。这里只配置安装参数，不提供离线阅读；浏览器是否展示安装入口取决于其安装条件。
          </p>
        </div>
        <div class="fuwari-card p-5">
          <div class="fuwari-section-title mb-4">每日一言 / 每日文字</div>
          <div class="mb-4 flex flex-wrap gap-5 text-sm">
            <label class="flex items-center gap-2"
              ><input
                type="checkbox"
                [(ngModel)]="s.hitokotoEnable"
              />启用每日文字</label
            >
            <label class="flex items-center gap-2"
              ><input
                type="checkbox"
                [(ngModel)]="s.hitokotoShowTitle"
              />显示卡片标题</label
            >
            <label class="flex items-center gap-2"
              ><input
                type="checkbox"
                [(ngModel)]="s.hitokotoShowFrom"
              />显示作者与出处</label
            >
          </div>
          <div class="mb-4 grid gap-4 md:grid-cols-2">
            <div>
              <label for="daily-title" class="fuwari-label">卡片标题</label
              ><input
                id="daily-title"
                class="fuwari-input"
                [(ngModel)]="s.hitokotoTitle"
                [disabled]="s.hitokotoShowTitle === false"
                placeholder="今日一言"
              />
            </div>
            <div>
              <label for="daily-limit" class="fuwari-label"
                >每个来源最多显示字数</label
              ><input
                id="daily-limit"
                class="fuwari-input"
                type="number"
                min="100"
                max="4000"
                [(ngModel)]="s.hitokotoMaxLength"
              />
            </div>
          </div>
          <p class="fuwari-muted mb-4 text-xs">
            关闭“显示卡片标题”只隐藏标题，正文继续显示；关闭“启用每日文字”则不显示整个卡片，也不请求接口。
          </p>
          <label for="hitokoto-sources" class="fuwari-label"
            >文字来源（每行一个，最多 5 个）</label
          >
          <textarea
            id="hitokoto-sources"
            class="fuwari-input font-mono"
            rows="4"
            [(ngModel)]="s.hitokotoSources"
            placeholder="hitokoto"
            aria-describedby="hitokoto-help"
          ></textarea>
          <div class="mt-2 flex flex-wrap gap-2">
            @for (source of dailySources; track source.name) {
              <button
                type="button"
                class="fuwari-btn !py-1 !text-xs"
                (click)="addDailySource(source.name)"
              >
                + {{ source.label }}
              </button>
            }
          </div>
          <p
            id="hitokoto-help"
            class="fuwari-muted mt-2 text-xs leading-relaxed"
          >
            可填内置名或自定义接口，例如：我的句子 | https://example.com/quote |
            data.content。也支持 JSON
            数组和纯文本；取值路径可省略。某个来源末尾加“| 正文”可隐藏出处，加“|
            出处”可单独保留。接口需支持跨域，HTTPS 站点请使用 HTTPS 接口。
          </p>
          <div class="mt-4">
            <label for="daily-custom" class="fuwari-label"
              >自定义文字（可以只用自定义文字，不填接口）</label
            >
            <textarea
              id="daily-custom"
              class="fuwari-input"
              rows="3"
              [(ngModel)]="s.hitokotoCustomText"
              placeholder="今天是 {date}，{weekday}，记得记录生活。"
            ></textarea>
            <p class="fuwari-muted mt-2 text-xs">
              支持
              {{ '{date} {time} {weekday} {month} {day}' }}
              变量和多行文字；时间使用访客浏览器本地时间，刷新即更新，页面打开时自动随分钟变化。接口来源仍独立按天缓存，某个接口失败不影响其他内容。{{
                demo.active()
                  ? '本地演示保存后，查看博客即可预览。'
                  : '保存并重新部署后生效。'
              }}
            </p>
          </div>
        </div>

        <div class="fuwari-card p-5">
          <div class="fuwari-section-title mb-4">主页公告</div>
          <div class="mb-4 flex flex-wrap gap-5 text-sm">
            <label class="flex items-center gap-2"
              ><input
                type="checkbox"
                [(ngModel)]="s.announcementEnable"
              />启用主页公告</label
            >
            <label class="flex items-center gap-2"
              ><input
                type="checkbox"
                [(ngModel)]="s.announcementClosable"
              />允许访客关闭公告</label
            >
          </div>
          <div class="grid gap-4">
            <div>
              <label for="announcement-title-input" class="fuwari-label"
                >公告标题（可留空）</label
              ><input
                id="announcement-title-input"
                class="fuwari-input"
                [(ngModel)]="s.announcementTitle"
                placeholder="站点公告"
              />
            </div>
            <div>
              <label for="announcement-text" class="fuwari-label"
                >公告文本</label
              ><textarea
                id="announcement-text"
                class="fuwari-input"
                rows="4"
                [(ngModel)]="s.announcementText"
                placeholder="写下想告诉访客的消息…"
              ></textarea>
            </div>
            <div>
              <label for="announcement-link" class="fuwari-label"
                >详情链接（可留空）</label
              ><input
                id="announcement-link"
                class="fuwari-input"
                [(ngModel)]="s.announcementLink"
                placeholder="https://example.com/news 或 posts/news/"
              />
            </div>
          </div>
          <p class="fuwari-muted mt-3 text-xs leading-relaxed">
            在博客侧栏显示，文本保留换行，不解析
            HTML。访客关闭后当前公告不再显示；修改标题、文本或链接后会重新显示。关闭记录只影响当前浏览器，禁止关闭时公告始终显示。{{
              demo.active()
                ? '本地演示保存后可直接预览。'
                : '保存并重新部署后生效。'
            }}
          </p>
        </div>

        <div class="fuwari-card p-5">
          <div class="mb-4 flex items-center">
            <div class="fuwari-section-title">社交链接</div>
            <button
              class="fuwari-btn ml-auto !py-1 !text-xs"
              (click)="
                s.social.push({ icon: 'fab fa-github', label: '', url: '' })
              "
            >
              <i class="fas fa-plus"></i>添加
            </button>
          </div>
          <p class="fuwari-muted mb-3 text-xs">
            图标使用 Font Awesome 类名，如 fab fa-github、fab fa-bilibili、fas
            fa-envelope、fab fa-weixin
          </p>
          @for (item of s.social; track $index) {
            <div
              class="mb-2 grid grid-cols-[2rem_1fr_1fr_2fr_auto] items-center gap-2"
            >
              <i
                [class]="
                  item.icon + ' text-center text-[var(--fuwari-primary)]'
                "
              ></i>
              <input
                class="fuwari-input"
                [(ngModel)]="item.icon"
                placeholder="图标"
              />
              <input
                class="fuwari-input"
                [(ngModel)]="item.label"
                placeholder="名称"
              />
              <input
                class="fuwari-input"
                [(ngModel)]="item.url"
                placeholder="链接（mailto: 也可以）"
              />
              <button
                class="fuwari-tool-btn hover:!text-red-500"
                (click)="s.social.splice($index, 1)"
              >
                <i class="far fa-trash-alt"></i>
              </button>
            </div>
          }
        </div>

        <div class="fuwari-card p-5">
          <h2 class="fuwari-section-title mb-3">顶部菜单显示</h2>
          <div class="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            @for (toggle of menuToggles; track toggle.key) {
              <label class="flex items-center gap-2 text-sm"
                ><input type="checkbox" [(ngModel)]="s[toggle.key]" />{{
                  toggle.label
                }}</label
              >
            }
          </div>
          <div class="mb-4 flex items-center">
            <div class="fuwari-section-title">额外顶部菜单</div>
            <button
              class="fuwari-btn ml-auto !py-1 !text-xs"
              (click)="
                s.menus.push({
                  name: '',
                  url: '',
                  blank: true,
                  visible: true,
                  children: [],
                })
              "
              aria-label="添加一级菜单"
            >
              <i class="fas fa-plus"></i>添加
            </button>
          </div>
          <p class="fuwari-muted mb-3 text-xs">
            父菜单可填写链接，也可留空作为二级菜单分组。支持两级导航；隐藏项仍保留在设置中。显隐只控制导航入口，不限制页面访问。
          </p>
          @for (item of s.menus; track $index; let parentIndex = $index) {
            <div
              class="mb-3 rounded-xl border border-[var(--fuwari-border)] p-3"
            >
              <div class="mb-3 flex flex-wrap items-center gap-3">
                <span class="mr-auto text-sm font-semibold"
                  >菜单 {{ parentIndex + 1 }}</span
                >
                <label class="flex items-center gap-1 text-xs"
                  ><input
                    type="checkbox"
                    [(ngModel)]="item.visible"
                    [attr.aria-label]="'父菜单 ' + (parentIndex + 1) + ' 显示'"
                  />显示</label
                >
                <label class="flex items-center gap-1 text-xs"
                  ><input
                    type="checkbox"
                    [(ngModel)]="item.blank"
                    [attr.aria-label]="
                      '父菜单 ' + (parentIndex + 1) + ' 新窗口'
                    "
                  />新窗口</label
                >
                <button
                  class="fuwari-tool-btn hover:!text-red-500"
                  (click)="s.menus.splice(parentIndex, 1)"
                  [attr.aria-label]="'删除一级菜单 ' + (parentIndex + 1)"
                >
                  <i class="far fa-trash-alt" aria-hidden="true"></i>
                </button>
              </div>
              <div class="grid gap-3 md:grid-cols-2">
                <label class="fuwari-label"
                  >名称<input
                    class="fuwari-input mt-1"
                    [(ngModel)]="item.name"
                    placeholder="菜单名称"
                    [attr.aria-label]="'父菜单 ' + (parentIndex + 1) + ' 名称'"
                /></label>
                <label class="fuwari-label"
                  >链接（分组可留空）<input
                    class="fuwari-input mt-1"
                    [(ngModel)]="item.url"
                    placeholder="https://… 或站内 / 路径"
                    [attr.aria-label]="'父菜单 ' + (parentIndex + 1) + ' 链接'"
                /></label>
              </div>
              <div class="mt-3 border-l border-[var(--fuwari-border)] pl-3">
                @for (
                  child of item.children || [];
                  track $index;
                  let childIndex = $index
                ) {
                  <div
                    class="mb-3 rounded-lg bg-[var(--fuwari-primary-soft)] p-3"
                  >
                    <div class="mb-2 flex flex-wrap items-center gap-3">
                      <span class="mr-auto text-xs font-semibold"
                        >二级菜单 {{ childIndex + 1 }}</span
                      >
                      <label class="flex items-center gap-1 text-xs"
                        ><input
                          type="checkbox"
                          [(ngModel)]="child.visible"
                          [attr.aria-label]="
                            '子菜单 ' +
                            (parentIndex + 1) +
                            '-' +
                            (childIndex + 1) +
                            ' 显示'
                          "
                        />显示</label
                      >
                      <label class="flex items-center gap-1 text-xs"
                        ><input
                          type="checkbox"
                          [(ngModel)]="child.blank"
                          [attr.aria-label]="
                            '子菜单 ' +
                            (parentIndex + 1) +
                            '-' +
                            (childIndex + 1) +
                            ' 新窗口'
                          "
                        />新窗口</label
                      >
                      <button
                        class="fuwari-tool-btn hover:!text-red-500"
                        (click)="item.children?.splice(childIndex, 1)"
                        [attr.aria-label]="
                          '删除二级菜单 ' +
                          (parentIndex + 1) +
                          '-' +
                          (childIndex + 1)
                        "
                      >
                        <i class="far fa-trash-alt" aria-hidden="true"></i>
                      </button>
                    </div>
                    <div class="grid gap-2 md:grid-cols-2">
                      <label class="fuwari-label"
                        >名称<input
                          class="fuwari-input mt-1"
                          [(ngModel)]="child.name"
                          [attr.aria-label]="
                            '子菜单 ' +
                            (parentIndex + 1) +
                            '-' +
                            (childIndex + 1) +
                            ' 名称'
                          "
                      /></label>
                      <label class="fuwari-label"
                        >链接<input
                          class="fuwari-input mt-1"
                          [(ngModel)]="child.url"
                          placeholder="https://… 或站内 / 路径"
                          [attr.aria-label]="
                            '子菜单 ' +
                            (parentIndex + 1) +
                            '-' +
                            (childIndex + 1) +
                            ' 链接'
                          "
                      /></label>
                    </div>
                  </div>
                }
                <button
                  class="fuwari-btn !py-1 !text-xs"
                  (click)="addSubmenu(item)"
                  [attr.aria-label]="'添加二级菜单 ' + (parentIndex + 1)"
                >
                  <i class="fas fa-plus" aria-hidden="true"></i>添加二级菜单
                </button>
              </div>
            </div>
          } @empty {
            <p class="fuwari-muted text-sm">
              暂无额外菜单，可在上方选择内置菜单的显示状态。
            </p>
          }
        </div>

        <div class="fuwari-card p-5">
          <div class="fuwari-section-title mb-2">Giscus 评论</div>
          <p class="fuwari-muted mb-4 text-xs">
            在
            <a
              class="fuwari-link"
              href="https://giscus.app/zh-CN"
              target="_blank"
              rel="noopener"
              >giscus.app</a
            >
            按提示开启仓库 Discussions 并安装 giscus App，然后把生成的 repo /
            repoId / category / categoryId 填到下面。
          </p>
          <div class="grid gap-4 md:grid-cols-2">
            <label class="flex items-center gap-2 text-sm md:col-span-2"
              ><input
                type="checkbox"
                [(ngModel)]="s.giscus.enable"
              />启用评论</label
            >
            <div>
              <label class="fuwari-label">repo（用户名/仓库）</label
              ><input class="fuwari-input" [(ngModel)]="s.giscus.repo" />
            </div>
            <div>
              <label class="fuwari-label">repoId</label
              ><input class="fuwari-input" [(ngModel)]="s.giscus.repoId" />
            </div>
            <div>
              <label class="fuwari-label">category</label
              ><input class="fuwari-input" [(ngModel)]="s.giscus.category" />
            </div>
            <div>
              <label class="fuwari-label">categoryId</label
              ><input class="fuwari-input" [(ngModel)]="s.giscus.categoryId" />
            </div>
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
            <div>
              <label class="fuwari-label">语言</label
              ><input class="fuwari-input" [(ngModel)]="s.giscus.lang" />
            </div>
          </div>
        </div>

        <div class="fuwari-card p-5">
          <div class="fuwari-section-title mb-4">自定义 CSS / 外部资源</div>
          <div class="grid gap-4">
            <label class="flex items-center gap-2 text-sm"
              ><input
                type="checkbox"
                [(ngModel)]="s.customCssEnable"
              />启用自定义样式</label
            >
            <div>
              <label for="custom-css" class="fuwari-label">自定义 CSS</label
              ><textarea
                id="custom-css"
                class="fuwari-input font-mono"
                rows="6"
                [(ngModel)]="s.customCss"
                placeholder=".fuwari-footer { font-size: 14px; }"
              ></textarea>
            </div>
            <div>
              <label for="external-css" class="fuwari-label"
                >外部 CSS 地址（每行一个，可留空）</label
              ><textarea
                id="external-css"
                class="fuwari-input font-mono"
                rows="3"
                [(ngModel)]="externalCssText"
                placeholder="https://example.com/custom.css"
              ></textarea>
            </div>
            <label class="flex items-center gap-2 text-sm"
              ><input
                type="checkbox"
                [(ngModel)]="s.customJsEnable"
              />启用外部脚本</label
            >
            <div>
              <label for="external-js" class="fuwari-label"
                >外部 JS 地址（每行一个，可留空）</label
              ><textarea
                id="external-js"
                class="fuwari-input font-mono"
                rows="4"
                [(ngModel)]="externalJsText"
                placeholder="https://example.com/custom.js"
              ></textarea>
            </div>
          </div>
          <p class="fuwari-muted mt-3 text-xs leading-relaxed">
            CSS 只填写样式规则；资源支持 HTTPS 地址或站内路径，例如
            scripts/custom.js。重复地址会合并，与高级 head HTML
            中已有的同类资源也会去重。脚本按填写顺序延后执行。外部服务器需允许
            CORS，跨域加载不携带登录凭据，不发送来源信息。
          </p>
          <p class="fuwari-muted mt-2 text-xs leading-relaxed">
            这些资源在重新构建后生效，本地演示保存不会立即执行脚本。请只使用可信脚本，它们与站点拥有相同的页面权限，无法通过跨域属性隔离。这里的开关只控制本区配置，不控制高级
            head HTML 中手工添加的资源。
          </p>
        </div>

        <div class="fuwari-card p-5">
          <div class="fuwari-section-title mb-4">版权与高级</div>
          <div class="grid gap-4 md:grid-cols-2">
            <label class="fuwari-label"
              >ICP备案号<input class="fuwari-input mt-1" [(ngModel)]="s.beiAn"
            /></label>
            <label class="fuwari-label"
              >ICP备案查询链接<input
                class="fuwari-input mt-1"
                [(ngModel)]="s.beiAnLink"
                placeholder="https://beian.miit.gov.cn/"
            /></label>
            <label class="fuwari-label md:col-span-2"
              >公安备案号<input
                class="fuwari-input mt-1"
                [(ngModel)]="s.beiAnGongan"
                placeholder="浙公网安备 33000000000000 号"
            /></label>
            <div>
              <label class="fuwari-label">文章许可协议</label
              ><input class="fuwari-input" [(ngModel)]="s.license" />
            </div>
            <div>
              <label class="fuwari-label">协议链接</label
              ><input class="fuwari-input" [(ngModel)]="s.licenseUrl" />
            </div>
            <div class="md:col-span-2">
              <label class="fuwari-label">页脚自定义 HTML</label
              ><textarea
                class="fuwari-input font-mono"
                rows="3"
                [(ngModel)]="s.footerHtml"
              ></textarea>
            </div>
            <div class="md:col-span-2">
              <label class="fuwari-label"
                >注入 &lt;head&gt; 的 HTML（统计代码等，重新构建后生效）</label
              ><textarea
                class="fuwari-input font-mono"
                rows="3"
                [(ngModel)]="s.headHtml"
              ></textarea>
            </div>
            <div>
              <label class="fuwari-label">GitHub 图片 CDN 域名</label
              ><input
                class="fuwari-input"
                [(ngModel)]="s.gitHubCDN"
                placeholder="cdn.jsdelivr.net"
              />
            </div>
            <div>
              <label class="fuwari-label">部署钩子 URL（保存后自动请求）</label
              ><input
                class="fuwari-input"
                [(ngModel)]="s.actionUrl"
                placeholder="Vercel / Netlify / Cloudflare Deploy Hook"
              />
            </div>
          </div>
        </div>
      }
    </div>
    <input
      #file
      type="file"
      accept="image/*"
      class="hidden"
      (change)="onFile($event)"
    />
  `,
})
export class SettingsPage {
  readonly sidebarModules = SIDEBAR_MODULES
  readonly dailySources = DAILY_TEXT_SOURCES
  readonly demo = inject(LocalDemoService)
  private store = inject(AdminStore)
  private blog = inject(BlogService)
  private toast = inject(ToastService)
  private git = inject(GitService)
  private cdr = inject(ChangeDetectorRef)
  s: BlogSettings | null = null
  externalCssText = ''
  externalJsText = ''
  readonly saving = signal(false)
  private target: 'avatar' | 'favicon' | 'heroImage' = 'avatar'

  setSidebarPosition(key: SidebarModule, side: SidebarSide) {
    if (this.s) (this.s.sidebarPositions ||= {})[key] = side
  }
  addSubmenu(item: MenuLink) {
    ;(item.children ||= []).push({
      name: '',
      url: '',
      blank: true,
      visible: true,
    })
  }

  constructor() {
    inject(BlogService).setTitle('站点设置')
    this.store
      .loadSettings()
      .then((s) => {
        s.social ||= []
        s.menus ||= []
        s.hitokotoApi ||= ''
        s.hitokotoSources = sourceText(s)
        s.hitokotoEnable ??= true
        s.hitokotoShowTitle ??= true
        s.hitokotoTitle ||= '今日一言'
        s.hitokotoShowFrom ??= true
        s.hitokotoMaxLength = dailyTextLimit(s.hitokotoMaxLength)
        s.hitokotoCustomText ||= ''
        s.announcementEnable ??= false
        s.announcementTitle ??= '站点公告'
        s.announcementText ??= ''
        s.announcementLink ??= ''
        s.announcementClosable ??= true
        s.customCssEnable ??= true
        s.customCss ??= ''
        s.customExternalCss ??= []
        s.customJsEnable ??= true
        s.customExternalJs ??= []
        this.externalCssText = s.customExternalCss.join('\n')
        this.externalJsText = s.customExternalJs.join('\n')
        s.giscus ||= {
          enable: false,
          repo: '',
          repoId: '',
          category: '',
          categoryId: '',
          mapping: 'pathname',
          strict: '0',
          reactionsEnabled: '1',
          inputPosition: 'top',
          lang: 'zh-CN',
        }
        this.s = normalizeThemeSettings(s)
        this.cdr.markForCheck()
      })
      .catch((e) => this.toast.error('读取失败：' + e.message))
  }

  readonly themeToggles = [
    { key: 'coverDefault', label: '无封面时使用首页横幅' },
    { key: 'coverHover', label: '封面悬停放大' },
    { key: 'showSummary', label: '列表显示摘要' },
    { key: 'showListTags', label: '列表显示标签' },
    { key: 'latestPosts', label: '侧栏最新文章' },
    { key: 'contactEnable', label: '显示联系卡片' },
    { key: 'contactFlip', label: '联系卡片翻转' },
    { key: 'sidebarCategories', label: '侧栏分类' },
    { key: 'sidebarTags', label: '侧栏标签' },
    { key: 'sidebarStats', label: '侧栏统计' },
    { key: 'articleToc', label: '文章目录' },
    { key: 'floatComment', label: '浮动评论按钮' },
    { key: 'floatDark', label: '浮动深色按钮' },
    { key: 'articleCover', label: '文章封面' },
    { key: 'articleCoverTop', label: '封面位于文章卡片顶部' },
    { key: 'articleMeta', label: '文章元信息' },
    { key: 'articleShare', label: '文章分享条' },
    { key: 'articleCopyright', label: '版权声明' },
    { key: 'articleAdjacent', label: '上下篇文章' },
    { key: 'articleComment', label: '文章评论' },
  ] as const
  readonly menuToggles = [
    { key: 'menuHome', label: '首页菜单' },
    { key: 'menuArchive', label: '归档菜单' },
    { key: 'menuCategories', label: '分类菜单' },
    { key: 'menuTags', label: '标签菜单' },
    { key: 'menuMoments', label: '碎碎念菜单' },
    { key: 'menuAbout', label: '关于菜单' },
    { key: 'menuSearch', label: '搜索按钮' },
    { key: 'mobileMenu', label: '手机菜单按钮' },
  ] as const
  readonly themeTexts = [
    { key: 'profilePath', label: '个人页路径' },
    { key: 'contactTitle', label: '联系卡片标题' },
    { key: 'contactDescription', label: '正面说明' },
    { key: 'contactBadge', label: '正面徽标' },
    { key: 'contactUrl', label: '联系链接（https:// 或站内 / 路径）' },
    { key: 'contactText', label: '正面行动文案' },
    { key: 'contactBackTitle', label: '背面标题' },
    { key: 'contactBackDescription', label: '背面说明' },
    { key: 'contactBackText', label: '背面行动文案' },
  ] as const
  readonly pwaTexts = [
    { key: 'pwaName', label: '安装名称（可留空）' },
    { key: 'pwaShortName', label: '安装简称（可留空）' },
    { key: 'pwaIcon', label: 'Apple touch 图标（HTTPS 或站内路径，可留空）' },
    { key: 'pwaIcon192', label: '192×192 安装 PNG 路径' },
    { key: 'pwaIcon512', label: '512×512 安装 PNG 路径' },
    { key: 'pwaIcon192Maskable', label: '192×192 Maskable PNG（可留空）' },
    { key: 'pwaIcon512Maskable', label: '512×512 Maskable PNG（可留空）' },
  ] as const

  pick(target: 'avatar' | 'favicon' | 'heroImage') {
    this.target = target
    ;(
      document.querySelector(
        'app-settings-page input[type=file]',
      ) as HTMLInputElement
    )?.click()
  }

  addDailySource(name: string) {
    if (!this.s) return
    const lines = (this.s.hitokotoSources || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    if (lines.includes(name)) return
    if (lines.length >= 5) {
      this.toast.error('最多配置 5 个来源')
      return
    }
    this.s.hitokotoSources = [...lines, name].join('\n')
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
      const s = {
        ...normalizeThemeSettings(this.s),
        since: Number(this.s.since),
        postsPerPage: Number(this.s.postsPerPage) || 8,
        themeHue: Number(this.s.themeHue),
      }
      s.hitokotoSources = sourceText(s).trim()
      const sources =
        s.hitokotoEnable === false ? [] : parseDailySources(s.hitokotoSources)
      s.hitokotoCustomText = (s.hitokotoCustomText || '').trim()
      s.hitokotoTitle = (s.hitokotoTitle || '').trim() || '今日一言'
      s.hitokotoMaxLength = dailyTextLimit(s.hitokotoMaxLength)
      if (
        s.hitokotoEnable !== false &&
        !sources.length &&
        !s.hitokotoCustomText
      )
        throw new Error('请至少填写一个文字来源或自定义文字')
      s.announcementTitle = (s.announcementTitle || '').trim()
      s.announcementText = (s.announcementText || '').trim()
      s.announcementLink = (s.announcementLink || '').trim()
      if (s.announcementEnable)
        s.announcementLink = normalizeAnnouncementLink(s.announcementLink)
      s.customExternalCss = this.externalCssText
        .split(/\r?\n/)
        .map((url) => url.trim())
        .filter(Boolean)
      s.customExternalJs = this.externalJsText
        .split(/\r?\n/)
        .map((url) => url.trim())
        .filter(Boolean)
      Object.assign(s, normalizeCustomResources(s, this.blog.config.baseHref))
      s.social = s.social.filter((x) => x.url)
      await this.store.saveSettings(s)
      this.s = s
      this.externalCssText = s.customExternalCss.join('\n')
      this.externalJsText = s.customExternalJs.join('\n')
      this.cdr.markForCheck()
      this.toast.success(
        this.demo.active()
          ? '已保存到本地演示，查看博客即可预览'
          : '保存成功，重新部署后生效',
      )
    } catch (e: any) {
      this.toast.error('保存失败：' + e.message)
    } finally {
      this.saving.set(false)
    }
  }
}

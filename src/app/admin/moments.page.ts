import { Component, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { RouterLink } from '@angular/router'
import type { Moment } from '../../shared/types'
import {
  MOMENT_TEXT_LIMIT,
  formatMomentDate,
  momentDateInput,
} from '../../shared/moments'
import { AdminStore } from './admin-store.service'
import { BlogService } from '../services/blog.service'
import { LocalDemoService } from '../services/local-demo.service'
import { ToastService } from '../services/toast.service'

@Component({
  selector: 'app-admin-moments-page',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="flex flex-col gap-4">
      <header class="fuwari-card flex flex-wrap items-center gap-3 p-5">
        <h1 class="fuwari-section-title !text-lg">碎碎念管理</h1>
        <a class="fuwari-btn ml-auto !text-xs" routerLink="/moments"
          >查看时间线</a
        >
        <button
          class="fuwari-btn !text-xs"
          (click)="load()"
          [disabled]="loading() || busy()"
        >
          刷新
        </button>
      </header>
      @if (error()) {
        <div class="fuwari-card p-4 text-sm text-red-500" role="alert">
          {{ error() }}；请刷新重试，原数据不会被覆盖。
        </div>
      }
      @if (loading()) {
        <div class="fuwari-card fuwari-muted p-8 text-center">加载中…</div>
      } @else if (!error()) {
        <form class="fuwari-card p-5" (submit)="save($event)">
          <h2 class="fuwari-section-title mb-4">
            {{ editingId ? '编辑动态' : '发布动态' }}
          </h2>
          <label class="fuwari-label" for="moment-text">短文本</label>
          <textarea
            id="moment-text"
            class="fuwari-input"
            rows="5"
            name="text"
            [(ngModel)]="text"
            [disabled]="busy()"
            placeholder="此刻想说些什么…"
            required
          ></textarea>
          <p class="fuwari-muted mt-1 text-xs">
            {{ length() }} / {{ limit }} 字；纯文本，保留换行。
          </p>
          <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label class="fuwari-label flex-1"
              >发布时间<input
                class="fuwari-input mt-1"
                type="datetime-local"
                name="date"
                [(ngModel)]="dateInput"
                [disabled]="busy()"
                required
            /></label>
            @if (editingId) {
              <button
                class="fuwari-btn"
                type="button"
                (click)="cancelEdit()"
                [disabled]="busy()"
              >
                取消编辑
              </button>
            }
            <button
              class="fuwari-btn solid"
              type="submit"
              [disabled]="busy() || !text.trim() || length() > limit"
            >
              {{ busy() ? '保存中…' : editingId ? '保存修改' : '发布动态' }}
            </button>
          </div>
          <p class="fuwari-muted mt-3 text-xs">
            {{
              demo.active()
                ? '只保存到当前浏览器，本地时间线可即时预览。'
                : '通过 Git API 保存，重新构建部署后公开展示。'
            }}
          </p>
        </form>
        @for (item of store.moments(); track item.id) {
          <article class="fuwari-card p-5">
            <time class="fuwari-muted text-xs" [attr.datetime]="item.date">{{
              date(item.date)
            }}</time>
            <p class="my-3 whitespace-pre-line break-words text-sm leading-7">
              {{ item.text }}
            </p>
            @if (deleteId() === item.id) {
              <div
                class="flex flex-wrap items-center gap-2 text-sm"
                role="group"
                aria-label="删除动态确认"
              >
                <span>确定删除这条动态？</span
                ><button
                  class="fuwari-btn danger !text-xs"
                  (click)="remove(item.id)"
                  [disabled]="busy()"
                >
                  确定删除</button
                ><button
                  class="fuwari-btn !text-xs"
                  (click)="deleteId.set('')"
                  [disabled]="busy()"
                >
                  取消删除
                </button>
              </div>
            } @else {
              <div class="flex gap-2">
                <button
                  class="fuwari-btn !text-xs"
                  (click)="edit(item)"
                  [disabled]="busy()"
                >
                  编辑动态</button
                ><button
                  class="fuwari-btn danger !text-xs"
                  (click)="deleteId.set(item.id)"
                  [disabled]="busy()"
                >
                  删除动态
                </button>
              </div>
            }
          </article>
        } @empty {
          <div class="fuwari-card fuwari-muted p-8 text-center text-sm">
            还没有动态，写下第一条吧。
          </div>
        }
      }
    </div>
  `,
})
export class AdminMomentsPage {
  readonly store = inject(AdminStore)
  readonly demo = inject(LocalDemoService)
  private toast = inject(ToastService)
  readonly loading = signal(true)
  readonly busy = signal(false)
  readonly error = signal('')
  readonly deleteId = signal('')
  readonly limit = MOMENT_TEXT_LIMIT
  readonly date = formatMomentDate
  editingId = ''
  text = ''
  dateInput = momentDateInput(new Date().toISOString())
  private originalDate = ''
  private original?: Moment
  constructor() {
    inject(BlogService).setTitle('碎碎念管理')
    void this.load()
  }
  length() {
    return Array.from(this.text).length
  }
  async load() {
    if (this.busy()) return
    this.loading.set(true)
    this.error.set('')
    try {
      await this.store.loadMoments()
    } catch (e: any) {
      this.error.set(e.message)
    } finally {
      this.loading.set(false)
    }
  }
  edit(item: Moment) {
    this.original = { ...item }
    this.editingId = item.id
    this.text = item.text
    this.originalDate = item.date
    this.dateInput = momentDateInput(item.date)
    this.deleteId.set('')
    document.getElementById('moment-text')?.focus()
  }
  cancelEdit() {
    this.original = undefined
    this.editingId = this.text = this.originalDate = ''
    this.dateInput = momentDateInput(new Date().toISOString())
  }
  async save(event: Event) {
    event.preventDefault()
    if (this.busy() || this.loading() || this.error()) return
    this.busy.set(true)
    try {
      const date =
        this.originalDate &&
        this.dateInput === momentDateInput(this.originalDate)
          ? this.originalDate
          : new Date(this.dateInput).toISOString()
      await this.store.saveMoment(
        {
          id: this.editingId || crypto.randomUUID(),
          date,
          text: this.text,
          ...(this.editingId ? { updated: new Date().toISOString() } : {}),
        },
        !!this.editingId,
        this.original,
      )
      this.cancelEdit()
      this.toast.success(
        this.demo.active() ? '已保存到本地演示' : '动态已提交，等待重新部署',
      )
    } catch (e: any) {
      this.toast.error('保存失败：' + e.message)
    } finally {
      this.busy.set(false)
    }
  }
  async remove(id: string) {
    if (this.busy() || this.deleteId() !== id) return
    this.busy.set(true)
    try {
      await this.store.deleteMoment(id)
      if (this.editingId === id) this.cancelEdit()
      this.deleteId.set('')
      this.toast.success('动态已删除')
    } catch (e: any) {
      this.toast.error('删除失败：' + e.message)
    } finally {
      this.busy.set(false)
    }
  }
}

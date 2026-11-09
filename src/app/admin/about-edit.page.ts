import { Component, inject, signal } from '@angular/core'
import { AdminStore } from './admin-store.service'
import { MdEditorComponent } from './md-editor.component'
import { ToastService } from '../services/toast.service'
import { BlogService } from '../services/blog.service'

@Component({
  selector: 'app-about-edit-page',
  imports: [MdEditorComponent],
  template: `
    <div class="flex flex-col gap-4">
      <div class="fuwari-card flex items-center p-5">
        <h1 class="fuwari-section-title !text-lg">关于页面</h1>
        <button class="fuwari-btn solid ml-auto" (click)="save()" [disabled]="saving() || loading()">
          <i [class]="saving() ? 'fas fa-spinner fa-spin' : 'fas fa-cloud-upload-alt'"></i>保存
        </button>
      </div>
      @if (loading()) {
        <div class="fuwari-card fuwari-muted p-16 text-center"><i class="fas fa-spinner fa-spin mr-2"></i>加载中…</div>
      } @else {
        <app-md-editor [(value)]="body" />
      }
    </div>
  `,
})
export class AboutEditPage {
  private store = inject(AdminStore)
  private toast = inject(ToastService)
  body = ''
  readonly loading = signal(true)
  readonly saving = signal(false)
  constructor() {
    inject(BlogService).setTitle('关于页面')
    this.store
      .loadAbout()
      .then((md) => (this.body = md))
      .catch((e) => this.toast.error('读取失败：' + e.message))
      .finally(() => this.loading.set(false))
  }
  async save() {
    this.saving.set(true)
    try {
      await this.store.saveAbout(this.body)
      this.toast.success('保存成功')
    } catch (e: any) {
      this.toast.error('保存失败：' + e.message)
    } finally {
      this.saving.set(false)
    }
  }
}

import { Component, ElementRef, computed, inject, model, signal, viewChild } from '@angular/core'
import { DomSanitizer } from '@angular/platform-browser'
import { renderMarkdown } from '../../shared/markdown'
import { GitService } from '../services/git.service'
import { ToastService } from '../services/toast.service'

type Mode = 'split' | 'edit' | 'preview'

/** Markdown 编辑器：工具栏 + 实时预览 + 图片上传（按钮/粘贴/拖拽） */
@Component({
  selector: 'app-md-editor',
  template: `
    <div class="overflow-hidden rounded-2xl border border-[var(--fuwari-border)]">
      <div class="flex flex-wrap items-center gap-0.5 border-b border-[var(--fuwari-border)] bg-[var(--fuwari-bg-soft)] px-2 py-1.5">
        @for (b of tools; track b.title) {
          <button type="button" class="fuwari-tool-btn !h-8 !w-8 text-sm" [title]="b.title" (click)="b.run()"><i [class]="b.icon"></i></button>
        }
        <button type="button" class="fuwari-tool-btn !h-8 !w-8 text-sm" title="上传图片" (click)="fileInput.click()">
          <i [class]="uploading() ? 'fas fa-spinner fa-spin' : 'far fa-image'"></i>
        </button>
        <input #fileInput type="file" accept="image/*" class="hidden" (change)="onFile($event)" />
        <div class="ml-auto flex gap-0.5">
          @for (m of modes; track m.v) {
            <button type="button" class="fuwari-tool-btn !h-8 !w-auto px-2 text-xs" [class.!text-[var(--fuwari-primary)]]="mode() === m.v" [class.!bg-[var(--fuwari-primary-soft)]]="mode() === m.v" (click)="mode.set(m.v)">
              <i [class]="m.icon + ' mr-1'"></i>{{ m.name }}
            </button>
          }
        </div>
      </div>
      <div class="grid" [class.md:grid-cols-2]="mode() === 'split'">
        @if (mode() !== 'preview') {
          <textarea
            #ta
            class="block w-full resize-none border-0 bg-[var(--fuwari-surface)] p-4 font-mono text-sm leading-7 text-[var(--fuwari-text)] outline-none"
            [style.height]="height"
            [value]="value()"
            (input)="value.set($any($event.target).value)"
            (keydown)="onKey($event)"
            (paste)="onPaste($event)"
            (drop)="onDrop($event)"
            (scroll)="syncScroll()"
            placeholder="使用 Markdown 书写正文，支持粘贴/拖拽图片上传…"
          ></textarea>
        }
        @if (mode() !== 'edit') {
          <div #pv class="prose-blog overflow-y-auto border-[var(--fuwari-border)] bg-[var(--fuwari-surface)] p-4 md:border-l" [style.height]="height" [innerHTML]="preview()"></div>
        }
      </div>
    </div>
  `,
})
export class MdEditorComponent {
  private git = inject(GitService)
  private toast = inject(ToastService)
  private sanitizer = inject(DomSanitizer)
  readonly value = model('')
  readonly mode = signal<Mode>(window.innerWidth < 768 ? 'edit' : 'split')
  readonly uploading = signal(false)
  readonly height = 'calc(100vh - 240px)'
  private ta = viewChild<ElementRef<HTMLTextAreaElement>>('ta')
  private pv = viewChild<ElementRef<HTMLElement>>('pv')
  readonly preview = computed(() => this.sanitizer.bypassSecurityTrustHtml(renderMarkdown(this.value()).html))
  readonly modes: { v: Mode; name: string; icon: string }[] = [
    { v: 'edit', name: '编辑', icon: 'fas fa-pen' },
    { v: 'split', name: '分屏', icon: 'fas fa-columns' },
    { v: 'preview', name: '预览', icon: 'far fa-eye' },
  ]
  readonly tools = [
    { title: '标题', icon: 'fas fa-heading', run: () => this.linePrefix('## ') },
    { title: '粗体 (Ctrl+B)', icon: 'fas fa-bold', run: () => this.wrap('**', '**', '粗体') },
    { title: '斜体 (Ctrl+I)', icon: 'fas fa-italic', run: () => this.wrap('*', '*', '斜体') },
    { title: '删除线', icon: 'fas fa-strikethrough', run: () => this.wrap('~~', '~~', '删除线') },
    { title: '引用', icon: 'fas fa-quote-left', run: () => this.linePrefix('> ') },
    { title: '无序列表', icon: 'fas fa-list-ul', run: () => this.linePrefix('- ') },
    { title: '有序列表', icon: 'fas fa-list-ol', run: () => this.linePrefix('1. ') },
    { title: '任务列表', icon: 'far fa-check-square', run: () => this.linePrefix('- [ ] ') },
    { title: '链接 (Ctrl+K)', icon: 'fas fa-link', run: () => this.wrap('[', '](https://)', '链接文字') },
    { title: '行内代码', icon: 'fas fa-code', run: () => this.wrap('`', '`', 'code') },
    { title: '代码块', icon: 'fas fa-file-code', run: () => this.wrap('\n```js\n', '\n```\n', '// code') },
    { title: '表格', icon: 'fas fa-table', run: () => this.insert('\n| 列1 | 列2 |\n| --- | --- |\n| 内容 | 内容 |\n') },
    { title: '分隔线', icon: 'fas fa-minus', run: () => this.insert('\n---\n') },
  ]

  private el() {
    return this.ta()?.nativeElement
  }

  private replaceRange(start: number, end: number, text: string, selStart: number, selEnd: number) {
    const v = this.value()
    this.value.set(v.slice(0, start) + text + v.slice(end))
    const ta = this.el()
    if (ta) {
      ta.value = this.value()
      ta.focus()
      ta.setSelectionRange(selStart, selEnd)
    }
  }

  wrap(before: string, after: string, placeholder: string) {
    const ta = this.el()
    const s = ta?.selectionStart ?? this.value().length
    const e = ta?.selectionEnd ?? s
    const sel = this.value().slice(s, e) || placeholder
    this.replaceRange(s, e, before + sel + after, s + before.length, s + before.length + sel.length)
  }

  insert(text: string) {
    const ta = this.el()
    const s = ta?.selectionStart ?? this.value().length
    const e = ta?.selectionEnd ?? s
    this.replaceRange(s, e, text, s + text.length, s + text.length)
  }

  linePrefix(prefix: string) {
    const ta = this.el()
    const v = this.value()
    const s = ta?.selectionStart ?? v.length
    const e = ta?.selectionEnd ?? s
    const lineStart = v.lastIndexOf('\n', s - 1) + 1
    const block = v.slice(lineStart, e)
    const next = block
      .split('\n')
      .map((l) => prefix + l)
      .join('\n')
    this.replaceRange(lineStart, e, next, lineStart + next.length, lineStart + next.length)
  }

  onKey(e: KeyboardEvent) {
    if (e.key === 'Tab') {
      e.preventDefault()
      this.insert('  ')
      return
    }
    if (!(e.ctrlKey || e.metaKey)) return
    const k = e.key.toLowerCase()
    if (k === 'b') {
      e.preventDefault()
      this.wrap('**', '**', '粗体')
    } else if (k === 'i') {
      e.preventDefault()
      this.wrap('*', '*', '斜体')
    } else if (k === 'k') {
      e.preventDefault()
      this.wrap('[', '](https://)', '链接文字')
    }
  }

  syncScroll() {
    const ta = this.el()
    const pv = this.pv()?.nativeElement
    if (!ta || !pv) return
    const ratio = ta.scrollTop / Math.max(1, ta.scrollHeight - ta.clientHeight)
    pv.scrollTop = ratio * (pv.scrollHeight - pv.clientHeight)
  }

  onFile(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (file) this.upload(file)
  }

  onPaste(e: ClipboardEvent) {
    const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'))
    if (file) {
      e.preventDefault()
      this.upload(file)
    }
  }

  onDrop(e: DragEvent) {
    const file = [...(e.dataTransfer?.files || [])].find((f) => f.type.startsWith('image/'))
    if (file) {
      e.preventDefault()
      this.upload(file)
    }
  }

  async upload(file: File) {
    if (this.uploading()) return
    this.uploading.set(true)
    try {
      const url = await this.git.uploadImage(file)
      this.insert(`![${file.name.replace(/\.[^.]+$/, '')}](${url})`)
      this.toast.success('图片上传成功')
    } catch (e: any) {
      this.toast.error('图片上传失败：' + e.message)
    } finally {
      this.uploading.set(false)
    }
  }
}

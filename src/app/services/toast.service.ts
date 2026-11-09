import { Injectable, signal } from '@angular/core'

export interface Toast {
  id: number
  type: 'success' | 'error' | 'info'
  text: string
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([])
  private id = 0

  show(text: string, type: Toast['type'] = 'info', duration = 3500) {
    const t = { id: ++this.id, type, text }
    this.toasts.update((l) => [...l, t])
    setTimeout(() => this.toasts.update((l) => l.filter((x) => x.id !== t.id)), duration)
  }
  success(text: string) {
    this.show(text, 'success')
  }
  error(text: string) {
    this.show(text, 'error', 6000)
  }
}

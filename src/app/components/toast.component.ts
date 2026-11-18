import { Component, inject } from '@angular/core'
import { ToastService } from '../services/toast.service'

@Component({
  selector: 'app-toast',
  template: `
    <div
      class="pointer-events-none fixed top-20 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2"
    >
      @for (t of toast.toasts(); track t.id) {
        <div
          class="fuwari-card pointer-events-auto flex max-w-[90vw] items-center gap-2 px-4 py-2.5 text-sm shadow-lg"
          [attr.role]="t.type === 'error' ? 'alert' : 'status'"
          aria-atomic="true"
        >
          @switch (t.type) {
            @case ('success') {
              <i class="fas fa-check-circle text-green-500"></i>
            }
            @case ('error') {
              <i class="fas fa-times-circle text-red-500"></i>
            }
            @default {
              <i class="fas fa-info-circle text-[var(--fuwari-primary)]"></i>
            }
          }
          <span class="break-all">{{ t.text }}</span>
        </div>
      }
    </div>
  `,
})
export class ToastComponent {
  readonly toast = inject(ToastService)
}

import { Component, inject, signal } from '@angular/core'
import { RouterLink } from '@angular/router'
import { BlogService } from '../services/blog.service'

@Component({
  selector: 'app-contact-card',
  imports: [RouterLink],
  template: `
    @if (s().contactEnable) {
      <section
        class="contact-card"
        [class.flipped]="flipped() && s().contactFlip"
      >
        <div
          class="contact-inner"
          (mouseenter)="hover(true)"
          (mouseleave)="hover(false)"
          [class.can-flip]="s().contactFlip"
        >
          <div
            class="fuwari-card contact-front p-5"
            [attr.inert]="flipped() && s().contactFlip ? '' : null"
          >
            <div class="flex items-center justify-between gap-2">
              <h2 class="font-semibold">{{ s().contactTitle }}</h2>
              <span class="fuwari-chip !text-xs">{{ s().contactBadge }}</span>
            </div>
            <p class="fuwari-muted my-3 text-sm">
              {{ s().contactDescription }}
            </p>
            @if (url()) {
              @if (external()) {
                <a
                  class="fuwari-link text-sm"
                  [href]="url()"
                  target="_blank"
                  rel="noopener noreferrer"
                  >{{ s().contactText }} →</a
                >
              } @else {
                <a class="fuwari-link text-sm" [routerLink]="url()"
                  >{{ s().contactText }} →</a
                >
              }
            }
          </div>
          @if (s().contactFlip) {
            <div
              class="fuwari-card contact-back p-5"
              [attr.inert]="!flipped() ? '' : null"
            >
              <h2 class="font-semibold">{{ s().contactBackTitle }}</h2>
              <p class="fuwari-muted my-3 text-sm">
                {{ s().contactBackDescription }}
              </p>
              @if (url()) {
                @if (external()) {
                  <a
                    class="fuwari-link text-sm"
                    [href]="url()"
                    target="_blank"
                    rel="noopener noreferrer"
                    >{{ s().contactBackText }} →</a
                  >
                } @else {
                  <a class="fuwari-link text-sm" [routerLink]="url()"
                    >{{ s().contactBackText }} →</a
                  >
                }
              }
            </div>
          }
        </div>
        @if (s().contactFlip) {
          <button
            type="button"
            class="fuwari-btn mt-2 w-full justify-center !text-xs"
            [attr.aria-pressed]="flipped()"
            (click)="flipped.set(!flipped())"
          >
            {{ flipped() ? '查看正面' : '查看背面' }}
          </button>
        }
      </section>
    }
  `,
})
export class ContactCardComponent {
  readonly s = inject(BlogService).settings
  readonly flipped = signal(false)
  hover(value: boolean) {
    if (matchMedia('(hover: hover)').matches) this.flipped.set(value)
  }
  url() {
    const value = (this.s().contactUrl || '').trim()
    return /^(https?:\/\/|\/[^/])/.test(value) ? value : ''
  }
  external() {
    return /^https?:\/\//.test(this.url())
  }
}

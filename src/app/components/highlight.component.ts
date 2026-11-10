import { Component, computed, input } from '@angular/core'

@Component({
  selector: 'app-highlight',
  template: `@for (part of parts(); track $index) {
    @if (part.hit) {
      <mark class="search-highlight">{{ part.text }}</mark>
    } @else {
      {{ part.text }}
    }
  }`,
})
export class HighlightComponent {
  readonly text = input('')
  readonly query = input('')
  readonly parts = computed(() => {
    const words = [
      ...new Set(this.query().trim().split(/\s+/).filter(Boolean)),
    ].sort((a, b) => b.length - a.length)
    if (!words.length) return [{ text: this.text(), hit: false }]
    const pattern = words
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')
    return this.text()
      .split(new RegExp('(' + pattern + ')', 'gi'))
      .map((text, i) => ({ text, hit: i % 2 === 1 }))
  })
}

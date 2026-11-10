import { DestroyRef, Injectable, inject, signal } from '@angular/core'

@Injectable({ providedIn: 'root' })
export class AnnouncementStateService {
  private readonly key = `navblog:announcement:v1:${new URL(document.baseURI).pathname}`
  readonly dismissed = signal(this.readDismissed())

  constructor() {
    const onStorage = (event: StorageEvent) => {
      if (event.key === this.key || event.key === null) this.dismissed.set(this.readDismissed())
    }
    window.addEventListener('storage', onStorage)
    inject(DestroyRef).onDestroy(() => window.removeEventListener('storage', onStorage))
  }

  dismiss(version: string) {
    this.dismissed.set(version)
    try { localStorage.setItem(this.key, version) } catch {}
  }

  private readDismissed(): string {
    try { return localStorage.getItem(this.key) || '' } catch { return '' }
  }
}

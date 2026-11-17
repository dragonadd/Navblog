import {
  ApplicationConfig,
  provideZonelessChangeDetection,
} from '@angular/core'
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
} from '@angular/router'
import { routes } from './app.routes'
import { ViewportScroller } from '@angular/common'
import { PageViewportScroller } from './services/page-scroll.service'

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    { provide: ViewportScroller, useClass: PageViewportScroller },
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({
        scrollPositionRestoration: 'top',
        anchorScrolling: 'enabled',
      }),
    ),
  ],
}

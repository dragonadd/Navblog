import {
  ApplicationConfig,
  provideZonelessChangeDetection,
} from '@angular/core'
import { provideHttpClient, withJsonpSupport } from '@angular/common/http'
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
} from '@angular/router'
import { routes } from './app.routes'

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideHttpClient(withJsonpSupport()),
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

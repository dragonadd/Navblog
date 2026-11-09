// Blog based on https://github.com/xjh22222228/nav (GPL-3.0)
import { bootstrapApplication } from '@angular/platform-browser'
import { appConfig } from './app/app.config'
import { AppComponent } from './app/app.component'

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err))

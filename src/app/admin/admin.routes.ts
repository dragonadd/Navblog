import { Routes, CanActivateFn, Router } from '@angular/router'
import { inject } from '@angular/core'
import { GitService } from '../services/git.service'
import { AdminLayout } from './admin-layout.component'
import { LocalDemoService } from '../services/local-demo.service'

const authGuard: CanActivateFn = () => {
  const git = inject(GitService)
  return inject(LocalDemoService).active() || git.isLogin()
    ? true
    : inject(Router).createUrlTree(['/admin/login'])
}

export const adminRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login.page').then((m) => m.LoginPage),
  },
  {
    path: '',
    component: AdminLayout,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./posts.page').then((m) => m.AdminPostsPage),
      },
      {
        path: 'new',
        loadComponent: () => import('./editor.page').then((m) => m.EditorPage),
      },
      {
        path: 'edit/:slug',
        loadComponent: () => import('./editor.page').then((m) => m.EditorPage),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./settings.page').then((m) => m.SettingsPage),
      },
      {
        path: 'about',
        loadComponent: () =>
          import('./about-edit.page').then((m) => m.AboutEditPage),
      },
      {
        path: 'moments',
        loadComponent: () =>
          import('./moments.page').then((m) => m.AdminMomentsPage),
      },
    ],
  },
]

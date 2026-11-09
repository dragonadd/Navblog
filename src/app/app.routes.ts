import { Routes } from '@angular/router'
import { HomePage } from './pages/home.page'

export const routes: Routes = [
  { path: '', component: HomePage },
  { path: 'page/:page', component: HomePage },
  { path: 'posts/:slug', loadComponent: () => import('./pages/post.page').then((m) => m.PostPage) },
  { path: 'archive', loadComponent: () => import('./pages/archive.page').then((m) => m.ArchivePage) },
  { path: 'categories', loadComponent: () => import('./pages/taxonomy.page').then((m) => m.TaxonomyPage), data: { type: 'category' } },
  { path: 'categories/:name', loadComponent: () => import('./pages/taxonomy.page').then((m) => m.TaxonomyPage), data: { type: 'category' } },
  { path: 'tags', loadComponent: () => import('./pages/taxonomy.page').then((m) => m.TaxonomyPage), data: { type: 'tag' } },
  { path: 'tags/:name', loadComponent: () => import('./pages/taxonomy.page').then((m) => m.TaxonomyPage), data: { type: 'tag' } },
  { path: 'search', loadComponent: () => import('./pages/search.page').then((m) => m.SearchPage) },
  { path: 'about', loadComponent: () => import('./pages/about.page').then((m) => m.AboutPage) },
  { path: 'admin', loadChildren: () => import('./admin/admin.routes').then((m) => m.adminRoutes) },
  { path: '**', loadComponent: () => import('./pages/not-found.page').then((m) => m.NotFoundPage) },
]

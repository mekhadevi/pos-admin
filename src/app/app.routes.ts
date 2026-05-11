import { Routes } from '@angular/router';
import { PosDashboard } from './features/pos/pages/pos-dashboard/pos-dashboard';
import { Layout } from './core/layout/layout';
//import { Reports } from './reports/reports/reports';
import { Login } from './pages/login/login';
import { Dashboard } from './pages/dashboard/dashboard';
import { Products } from './pages/products/products';
import { Pos } from './pages/pos/pos';
import { Inventory } from './pages/inventory/inventory';
import { Reports } from './pages/reports/reports';

export const routes: Routes = [
  // Redirect root to login
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  //  ROUTE 1: No Layout (No Sidebar/Topbar)
  {
    path: 'login',
    component: Login,
  },
  //  DASHBOARD (NO layout)
  {
    path: 'dashboard',
    component: Dashboard,
  },
  { path: 'products', component: Products },
  { path: 'pos', component: Pos },
  { path: 'inventory', component: Inventory },
  { path: 'reports', component: Reports },
  {
    path: 'customers',
    loadComponent: () => import('./pages/customers/customers').then((m) => m.Customers),
  },
  {
    path: 'suppliers',
    loadComponent: () => import('./pages/suppliers/suppliers').then((m) => m.Suppliers),
  },
  {
    path: 'receipts',
    loadComponent: () => import('./pages/receipts/receipts').then((m) => m.Receipts),
  },
  { path: 'backup', loadComponent: () => import('./pages/backup/backup').then((m) => m.Backup) },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings').then((m) => m.Settings),
  },
  //  ROUTE 2: Layout Wrapper (Contains Sidebar/Topbar)
  {
    path: '',
    component: Layout,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: Dashboard },
      { path: 'posdashboard', component: PosDashboard },
      { path: 'reports', component: Reports },
    ],
  },

  // Redirect any unknown paths to login
  { path: '**', redirectTo: 'login' },
];

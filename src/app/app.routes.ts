import { Routes } from '@angular/router';
import { PosDashboard } from './features/pos/pages/pos-dashboard/pos-dashboard';
import { Layout } from './core/layout/layout';
import { Reports } from './reports/reports/reports';
import { Login } from './pages/login/login';
import { Dashboard } from './pages/dashboard/dashboard';
import { Products } from './pages/products/products';

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

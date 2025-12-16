import { Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

export const routes: Routes = [
  {
    path: '', // El path principal está vacío porque se define en app.routes.ts
    component: TabsPage,
    children: [
      {
        path: 'tab1', // Ruta para Inicio
        loadComponent: () =>
          import('../tab1/tab1.page').then((m) => m.Tab1Page),
      },
      {
        path: 'tab2', // Ruta para Cursos
        loadComponent: () =>
          import('../tab2/tab2.page').then((m) => m.Tab2Page),
      },
  
      {
        path: 'tab3', // Ruta para Perfil
        loadComponent: () =>
          import('../tab3/tab3.page').then((m) => m.Tab3Page),
      },
      {
        path: '',
        redirectTo: 'tab1', // Redirige al primer tab por defecto
        pathMatch: 'full',
      },
    ],
  }
];

import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard'; // 1. IMPORTAR EL GUARDIÁN

export const routes: Routes = [
  // --- Rutas Públicas ---
  {
    path: 'login',
    loadComponent: () => import('./login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./register/register.page').then((m) => m.RegisterPage),
  },
  // --- Rutas Protegidas por el Guardián ---
  {
    path: 'tabs',
    loadChildren: () => import('./tabs/tabs.routes').then((m) => m.routes),
    canActivate: [authGuard], // 2. PROTEGER LA RUTA DE TABS
  },

  // --- ¡¡INICIO DE RUTA AÑADIDA!! ---
  {
    path: 'course-detail/:id',
    loadComponent: () =>
      import('./course-detail/course-detail.page').then(
        (m) => m.CourseDetailPage
      ),
    canActivate: [authGuard],
  },
  // --- ¡¡FIN DE RUTA AÑADIDA!! ---

  {
    path: 'create-event',
    loadComponent: () =>
      import('./create-event/create-event.page').then(
        (m) => m.CreateEventPage
      ),
    canActivate: [authGuard], // 3. PROTEGER TODAS LAS DEMÁS RUTAS
  },
  {
    path: 'create-comunicado',
    loadComponent: () =>
      import('./create-comunicado/create-comunicado.page').then(
        (m) => m.CreateComunicadoPage
      ),
    canActivate: [authGuard],
  },
  {
    path: 'edit-comunicado/:id',
    loadComponent: () =>
      import('./edit-comunicado/edit-comunicado.page').then(
        (m) => m.EditComunicadoPage
      ),
    canActivate: [authGuard],
  },
  {
    path: 'create-user',
    loadComponent: () =>
      import('./create-user/create-user.page').then((m) => m.CreateUserPage),
    canActivate: [authGuard],
  },
  {
    path: 'edit-user/:id',
    loadComponent: () =>
      import('./edit-user/edit-user.page').then((m) => m.EditUserPage),
    canActivate: [authGuard],
  },
  {
    path: 'user-list',
    loadComponent: () =>
      import('./user-list/user-list.page').then((m) => m.UserListPage),
    canActivate: [authGuard],
  },
  {
    path: 'user-list/:role',
    loadComponent: () =>
      import('./user-list/user-list.page').then((m) => m.UserListPage),
    canActivate: [authGuard],
  },
  {
    path: 'grade-management',
    loadComponent: () =>
      import('./grade-management/grade-management.page').then(
        (m) => m.GradeManagementPage
      ),
    canActivate: [authGuard],
  },
  {
    path: 'manage-grades/:id',
    loadComponent: () =>
      import('./manage-grades/manage-grades.page').then(
        (m) => m.ManageGradesPage
      ),
    canActivate: [authGuard],
  },
  {
    path: 'manage-courses',
    loadComponent: () =>
      import('./manage-courses/manage-courses.page').then(
        (m) => m.ManageCoursesPage
      ),
    canActivate: [authGuard],
  },
  {
    path: 'manage-assignments',
    loadComponent: () =>
      import('./manage-assignments/manage-assignments.page').then(
        (m) => m.ManageAssignmentsPage
      ),
    canActivate: [authGuard],
  },
  {
    path: 'manage-assignments/:id',
    loadComponent: () =>
      import('./manage-assignments/manage-assignments.page').then(
        (m) => m.ManageAssignmentsPage
      ),
    canActivate: [authGuard],
  },
  {
    path: 'manage-attendance/:id',
    loadComponent: () =>
      import('./manage-attendance/manage-attendance.page').then(
        (m) => m.ManageAttendancePage
      ),
    canActivate: [authGuard],
  },
  {
    path: 'my-grades',
    loadComponent: () =>
      import('./my-grades/my-grades.page').then((m) => m.MyGradesPage),
    canActivate: [authGuard],
  },
  {
    path: 'attendance-history',
    loadComponent: () =>
      import('./attendance-history/attendance-history.page').then(
        (m) => m.AttendanceHistoryPage
      ),
    canActivate: [authGuard],
  },
  // --- Rutas de Redirección (SIEMPRE AL FINAL) ---
  {
    path: '',
    redirectTo: 'login', // Redirige la raíz a login
    pathMatch: 'full',
  },
  {
    path: '**', // Cualquier ruta no encontrada
    redirectTo: 'login',
  },
];
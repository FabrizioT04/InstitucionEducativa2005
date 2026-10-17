import { Routes } from '@angular/router';
import { AccessPolicy } from './core/auth/access.models';
import { accessGuard } from './guards/access.guard';
import { authGuard } from './guards/auth.guard';

const adminAccess: AccessPolicy = { roles: ['administrador'] };
const studentAccess: AccessPolicy = { roles: ['estudiante'] };
const manageClassAccess: AccessPolicy = {
  roles: ['administrador', 'profesor'],
  classAccess: 'manage',
};

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    loadComponent: () => import('./register/register.page').then((m) => m.RegisterPage),
  },
  {
    path: 'tabs',
    loadChildren: () => import('./tabs/tabs.routes').then((m) => m.routes),
    canActivate: [authGuard, accessGuard],
    canActivateChild: [authGuard, accessGuard],
  },
  {
    path: 'course-detail/:id',
    loadComponent: () => import('./course-detail/course-detail.page').then((m) => m.CourseDetailPage),
    canActivate: [authGuard, accessGuard],
    data: { classAccess: 'read' } satisfies AccessPolicy,
  },
  {
    path: 'create-event',
    loadComponent: () => import('./create-event/create-event.page').then((m) => m.CreateEventPage),
    canActivate: [authGuard, accessGuard],
    data: adminAccess,
  },
  {
    path: 'create-comunicado',
    loadComponent: () => import('./create-comunicado/create-comunicado.page').then((m) => m.CreateComunicadoPage),
    canActivate: [authGuard, accessGuard],
    data: adminAccess,
  },
  {
    path: 'edit-comunicado/:id',
    loadComponent: () => import('./edit-comunicado/edit-comunicado.page').then((m) => m.EditComunicadoPage),
    canActivate: [authGuard, accessGuard],
    data: adminAccess,
  },
  {
    path: 'create-user',
    loadComponent: () => import('./create-user/create-user.page').then((m) => m.CreateUserPage),
    canActivate: [authGuard, accessGuard],
    data: adminAccess,
  },
  {
    path: 'edit-user/:id',
    loadComponent: () => import('./edit-user/edit-user.page').then((m) => m.EditUserPage),
    canActivate: [authGuard, accessGuard],
    data: adminAccess,
  },
  {
    path: 'user-list',
    loadComponent: () => import('./user-list/user-list.page').then((m) => m.UserListPage),
    canActivate: [authGuard, accessGuard],
    data: adminAccess,
  },
  {
    path: 'user-list/:role',
    loadComponent: () => import('./user-list/user-list.page').then((m) => m.UserListPage),
    canActivate: [authGuard, accessGuard],
    data: adminAccess,
  },
  {
    path: 'grade-management',
    loadComponent: () => import('./grade-management/grade-management.page').then((m) => m.GradeManagementPage),
    canActivate: [authGuard, accessGuard],
    data: adminAccess,
  },
  {
    path: 'manage-grades/:id',
    loadComponent: () => import('./manage-grades/manage-grades.page').then((m) => m.ManageGradesPage),
    canActivate: [authGuard, accessGuard],
    data: manageClassAccess,
  },
  {
    path: 'manage-courses',
    loadComponent: () => import('./manage-courses/manage-courses.page').then((m) => m.ManageCoursesPage),
    canActivate: [authGuard, accessGuard],
    data: adminAccess,
  },
  {
    path: 'manage-assignments',
    loadComponent: () => import('./manage-assignments/manage-assignments.page').then((m) => m.ManageAssignmentsPage),
    canActivate: [authGuard, accessGuard],
    data: adminAccess,
  },
  {
    path: 'manage-assignments/:id',
    loadComponent: () => import('./manage-assignments/manage-assignments.page').then((m) => m.ManageAssignmentsPage),
    canActivate: [authGuard, accessGuard],
    data: adminAccess,
  },
  {
    path: 'manage-schedule/:id',
    loadComponent: () => import('./manage-schedule/manage-schedule.page').then((m) => m.ManageSchedulePage),
    canActivate: [authGuard, accessGuard],
    data: { ...adminAccess, classAccess: 'manage' } satisfies AccessPolicy,
  },
  {
    path: 'manage-attendance/:id',
    loadComponent: () => import('./manage-attendance/manage-attendance.page').then((m) => m.ManageAttendancePage),
    canActivate: [authGuard, accessGuard],
    data: manageClassAccess,
  },
  {
    path: 'my-grades',
    loadComponent: () => import('./my-grades/my-grades.page').then((m) => m.MyGradesPage),
    canActivate: [authGuard, accessGuard],
    data: studentAccess,
  },
  {
    path: 'attendance-history',
    loadComponent: () => import('./attendance-history/attendance-history.page').then((m) => m.AttendanceHistoryPage),
    canActivate: [authGuard, accessGuard],
    data: studentAccess,
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' },
];

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { ApiError } from '@/api/http';
import { AuthProvider } from '@/auth/AuthProvider';
import { RequireAuth } from '@/auth/RequireAuth';
import { AppShell } from '@/components/layout/AppShell';
import { ToastProvider } from '@/components/ui/Toast';
import { TopProgress } from '@/components/ui/TopProgress';
import { ApplicationDetailPage } from '@/features/applications/ApplicationDetailPage';
import { EditApplicationPage, NewApplicationPage } from '@/features/applications/ApplicationFormPage';
import { ApplicationsPage } from '@/features/applications/ApplicationsPage';
import { AuditLogPage } from '@/features/audit/AuditLogPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { NotFound } from '@/features/errors/NotAllowed';
import { TeamPage } from '@/features/team/TeamPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // Client errors (4xx) will not succeed on retry; only network and server errors are retried.
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 2,
    },
  },
});

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/applications" replace /> },
      { path: 'applications', element: <ApplicationsPage /> },
      {
        path: 'applications/new',
        element: (
          <RequireAuth roles={['SALES', 'ADMIN']}>
            <NewApplicationPage />
          </RequireAuth>
        ),
      },
      { path: 'applications/:id', element: <ApplicationDetailPage /> },
      { path: 'applications/:id/edit', element: <EditApplicationPage /> },
      {
        path: 'audit',
        element: (
          <RequireAuth roles={['ADMIN']}>
            <AuditLogPage />
          </RequireAuth>
        ),
      },
      {
        path: 'team',
        element: (
          <RequireAuth roles={['ADMIN']}>
            <TeamPage />
          </RequireAuth>
        ),
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <TopProgress />
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

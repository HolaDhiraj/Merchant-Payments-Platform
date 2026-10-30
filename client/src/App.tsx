import { lazy } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ApiError } from '@/api/http';
import { AuthProvider } from '@/auth/AuthProvider';
import { HomeRedirect } from '@/auth/HomeRedirect';
import { CHANGE_PASSWORD_PATH, RequireAuth } from '@/auth/RequireAuth';
import { ROUTE_ROLES } from '@/auth/routeAccess';
import type { GuardedRoute } from '@/auth/routeAccess';
import { AppShell } from '@/components/layout/AppShell';
import { ToastProvider } from '@/components/ui/Toast';
import { TopProgress } from '@/components/ui/TopProgress';
import { LoginPage } from '@/features/auth/LoginPage';
import { NotFound } from '@/features/errors/NotAllowed';
import { ChangePasswordPage } from '@/features/account/ChangePasswordPage';

// Pages load on first visit, so staff never download the merchant portal and merchants never
// download the onboarding screens. Login and the password change stay in the main bundle.
const ApplicationDetailPage = lazy(() => import('@/features/applications/ApplicationDetailPage').then((m) => ({ default: m.ApplicationDetailPage })));
const EditApplicationPage = lazy(() => import('@/features/applications/ApplicationFormPage').then((m) => ({ default: m.EditApplicationPage })));
const NewApplicationPage = lazy(() => import('@/features/applications/ApplicationFormPage').then((m) => ({ default: m.NewApplicationPage })));
const ApplicationsPage = lazy(() => import('@/features/applications/ApplicationsPage').then((m) => ({ default: m.ApplicationsPage })));
const AuditLogPage = lazy(() => import('@/features/audit/AuditLogPage').then((m) => ({ default: m.AuditLogPage })));
const TeamPage = lazy(() => import('@/features/team/TeamPage').then((m) => ({ default: m.TeamPage })));
const AccountPage = lazy(() => import('@/features/account/AccountPage').then((m) => ({ default: m.AccountPage })));
const MerchantsPage = lazy(() => import('@/features/merchants/MerchantsPage').then((m) => ({ default: m.MerchantsPage })));
const MerchantWorkspace = lazy(() => import('@/features/merchants/MerchantWorkspace').then((m) => ({ default: m.MerchantWorkspace })));
const MerchantProfileTab = lazy(() => import('@/features/merchants/MerchantProfileTab').then((m) => ({ default: m.MerchantProfileTab })));
const ProductsPage = lazy(() => import('@/features/portal/catalog/ProductsPage').then((m) => ({ default: m.ProductsPage })));
const CheckoutPage = lazy(() => import('@/features/portal/checkout/CheckoutPage').then((m) => ({ default: m.CheckoutPage })));
const CustomerDetailPage = lazy(() => import('@/features/portal/customers/CustomerDetailPage').then((m) => ({ default: m.CustomerDetailPage })));
const CustomersPage = lazy(() => import('@/features/portal/customers/CustomersPage').then((m) => ({ default: m.CustomersPage })));
const DashboardPage = lazy(() => import('@/features/portal/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const PaymentDetailPage = lazy(() => import('@/features/portal/payments/PaymentDetailPage').then((m) => ({ default: m.PaymentDetailPage })));
const PaymentsPage = lazy(() => import('@/features/portal/payments/PaymentsPage').then((m) => ({ default: m.PaymentsPage })));
const SettingsPage = lazy(() => import('@/features/portal/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const MerchantTeamPage = lazy(() => import('@/features/portal/team/MerchantTeamPage').then((m) => ({ default: m.MerchantTeamPage })));

// A route guarded by its entry in ROUTE_ROLES (the API enforces the same rules).
const guarded = (path: GuardedRoute, page: ReactNode) => ({
  path,
  element: <RequireAuth roles={ROUTE_ROLES[path]}>{page}</RequireAuth>,
});

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
    path: CHANGE_PASSWORD_PATH,
    element: (
      <RequireAuth allowTemporaryPassword>
        <ChangePasswordPage />
      </RequireAuth>
    ),
  },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: 'account', element: <AccountPage /> },

      // Platform: onboarding
      guarded('applications', <ApplicationsPage />),
      guarded('applications/new', <NewApplicationPage />),
      guarded('applications/:id', <ApplicationDetailPage />),
      guarded('applications/:id/edit', <EditApplicationPage />),
      guarded('audit', <AuditLogPage />),
      guarded('team', <TeamPage />),

      // Platform: merchants. A merchant's workspace shows the portal screens below, read-only.
      guarded('merchants', <MerchantsPage />),
      {
        ...guarded('merchants/:merchantId/*', <MerchantWorkspace />),
        path: 'merchants/:merchantId',
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'payments', element: <PaymentsPage /> },
          { path: 'payments/:id', element: <PaymentDetailPage /> },
          { path: 'customers', element: <CustomersPage /> },
          { path: 'customers/:id', element: <CustomerDetailPage /> },
          { path: 'products', element: <ProductsPage /> },
          { path: 'team', element: <MerchantTeamPage /> },
          { path: 'profile', element: <MerchantProfileTab /> },
          { path: '*', element: <NotFound /> },
        ],
      },

      // Merchant portal
      guarded('portal', <DashboardPage />),
      guarded('portal/checkout', <CheckoutPage />),
      guarded('portal/payments', <PaymentsPage />),
      guarded('portal/payments/:id', <PaymentDetailPage />),
      guarded('portal/customers', <CustomersPage />),
      guarded('portal/customers/:id', <CustomerDetailPage />),
      guarded('portal/products', <ProductsPage />),
      guarded('portal/team', <MerchantTeamPage />),
      guarded('portal/settings', <SettingsPage />),
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

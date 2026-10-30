import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { applicationsApi, authApi, merchantsApi, portalApi, type PaymentListQuery } from './endpoints';
import { useMerchantScope } from './merchantScope';
import { queryKeys } from './queries';
import type { CheckoutInput, MerchantRole, MerchantSettingsInput, ProductInput } from './types';

// React Query hooks for the merchant portal (and the platform's merchant screens).
// Read hooks follow the merchant scope (see merchantScope.tsx): the user's own merchant, or the
// one a platform admin is overseeing. Every key starts with ['portal', scope], so two merchants'
// data never share a cache entry. Changes only ever apply to the user's own merchant ('own').

const OWN = 'own';

export const portalKeys = {
  profile: (scope: string) => ['portal', scope, 'profile'] as const,
  users: (scope: string, query: object) => ['portal', scope, 'users', query] as const,
  categories: (scope: string) => ['portal', scope, 'categories'] as const,
  products: (scope: string, query: object) => ['portal', scope, 'products', query] as const,
  customers: (scope: string, query: object) => ['portal', scope, 'customers', query] as const,
  customer: (scope: string, id: string) => ['portal', scope, 'customers', 'detail', id] as const,
  customerPoints: (scope: string, id: string, page: number) =>
    ['portal', scope, 'customers', 'detail', id, 'points', page] as const,
  payments: (scope: string, query: object) => ['portal', scope, 'payments', query] as const,
  payment: (scope: string, id: string) => ['portal', scope, 'payments', 'detail', id] as const,
  summary: (scope: string, query: object) => ['portal', scope, 'summary', query] as const,
  merchants: (query: object) => ['merchants', query] as const,
  merchantByApplication: (id: string) => ['merchants', 'by-application', id] as const,
};

// The viewer's own time zone decides what "today" means in reports.
export const LOCAL_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export function useChangePassword() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      authApi.changePassword(currentPassword, newPassword),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.me }),
  });
}

// Profile and settings

export function useMerchantProfile(enabled = true) {
  const { key, merchantId } = useMerchantScope();
  return useQuery({
    queryKey: portalKeys.profile(key),
    queryFn: () => (merchantId ? merchantsApi.get(merchantId) : portalApi.profile()),
    staleTime: 60_000,
    enabled,
  });
}

export function useUpdateMerchantSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: MerchantSettingsInput) => portalApi.updateSettings(input),
    onSuccess: (merchant) => client.setQueryData(portalKeys.profile(OWN), merchant),
  });
}

// Team

export function useMerchantUsers(page: number) {
  const { key, api } = useMerchantScope();
  return useQuery({
    queryKey: portalKeys.users(key, { page }),
    queryFn: () => api.users({ page, pageSize: 25 }),
    placeholderData: keepPreviousData,
  });
}

function useTeamMutation<TInput, TResult>(fn: (input: TInput) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => client.invalidateQueries({ queryKey: ['portal', OWN, 'users'] }),
  });
}

export const useAddMerchantUser = () =>
  useTeamMutation((input: { email: string; fullName: string; role: MerchantRole }) => portalApi.addUser(input));
export const useSetMerchantUserActive = () =>
  useTeamMutation(({ id, isActive }: { id: string; isActive: boolean }) => portalApi.setUserActive(id, isActive));
export const useResetMerchantUserPassword = () => useTeamMutation((id: string) => portalApi.resetUserPassword(id));

// Catalogue

export function useCategories() {
  const { key, api } = useMerchantScope();
  return useQuery({ queryKey: portalKeys.categories(key), queryFn: api.categories, staleTime: 30_000 });
}

function useCatalogMutation<TInput, TResult>(fn: (input: TInput) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: portalKeys.categories(OWN) });
      void client.invalidateQueries({ queryKey: ['portal', OWN, 'products'] });
    },
  });
}

export const useSaveCategory = () =>
  useCatalogMutation(({ id, ...input }: { id?: string; name: string; discountPercent: number | null }) =>
    id ? portalApi.updateCategory(id, input) : portalApi.createCategory(input),
  );
export const useDeleteCategory = () => useCatalogMutation((id: string) => portalApi.deleteCategory(id));
export const useSaveProduct = () =>
  useCatalogMutation(({ id, input }: { id?: string; input: ProductInput }) =>
    id ? portalApi.updateProduct(id, input) : portalApi.createProduct(input),
  );

export function useProducts(query: { q?: string; categoryId?: string; activeOnly?: boolean; page: number; pageSize?: number }) {
  const { key, api } = useMerchantScope();
  return useQuery({
    queryKey: portalKeys.products(key, query),
    queryFn: () => api.products({ pageSize: 25, ...query }),
    placeholderData: keepPreviousData,
  });
}

// Customers

export function useCustomers(query: { q?: string; page: number }) {
  const { key, api } = useMerchantScope();
  return useQuery({
    queryKey: portalKeys.customers(key, query),
    queryFn: () => api.customers({ ...query, pageSize: 25 }),
    placeholderData: keepPreviousData,
  });
}

export function useCustomer(id: string) {
  const { key, api } = useMerchantScope();
  return useQuery({ queryKey: portalKeys.customer(key, id), queryFn: () => api.customer(id) });
}

export function useCustomerPoints(id: string, page: number) {
  const { key, api } = useMerchantScope();
  return useQuery({
    queryKey: portalKeys.customerPoints(key, id, page),
    queryFn: () => api.customerPoints(id, { page, pageSize: 10 }),
    placeholderData: keepPreviousData,
  });
}

// Payments

export function usePayments(query: PaymentListQuery, enabled = true) {
  const { key, api } = useMerchantScope();
  return useQuery({
    queryKey: portalKeys.payments(key, query),
    queryFn: () => api.payments(query),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function usePayment(id: string) {
  const { key, api } = useMerchantScope();
  return useQuery({ queryKey: portalKeys.payment(key, id), queryFn: () => api.payment(id) });
}

// A payment changes balances, history and reports, so all of them are refreshed.
function invalidatePaymentViews(client: ReturnType<typeof useQueryClient>) {
  void client.invalidateQueries({ queryKey: ['portal', OWN, 'payments'] });
  void client.invalidateQueries({ queryKey: ['portal', OWN, 'customers'] });
  void client.invalidateQueries({ queryKey: ['portal', OWN, 'summary'] });
}

export function useCheckout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CheckoutInput; idempotencyKey: string }) =>
      portalApi.pay(input, idempotencyKey),
    onSuccess: () => invalidatePaymentViews(client),
  });
}

export function useReviewPayment(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { approve: boolean; note?: string }) => portalApi.reviewPayment(id, input),
    onSuccess: (payment) => {
      client.setQueryData(portalKeys.payment(OWN, id), payment);
      invalidatePaymentViews(client);
    },
  });
}

export function useSalesSummary(days: number, enabled = true) {
  const { key, api } = useMerchantScope();
  const query = { tz: LOCAL_TIME_ZONE, days };
  return useQuery({
    queryKey: portalKeys.summary(key, query),
    queryFn: () => api.summary(query),
    placeholderData: keepPreviousData,
    enabled,
    refetchInterval: 60_000,
  });
}

// Platform: merchants

export function useMerchants(query: { q?: string; page: number }) {
  return useQuery({
    queryKey: portalKeys.merchants(query),
    queryFn: () => merchantsApi.list({ ...query, pageSize: 25 }),
    placeholderData: keepPreviousData,
  });
}

export function useMerchantForApplication(applicationId: string, enabled: boolean) {
  return useQuery({
    queryKey: portalKeys.merchantByApplication(applicationId),
    queryFn: () => merchantsApi.byApplication(applicationId),
    enabled,
    retry: false,
  });
}

export function useResetOwnerPassword() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (merchantId: string) => merchantsApi.resetOwnerPassword(merchantId),
    onSuccess: () => client.invalidateQueries({ queryKey: ['merchants'] }),
  });
}

// Opens the merchant for an application approved before onboarding was automatic.
export function useOnboardApplication(applicationId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => applicationsApi.onboard(applicationId),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['merchants'] });
      void client.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

import { LOGIN_PATH, request } from './http';
import type {
  ApplicationStatus,
  AuditAction,
  AuditLogEntry,
  BusinessDetailsInput,
  BusinessDetailsPatch,
  Category,
  CheckoutInput,
  CreateUserInput,
  Customer,
  DecisionInput,
  DecisionResult,
  LoyaltyEntry,
  Merchant,
  MerchantApplication,
  MerchantRole,
  MerchantSettingsInput,
  OnboardingCredentials,
  Page,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Product,
  ProductInput,
  RiskAssessment,
  Role,
  SalesSummary,
  TemporaryPassword,
  TokenResponse,
  User,
} from './types';

// One function per API endpoint. Components never build URLs themselves.

export const authApi = {
  login: (email: string, password: string) =>
    request<TokenResponse>(LOGIN_PATH, { method: 'POST', body: { email, password } }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }),
};

export const usersApi = {
  me: () => request<User>('/users/me'),
  list: (query: { role?: Role; page?: number; pageSize?: number }) =>
    request<Page<User>>('/users', { query: { ...query } }),
  create: (input: CreateUserInput) => request<User>('/users', { method: 'POST', body: input }),
  unlock: (id: string) => request<User>(`/users/${id}/unlock`, { method: 'POST' }),
  setActive: (id: string, isActive: boolean) =>
    request<User>(`/users/${id}/status`, { method: 'PATCH', body: { isActive } }),
};

export interface ApplicationListQuery {
  status?: ApplicationStatus;
  assignedToMe?: boolean;
  page?: number;
  pageSize?: number;
}

export const applicationsApi = {
  list: (query: ApplicationListQuery) =>
    request<Page<MerchantApplication>>('/merchant-applications', { query: { ...query } }),
  get: (id: string) => request<MerchantApplication>(`/merchant-applications/${id}`),
  create: (input: BusinessDetailsInput) =>
    request<MerchantApplication>('/merchant-applications', { method: 'POST', body: input }),
  update: (id: string, patch: BusinessDetailsPatch) =>
    request<MerchantApplication>(`/merchant-applications/${id}`, { method: 'PATCH', body: patch }),
  submit: (id: string) =>
    request<MerchantApplication>(`/merchant-applications/${id}/submit`, { method: 'POST' }),
  assignReviewer: (id: string, reviewerId: string) =>
    request<MerchantApplication>(`/merchant-applications/${id}/reviewer`, {
      method: 'PUT',
      body: { reviewerId },
    }),
  decide: (id: string, input: DecisionInput) =>
    request<DecisionResult>(`/merchant-applications/${id}/decision`, {
      method: 'POST',
      body: input,
    }),
  retryRiskReview: (id: string) =>
    request<MerchantApplication>(`/merchant-applications/${id}/risk-review/retry`, {
      method: 'POST',
    }),
  riskAssessment: (id: string) =>
    request<RiskAssessment>(`/merchant-applications/${id}/risk-assessment`),
  onboard: (id: string) =>
    request<OnboardingCredentials>(`/merchant-applications/${id}/onboarding`, { method: 'POST' }),
};

// Platform view of onboarded merchants (admins).
export const merchantsApi = {
  list: (query: { q?: string; page?: number; pageSize?: number }) =>
    request<Page<Merchant>>('/merchants', { query: { ...query } }),
  get: (id: string) => request<Merchant>(`/merchants/${id}`),
  byApplication: (applicationId: string) => request<Merchant>(`/merchants/by-application/${applicationId}`),
  resetOwnerPassword: (id: string) =>
    request<TemporaryPassword>(`/merchants/${id}/owner/temporary-password`, { method: 'POST' }),
};

export interface PaymentListQuery {
  status?: PaymentStatus;
  method?: PaymentMethod;
  customerId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

// One merchant's data, read-only. `base` picks the merchant: OWN_MERCHANT is the signed-in
// merchant user's own (taken from the session), merchantBase(id) one a platform admin oversees.
export const OWN_MERCHANT = '/merchant';
export const merchantBase = (merchantId: string | null) => (merchantId ? `/merchants/${merchantId}` : OWN_MERCHANT);

export function merchantReads(base: string) {
  return {
    users: (query: { page?: number; pageSize?: number }) =>
      request<Page<User>>(`${base}/users`, { query: { ...query } }),
    categories: () => request<Category[]>(`${base}/categories`),
    products: (query: { q?: string; categoryId?: string; activeOnly?: boolean; page?: number; pageSize?: number }) =>
      request<Page<Product>>(`${base}/products`, { query: { ...query } }),
    customers: (query: { q?: string; page?: number; pageSize?: number }) =>
      request<Page<Customer>>(`${base}/customers`, { query: { ...query } }),
    customer: (id: string) => request<Customer>(`${base}/customers/${id}`),
    customerPoints: (id: string, query: { page?: number; pageSize?: number }) =>
      request<Page<LoyaltyEntry>>(`${base}/customers/${id}/points`, { query: { ...query } }),
    payments: (query: PaymentListQuery) => request<Page<Payment>>(`${base}/payments`, { query: { ...query } }),
    payment: (id: string) => request<Payment>(`${base}/payments/${id}`),
    summary: (query: { tz: string; days: number }) =>
      request<SalesSummary>(`${base}/reports/summary`, { query: { ...query } }),
  };
}

// The signed-in merchant user's own portal: its reads plus every change. The merchant always
// comes from the session.
export const portalApi = {
  ...merchantReads(OWN_MERCHANT),
  profile: () => request<Merchant>('/merchant/profile'),
  updateSettings: (input: MerchantSettingsInput) =>
    request<Merchant>('/merchant/settings', { method: 'PATCH', body: input }),

  addUser: (input: { email: string; fullName: string; role: MerchantRole }) =>
    request<{ user: User; temporaryPassword: string }>('/merchant/users', { method: 'POST', body: input }),
  setUserActive: (id: string, isActive: boolean) =>
    request<User>(`/merchant/users/${id}/status`, { method: 'PATCH', body: { isActive } }),
  resetUserPassword: (id: string) =>
    request<TemporaryPassword>(`/merchant/users/${id}/temporary-password`, { method: 'POST' }),

  createCategory: (input: { name: string; discountPercent: number | null }) =>
    request<Category>('/merchant/categories', { method: 'POST', body: input }),
  updateCategory: (id: string, input: { name?: string; discountPercent?: number | null }) =>
    request<Category>(`/merchant/categories/${id}`, { method: 'PATCH', body: input }),
  deleteCategory: (id: string) => request<void>(`/merchant/categories/${id}`, { method: 'DELETE' }),

  createProduct: (input: ProductInput) => request<Product>('/merchant/products', { method: 'POST', body: input }),
  updateProduct: (id: string, input: Partial<ProductInput>) =>
    request<Product>(`/merchant/products/${id}`, { method: 'PATCH', body: input }),

  lookupCustomer: (phone: string) =>
    request<{ customer: Customer | null }>('/merchant/customers/lookup', { query: { phone } }),
  updateCustomer: (id: string, input: { fullName?: string; email?: string | null }) =>
    request<Customer>(`/merchant/customers/${id}`, { method: 'PATCH', body: input }),

  // The idempotency key makes a retried checkout return the first result instead of charging again.
  pay: (input: CheckoutInput, idempotencyKey: string) =>
    request<Payment>('/merchant/payments', {
      method: 'POST',
      body: input,
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  reviewPayment: (id: string, input: { approve: boolean; note?: string }) =>
    request<Payment>(`/merchant/payments/${id}/review`, { method: 'POST', body: input }),
};

export interface AuditLogQuery {
  entityId?: string;
  action?: AuditAction;
  page?: number;
  pageSize?: number;
}

export const auditApi = {
  list: (query: AuditLogQuery) =>
    request<Page<AuditLogEntry>>('/audit-logs', { query: { ...query } }),
};

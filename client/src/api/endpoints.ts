import { LOGIN_PATH, request } from './http';
import type {
  ApplicationStatus,
  AuditAction,
  AuditLogEntry,
  BusinessDetailsInput,
  BusinessDetailsPatch,
  CreateUserInput,
  DecisionInput,
  MerchantApplication,
  Page,
  RiskAssessment,
  Role,
  TokenResponse,
  User,
} from './types';

// One function per API endpoint. Components never build URLs themselves.

export const authApi = {
  login: (email: string, password: string) =>
    request<TokenResponse>(LOGIN_PATH, { method: 'POST', body: { email, password } }),
};

export const usersApi = {
  me: () => request<User>('/users/me'),
  list: (query: { role?: Role; page?: number; pageSize?: number }) =>
    request<Page<User>>('/users', { query: { ...query } }),
  create: (input: CreateUserInput) => request<User>('/users', { method: 'POST', body: input }),
  unlock: (id: string) => request<User>(`/users/${id}/unlock`, { method: 'POST' }),
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
    request<MerchantApplication>(`/merchant-applications/${id}/decision`, {
      method: 'POST',
      body: input,
    }),
  retryRiskReview: (id: string) =>
    request<MerchantApplication>(`/merchant-applications/${id}/risk-review/retry`, {
      method: 'POST',
    }),
  riskAssessment: (id: string) =>
    request<RiskAssessment>(`/merchant-applications/${id}/risk-assessment`),
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

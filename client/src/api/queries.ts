import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import {
  applicationsApi,
  auditApi,
  usersApi,
  type ApplicationListQuery,
  type AuditLogQuery,
} from './endpoints';
import type {
  BusinessDetailsInput,
  BusinessDetailsPatch,
  CreateUserInput,
  DecisionInput,
  MerchantApplication,
  Role,
} from './types';

// The risk check runs in a background worker; while it is pending we poll for the result.
const RISK_POLL_MS = 2500;

export const queryKeys = {
  me: ['me'] as const,
  users: (query: object) => ['users', query] as const,
  applications: ['applications'] as const,
  applicationList: (query: ApplicationListQuery) => ['applications', 'list', query] as const,
  application: (id: string) => ['applications', 'detail', id] as const,
  riskAssessment: (id: string, submission: number) =>
    ['applications', 'detail', id, 'risk', submission] as const,
  audit: (query: AuditLogQuery) => ['audit', query] as const,
};

// Users

export function useReviewers(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.users({ role: 'REVIEWER', pageSize: 100 }),
    queryFn: () => usersApi.list({ role: 'REVIEWER', pageSize: 100 }),
    select: (page) => page.items.filter((user) => user.isActive),
    enabled,
    staleTime: 60_000,
  });
}

export function useUsers(query: { role?: Role; page: number }) {
  return useQuery({
    queryKey: queryKeys.users(query),
    queryFn: () => usersApi.list({ ...query, pageSize: 25 }),
    placeholderData: keepPreviousData,
  });
}

export function useCreateUser() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => usersApi.create(input),
    onSuccess: () => client.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUnlockUser() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.unlock(id),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['users'] });
      client.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

export function useSetUserActive() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => usersApi.setActive(id, isActive),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['users'] });
      client.invalidateQueries({ queryKey: ['audit'] });
    },
  });
}

// Applications

export function useApplications(query: ApplicationListQuery) {
  return useQuery({
    queryKey: queryKeys.applicationList(query),
    queryFn: () => applicationsApi.list(query),
    placeholderData: keepPreviousData,
    refetchInterval: (q) =>
      q.state.data?.items.some((item) => item.riskStatus === 'PENDING') ? RISK_POLL_MS : false,
  });
}

export function useApplication(id: string) {
  return useQuery({
    queryKey: queryKeys.application(id),
    queryFn: () => applicationsApi.get(id),
    refetchInterval: (q) => (q.state.data?.riskStatus === 'PENDING' ? RISK_POLL_MS : false),
  });
}

export function useRiskAssessment(application: MerchantApplication | undefined) {
  const ready = application?.riskStatus === 'COMPLETED';
  return useQuery({
    queryKey: queryKeys.riskAssessment(application?.id ?? '', application?.submissionCount ?? 0),
    queryFn: () => applicationsApi.riskAssessment(application!.id),
    enabled: ready,
    staleTime: Infinity,
  });
}

export function useCreateApplication() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: BusinessDetailsInput) => applicationsApi.create(input),
    onSuccess: (application) => storeApplication(client, application),
  });
}

export function useUpdateApplication(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: BusinessDetailsPatch) => applicationsApi.update(id, patch),
    onSuccess: (application) => storeApplication(client, application),
  });
}

// Lifecycle commands all return the updated application, so they share one cache update.
export function useApplicationCommand<TInput = void>(
  command: (id: string, input: TInput) => Promise<MerchantApplication>,
  id: string,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) => command(id, input),
    onSuccess: (application) => storeApplication(client, application),
  });
}

export const commands = {
  submit: (id: string) => applicationsApi.submit(id),
  retryRiskReview: (id: string) => applicationsApi.retryRiskReview(id),
  assignReviewer: (id: string, reviewerId: string) => applicationsApi.assignReviewer(id, reviewerId),
  decide: (id: string, input: DecisionInput) => applicationsApi.decide(id, input),
};

function storeApplication(client: QueryClient, application: MerchantApplication): void {
  client.setQueryData(queryKeys.application(application.id), application);
  void client.invalidateQueries({ queryKey: ['applications', 'list'] });
  void client.invalidateQueries({ queryKey: ['audit'] });
}

// Audit

export function useAuditLog(query: AuditLogQuery, enabled = true) {
  return useQuery({
    queryKey: queryKeys.audit(query),
    queryFn: () => auditApi.list(query),
    placeholderData: keepPreviousData,
    enabled,
  });
}

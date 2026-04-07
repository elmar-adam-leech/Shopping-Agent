export * from "./generated/api";
export * from "./generated/api.schemas";

import { useQuery, useMutation } from "@tanstack/react-query";
import type { UseQueryOptions, QueryKey, UseQueryResult, UseMutationOptions, UseMutationResult } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";

function makeQueryKey(...parts: unknown[]): QueryKey {
  return parts;
}

async function listDeletedKnowledge(storeDomain: string, requestOptions?: RequestInit) {
  return customFetch<unknown[]>(`/api/stores/${storeDomain}/knowledge/deleted`, { ...requestOptions, method: "GET" });
}

export function getListDeletedKnowledgeQueryKey(storeDomain: string): QueryKey {
  return makeQueryKey("stores", storeDomain, "knowledge", "deleted");
}

export function useListDeletedKnowledge<TData = unknown[], TError = ErrorType<unknown>>(
  storeDomain: string,
  options?: { query?: UseQueryOptions<unknown[], TError, TData>; request?: RequestInit },
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryKey = options?.query?.queryKey ?? getListDeletedKnowledgeQueryKey(storeDomain);
  const query = useQuery<unknown[], TError, TData>({
    queryKey,
    queryFn: () => listDeletedKnowledge(storeDomain, options?.request),
    enabled: !!storeDomain,
    ...options?.query,
  });
  return { ...query, queryKey } as UseQueryResult<TData, TError> & { queryKey: QueryKey };
}

async function restoreKnowledgeFn(params: { storeDomain: string; knowledgeId: string }, requestOptions?: RequestInit) {
  return customFetch<unknown>(`/api/stores/${params.storeDomain}/knowledge/${params.knowledgeId}/restore`, {
    ...requestOptions,
    method: "PATCH",
  });
}

export function useRestoreKnowledge<TError = ErrorType<unknown>, TContext = unknown>(
  options?: UseMutationOptions<unknown, TError, { storeDomain: string; knowledgeId: string }, TContext>,
): UseMutationResult<unknown, TError, { storeDomain: string; knowledgeId: string }, TContext> {
  return useMutation({
    mutationFn: (params: { storeDomain: string; knowledgeId: string }) => restoreKnowledgeFn(params),
    ...options,
  });
}

async function listDeletedConversations(storeDomain: string, requestOptions?: RequestInit) {
  return customFetch<unknown[]>(`/api/stores/${storeDomain}/conversations/deleted`, { ...requestOptions, method: "GET" });
}

export function useListDeletedConversations<TData = unknown[], TError = ErrorType<unknown>>(
  storeDomain: string,
  options?: { query?: UseQueryOptions<unknown[], TError, TData>; request?: RequestInit },
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryKey = makeQueryKey("stores", storeDomain, "conversations", "deleted");
  const query = useQuery<unknown[], TError, TData>({
    queryKey,
    queryFn: () => listDeletedConversations(storeDomain, options?.request),
    enabled: !!storeDomain,
    ...options?.query,
  });
  return { ...query, queryKey } as UseQueryResult<TData, TError> & { queryKey: QueryKey };
}

export async function restoreConversation(params: { storeDomain: string; conversationId: string }, requestOptions?: RequestInit) {
  return customFetch<unknown>(`/api/stores/${params.storeDomain}/conversations/${params.conversationId}/restore`, {
    ...requestOptions,
    method: "PATCH",
  });
}

async function checkAbandonedCheckout(storeDomain: string, requestOptions?: RequestInit) {
  return customFetch<unknown>(`/api/stores/${storeDomain}/checkout-recovery/check`, { ...requestOptions, method: "GET" });
}

export function getCheckAbandonedCheckoutQueryKey(storeDomain: string): QueryKey {
  return makeQueryKey("stores", storeDomain, "checkout-recovery", "check");
}

export function useCheckAbandonedCheckout<TData = unknown, TError = ErrorType<unknown>>(
  storeDomain: string,
  options?: { query?: UseQueryOptions<unknown, TError, TData>; request?: RequestInit },
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryKey = options?.query?.queryKey ?? getCheckAbandonedCheckoutQueryKey(storeDomain);
  const query = useQuery<unknown, TError, TData>({
    queryKey,
    queryFn: () => checkAbandonedCheckout(storeDomain, options?.request),
    enabled: !!storeDomain,
    ...options?.query,
  });
  return { ...query, queryKey } as UseQueryResult<TData, TError> & { queryKey: QueryKey };
}

export function useCheckoutRecoveryAction<TError = ErrorType<unknown>, TContext = unknown>(
  options?: UseMutationOptions<unknown, TError, { storeDomain: string; sessionId: string }, TContext>,
): UseMutationResult<unknown, TError, { storeDomain: string; sessionId: string }, TContext> {
  return useMutation({
    mutationFn: (params: { storeDomain: string; sessionId: string }) =>
      customFetch<unknown>(`/api/stores/${params.storeDomain}/checkout-recovery/trigger`, {
        method: "POST",
        body: JSON.stringify({ sessionId: params.sessionId }),
        headers: { "Content-Type": "application/json" },
      }),
    ...options,
  });
}

async function getExperimentAnalyticsFn(storeDomain: string, experimentId: string, requestOptions?: RequestInit) {
  return customFetch<unknown>(`/api/stores/${storeDomain}/experiments/${experimentId}/analytics`, { ...requestOptions, method: "GET" });
}

export function getGetExperimentAnalyticsQueryKey(storeDomain: string, experimentId: string): QueryKey {
  return makeQueryKey("stores", storeDomain, "experiments", experimentId, "analytics");
}

export function useGetExperimentAnalytics<TData = unknown, TError = ErrorType<unknown>>(
  storeDomain: string,
  experimentId: string,
  options?: { query?: UseQueryOptions<unknown, TError, TData>; request?: RequestInit },
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryKey = options?.query?.queryKey ?? getGetExperimentAnalyticsQueryKey(storeDomain, experimentId);
  const query = useQuery<unknown, TError, TData>({
    queryKey,
    queryFn: () => getExperimentAnalyticsFn(storeDomain, experimentId, options?.request),
    enabled: !!storeDomain && !!experimentId,
    ...options?.query,
  });
  return { ...query, queryKey } as UseQueryResult<TData, TError> & { queryKey: QueryKey };
}

export function getListExperimentsQueryKey(storeDomain: string): QueryKey {
  return makeQueryKey("stores", storeDomain, "experiments");
}

export function useListExperiments<TData = unknown[], TError = ErrorType<unknown>>(
  storeDomain: string,
  options?: { query?: UseQueryOptions<unknown[], TError, TData>; request?: RequestInit },
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryKey = options?.query?.queryKey ?? getListExperimentsQueryKey(storeDomain);
  const query = useQuery<unknown[], TError, TData>({
    queryKey,
    queryFn: () => customFetch<unknown[]>(`/api/stores/${storeDomain}/experiments`, { ...options?.request, method: "GET" }),
    enabled: !!storeDomain,
    ...options?.query,
  });
  return { ...query, queryKey } as UseQueryResult<TData, TError> & { queryKey: QueryKey };
}

export function useCreateExperiment<TError = ErrorType<unknown>, TContext = unknown>(
  options?: UseMutationOptions<unknown, TError, { storeDomain: string; data: Record<string, unknown> }, TContext>,
): UseMutationResult<unknown, TError, { storeDomain: string; data: Record<string, unknown> }, TContext> {
  return useMutation({
    mutationFn: (params: { storeDomain: string; data: Record<string, unknown> }) =>
      customFetch<unknown>(`/api/stores/${params.storeDomain}/experiments`, {
        method: "POST",
        body: JSON.stringify(params.data),
        headers: { "Content-Type": "application/json" },
      }),
    ...options,
  });
}

export function useCompleteExperiment<TError = ErrorType<unknown>, TContext = unknown>(
  options?: UseMutationOptions<unknown, TError, { storeDomain: string; experimentId: string }, TContext>,
): UseMutationResult<unknown, TError, { storeDomain: string; experimentId: string }, TContext> {
  return useMutation({
    mutationFn: (params: { storeDomain: string; experimentId: string }) =>
      customFetch<unknown>(`/api/stores/${params.storeDomain}/experiments/${params.experimentId}/complete`, {
        method: "POST",
      }),
    ...options,
  });
}

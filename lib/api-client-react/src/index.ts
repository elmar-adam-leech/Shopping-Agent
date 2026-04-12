export * from "./generated/api";
export * from "./generated/api.schemas";

import { useQuery, useMutation } from "@tanstack/react-query";
import type {
  UseQueryOptions,
  QueryKey,
  UseQueryResult,
  UseMutationOptions,
  UseMutationResult,
} from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";

function makeQueryKey(...parts: unknown[]): QueryKey {
  return parts;
}

export function getGetKnowledgeSyncStatusQueryKey(storeDomain: string): QueryKey {
  return makeQueryKey("stores", storeDomain, "knowledge", "sync", "status");
}

async function getKnowledgeSyncStatusFn(
  storeDomain: string,
  requestOptions?: RequestInit,
) {
  return customFetch<unknown>(
    `/api/stores/${storeDomain}/knowledge/sync/status`,
    { ...requestOptions, method: "GET" },
  );
}

export function useGetKnowledgeSyncStatus<
  TData = unknown,
  TError = ErrorType<unknown>,
>(
  storeDomain: string,
  options?: {
    query?: UseQueryOptions<unknown, TError, TData>;
    request?: RequestInit;
  },
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryKey =
    options?.query?.queryKey ?? getGetKnowledgeSyncStatusQueryKey(storeDomain);
  const query = useQuery<unknown, TError, TData>({
    queryKey,
    queryFn: () => getKnowledgeSyncStatusFn(storeDomain, options?.request),
    enabled: !!storeDomain,
    ...options?.query,
  });
  return { ...query, queryKey } as UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
  };
}

async function triggerKnowledgeSyncFn(
  params: { storeDomain: string },
  requestOptions?: RequestInit,
) {
  return customFetch<unknown>(
    `/api/stores/${params.storeDomain}/knowledge/sync`,
    { ...requestOptions, method: "POST" },
  );
}

export function useTriggerKnowledgeSync<
  TError = ErrorType<unknown>,
  TContext = unknown,
>(
  options?: UseMutationOptions<
    unknown,
    TError,
    { storeDomain: string },
    TContext
  >,
): UseMutationResult<unknown, TError, { storeDomain: string }, TContext> {
  return useMutation({
    mutationFn: (params: { storeDomain: string }) =>
      triggerKnowledgeSyncFn(params),
    ...options,
  });
}

async function updateSyncSettingsFn(
  params: { storeDomain: string; data: { syncFrequency: string } },
  requestOptions?: RequestInit,
) {
  return customFetch<unknown>(
    `/api/stores/${params.storeDomain}/knowledge/sync/settings`,
    {
      ...requestOptions,
      method: "PATCH",
      body: JSON.stringify(params.data),
    },
  );
}

export function useUpdateSyncSettings<
  TError = ErrorType<unknown>,
  TContext = unknown,
>(
  options?: UseMutationOptions<
    unknown,
    TError,
    { storeDomain: string; data: { syncFrequency: string } },
    TContext
  >,
): UseMutationResult<
  unknown,
  TError,
  { storeDomain: string; data: { syncFrequency: string } },
  TContext
> {
  return useMutation({
    mutationFn: (params: {
      storeDomain: string;
      data: { syncFrequency: string };
    }) => updateSyncSettingsFn(params),
    ...options,
  });
}

async function listDeletedKnowledge(
  storeDomain: string,
  requestOptions?: RequestInit,
) {
  return customFetch<unknown[]>(
    `/api/stores/${storeDomain}/knowledge/deleted`,
    { ...requestOptions, method: "GET" },
  );
}

export function getListDeletedKnowledgeQueryKey(storeDomain: string): QueryKey {
  return makeQueryKey("stores", storeDomain, "knowledge", "deleted");
}

export function useListDeletedKnowledge<
  TData = unknown[],
  TError = ErrorType<unknown>,
>(
  storeDomain: string,
  options?: {
    query?: UseQueryOptions<unknown[], TError, TData>;
    request?: RequestInit;
  },
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryKey =
    options?.query?.queryKey ?? getListDeletedKnowledgeQueryKey(storeDomain);
  const query = useQuery<unknown[], TError, TData>({
    queryKey,
    queryFn: () => listDeletedKnowledge(storeDomain, options?.request),
    enabled: !!storeDomain,
    ...options?.query,
  });
  return { ...query, queryKey } as UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
  };
}

async function restoreKnowledgeFn(
  params: { storeDomain: string; knowledgeId: string },
  requestOptions?: RequestInit,
) {
  return customFetch<unknown>(
    `/api/stores/${params.storeDomain}/knowledge/${params.knowledgeId}/restore`,
    {
      ...requestOptions,
      method: "PATCH",
    },
  );
}

export function useRestoreKnowledge<
  TError = ErrorType<unknown>,
  TContext = unknown,
>(
  options?: UseMutationOptions<
    unknown,
    TError,
    { storeDomain: string; knowledgeId: string },
    TContext
  >,
): UseMutationResult<
  unknown,
  TError,
  { storeDomain: string; knowledgeId: string },
  TContext
> {
  return useMutation({
    mutationFn: (params: { storeDomain: string; knowledgeId: string }) =>
      restoreKnowledgeFn(params),
    ...options,
  });
}

async function listDeletedConversations(
  storeDomain: string,
  requestOptions?: RequestInit,
) {
  return customFetch<unknown[]>(
    `/api/stores/${storeDomain}/conversations/deleted`,
    { ...requestOptions, method: "GET" },
  );
}

export function getListDeletedConversationsQueryKey(
  storeDomain: string,
): QueryKey {
  return makeQueryKey("stores", storeDomain, "conversations", "deleted");
}

export function useListDeletedConversations<
  TData = unknown[],
  TError = ErrorType<unknown>,
>(
  storeDomain: string,
  options?: {
    query?: UseQueryOptions<unknown[], TError, TData>;
    request?: RequestInit;
  },
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryKey =
    options?.query?.queryKey ??
    getListDeletedConversationsQueryKey(storeDomain);
  const query = useQuery<unknown[], TError, TData>({
    queryKey,
    queryFn: () => listDeletedConversations(storeDomain, options?.request),
    enabled: !!storeDomain,
    ...options?.query,
  });
  return { ...query, queryKey } as UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
  };
}

export async function restoreConversation(
  params: { storeDomain: string; conversationId: string },
  requestOptions?: RequestInit,
) {
  return customFetch<unknown>(
    `/api/stores/${params.storeDomain}/conversations/${params.conversationId}/restore`,
    {
      ...requestOptions,
      method: "PATCH",
    },
  );
}

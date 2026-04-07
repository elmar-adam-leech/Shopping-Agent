export * from "./generated/api";
export * from "./generated/types";

import { z } from "zod";

export const ListDeletedKnowledgeParams = z.object({
  storeDomain: z.string(),
});

export const RestoreKnowledgeParams = z.object({
  storeDomain: z.string(),
  knowledgeId: z.string(),
});

export const ListDeletedConversationsParams = z.object({
  storeDomain: z.string(),
});

export const ListDeletedConversationsQueryParams = z.object({
  limit: z.coerce.number().optional(),
  offset: z.coerce.number().optional(),
});

export const RestoreConversationParams = z.object({
  storeDomain: z.string(),
  conversationId: z.string(),
});

export const ListKnowledgeVersionsParams = z.object({
  storeDomain: z.string(),
  knowledgeId: z.string(),
});

export const RestoreKnowledgeVersionParams = z.object({
  storeDomain: z.string(),
  knowledgeId: z.string(),
  versionId: z.string(),
});

export const SearchKnowledgeParams = z.object({
  storeDomain: z.string(),
});

export const SearchKnowledgeQueryParams = z.object({
  q: z.string(),
  tag: z.string().optional(),
});

export const TriggerKnowledgeSyncParams = z.object({
  storeDomain: z.string(),
});

export const GetKnowledgeSyncStatusParams = z.object({
  storeDomain: z.string(),
});

export const UpdateSyncSettingsParams = z.object({
  storeDomain: z.string(),
});

export const UpdateSyncSettingsBody = z.object({
  syncFrequency: z.enum(["manual", "daily", "weekly"]),
});

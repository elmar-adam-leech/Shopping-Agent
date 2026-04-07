export * from "./generated/api";

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
  sessionId: z.string(),
  limit: z.coerce.number().optional(),
  offset: z.coerce.number().optional(),
});

export const RestoreConversationParams = z.object({
  storeDomain: z.string(),
  conversationId: z.string(),
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

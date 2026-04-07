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

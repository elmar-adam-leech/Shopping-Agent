import { eq } from "drizzle-orm";
import { conversationsTable, withTenantScope } from "@workspace/db";
import { auditOutput, logGuardEvent, type GuardSensitivity } from "./prompt-guard";

const RETRACTION_NOTICE = "⚠️ This response was corrected — please try again.";

export function fireOutputAudit(
  assistantResponse: string,
  toolResultTexts: string[],
  blockedTopics: string[],
  knowledgeContext: string,
  conversationId: number,
  storeDomain: string,
  sessionId: string,
  assistantMessageId: string,
  safeSendFn: (data: string) => boolean,
  endStream: () => void,
  sensitivity: GuardSensitivity = "medium"
): void {
  auditOutput(assistantResponse, toolResultTexts, blockedTopics, knowledgeContext, sensitivity)
    .then(async (auditResult) => {
      if (!auditResult.flagged) return;

      console.warn(`[prompt-guard] Output flagged for retraction store="${storeDomain}" reason="${auditResult.reason}" category="${auditResult.category}"`);

      try {
        await withTenantScope(storeDomain, async (scopedDb) => {
          const [conv] = await scopedDb
            .select()
            .from(conversationsTable)
            .where(eq(conversationsTable.id, conversationId));

          if (conv) {
            const messages = (conv.messages as Array<{ role: string; content: string; id?: string }>) || [];
            const updatedMessages = messages.map((m) => {
              if (m.role === "assistant" && m.id === assistantMessageId && m.content === assistantResponse) {
                return { ...m, content: RETRACTION_NOTICE, retracted: true };
              }
              return m;
            });

            await scopedDb
              .update(conversationsTable)
              .set({ messages: updatedMessages })
              .where(eq(conversationsTable.id, conversationId));
          }
        });
      } catch (err) {
        console.error(`[prompt-guard] Failed to retract message:`, err instanceof Error ? err.message : err);
      }

      safeSendFn(`data: ${JSON.stringify({ type: "retraction", data: { messageId: assistantMessageId, notice: RETRACTION_NOTICE, reason: auditResult.reason } })}\n\n`);

      logGuardEvent(storeDomain, sessionId, "output_retracted", assistantResponse.slice(0, 500), {
        reason: auditResult.reason,
        category: auditResult.category,
        originalText: assistantResponse.slice(0, 1000),
      });
    })
    .catch((err) => {
      console.error(`[prompt-guard] Output audit error:`, err instanceof Error ? err.message : err);
    })
    .finally(() => {
      endStream();
    });
}

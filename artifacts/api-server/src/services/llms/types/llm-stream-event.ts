export type LLMStreamEventData =
  | string
  | { id: string; name: string; arguments: string }
  | { toolCallId: string; content: string }
  | null;

export interface LLMStreamEvent {
  type: "text" | "tool_call" | "tool_result" | "done" | "error";
  data: LLMStreamEventData;
}

import OpenAI from "openai";
import type { LLMStreamEvent, LLMMessage } from "./openai";

export async function* streamChat(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: LLMMessage[],
  tools: any[],
  onToolCall: (name: string, args: any) => Promise<string>
): AsyncGenerator<LLMStreamEvent> {
  const client = new OpenAI({ apiKey, baseURL: "https://api.x.ai/v1" });

  const xaiTools = tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));

  const allMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => {
      if (m.role === "tool") {
        return { role: "tool" as const, content: m.content, tool_call_id: m.tool_call_id || "" };
      }
      return { role: m.role as "user" | "assistant", content: m.content };
    }),
  ];

  let continueLoop = true;

  while (continueLoop) {
    continueLoop = false;

    const stream = await client.chat.completions.create({
      model,
      messages: allMessages,
      tools: xaiTools.length > 0 ? xaiTools : undefined,
      stream: true,
    });

    let currentToolCalls: any[] = [];
    let assistantContent = "";

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        assistantContent += delta.content;
        yield { type: "text", data: delta.content };
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.index !== undefined) {
            if (!currentToolCalls[tc.index]) {
              currentToolCalls[tc.index] = { id: "", function: { name: "", arguments: "" } };
            }
            if (tc.id) currentToolCalls[tc.index].id = tc.id;
            if (tc.function?.name) currentToolCalls[tc.index].function.name += tc.function.name;
            if (tc.function?.arguments) currentToolCalls[tc.index].function.arguments += tc.function.arguments;
          }
        }
      }
    }

    if (currentToolCalls.length > 0) {
      allMessages.push({
        role: "assistant",
        content: assistantContent || null,
        tool_calls: currentToolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
      });

      for (const tc of currentToolCalls) {
        yield { type: "tool_call", data: { id: tc.id, name: tc.function.name, arguments: tc.function.arguments } };

        try {
          const args = JSON.parse(tc.function.arguments);
          const result = await onToolCall(tc.function.name, args);
          yield { type: "tool_result", data: { toolCallId: tc.id, content: result } };
          allMessages.push({ role: "tool", tool_call_id: tc.id, content: result });
        } catch (err: any) {
          const errorMsg = `Error: ${err.message}`;
          allMessages.push({ role: "tool", tool_call_id: tc.id, content: errorMsg });
          yield { type: "tool_result", data: { toolCallId: tc.id, content: errorMsg } };
        }
      }

      continueLoop = true;
    }
  }

  yield { type: "done", data: null };
}

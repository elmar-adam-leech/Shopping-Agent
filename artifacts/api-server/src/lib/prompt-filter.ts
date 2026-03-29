const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
  /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
  /forget\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /act\s+as\s+(a|an)\s+(?!customer|shopper|buyer)/i,
  /system\s*:\s*/i,
  /\[INST\]/i,
  /\[\/INST\]/i,
  /<<SYS>>/i,
  /<\|im_start\|>/i,
  /\bdo\s+not\s+follow\s+(your|the)\s+(instructions?|rules?|guidelines?)/i,
  /override\s+(your|the|all)\s+(instructions?|rules?|guidelines?|prompts?)/i,
  /reveal\s+(your|the)\s+(system\s+)?prompt/i,
  /show\s+(me\s+)?(your|the)\s+(system\s+)?prompt/i,
  /what\s+(is|are)\s+your\s+(system\s+)?(prompt|instructions?|rules?)/i,
  /repeat\s+(your|the)\s+(system\s+)?(prompt|instructions?)/i,
  /print\s+(your|the)\s+(system\s+)?(prompt|instructions?)/i,
];

export interface FilterResult {
  filtered: boolean;
  message: string;
  patternsMatched: string[];
}

export function filterPromptInjection(input: string): FilterResult {
  const matched: string[] = [];

  let cleaned = input;
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(cleaned)) {
      matched.push(pattern.source);
      cleaned = cleaned.replace(pattern, "[filtered]");
    }
  }

  if (matched.length > 0) {
    console.warn(`[prompt-filter] Detected ${matched.length} injection pattern(s) in user message`);
  }

  return {
    filtered: matched.length > 0,
    message: cleaned,
    patternsMatched: matched,
  };
}

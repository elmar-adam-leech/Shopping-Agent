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
  /\bjailbreak\b/i,
  /\bDAN\s+mode\b/i,
  /pretend\s+(you\s+)?(are|have)\s+no\s+(restrictions?|limitations?|rules?)/i,
  /```\s*(system|assistant)\b/i,
  /<\/?system>/i,
  /\[\s*SYSTEM\s*\]/i,
  /\b(bypass)\s+(all\s+)?(previous|prior|your|the|system)\s+(instructions?|prompts?|rules?|constraints?)/i,
];

export function runRegexFilter(input: string): { blocked: boolean; patternsMatched: string[]; cleaned: string } {
  const matched: string[] = [];
  let cleaned = input;
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(cleaned)) {
      matched.push(pattern.source);
      cleaned = cleaned.replace(pattern, "[filtered]");
    }
  }
  return { blocked: matched.length > 0, patternsMatched: matched, cleaned };
}

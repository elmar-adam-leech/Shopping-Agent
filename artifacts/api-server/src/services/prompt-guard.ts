const INJECTION_PATTERNS = [
  /\bignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|directions?)/i,
  /\byou\s+are\s+now\s+(a|an|my)\b/i,
  /\b(system|assistant)\s*:\s*/i,
  /\bforget\s+(all\s+)?(your|the)\s+(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)/i,
  /\bdo\s+not\s+follow\s+(your|the|any)\s+(previous|prior|original)\s+(instructions?|prompts?|rules?)/i,
  /\b(disregard|override|bypass)\s+(all\s+)?(previous|prior|your|the|system)\s+(instructions?|prompts?|rules?|constraints?)/i,
  /\bjailbreak/i,
  /\bDAN\s+mode/i,
  /\bact\s+as\s+(if\s+)?(you\s+)?(are\s+|were\s+)?(an?\s+)?unrestricted/i,
  /\bpretend\s+(you\s+)?(are\s+|have\s+)?(no\s+)?(restrictions?|limits?|rules?|guidelines?)/i,
  /\brepeat\s+(the|your)\s+(system\s+)?(prompt|instructions?)/i,
  /\bwhat\s+(are|is)\s+(your|the)\s+(system\s+)?(prompt|instructions?)/i,
  /\bshow\s+(me\s+)?(your|the)\s+(system\s+)?(prompt|instructions?|rules?)/i,
  /\bprint\s+(your|the)\s+(system\s+)?(prompt|instructions?)/i,
  /```\s*(system|assistant)\b/i,
  /<\/?system>/i,
  /\[\s*INST\s*\]/i,
  /\[\s*SYSTEM\s*\]/i,
];

export interface PromptGuardResult {
  blocked: boolean;
  pattern?: string;
}

export function checkPromptInjection(message: string): PromptGuardResult {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(message)) {
      return { blocked: true, pattern: pattern.source };
    }
  }
  return { blocked: false };
}

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

  /\bfrom\s+now\s+on\b.*\b(you\s+are|act\s+as|behave|respond)\b/i,
  /\bswitch\s+to\s+(unrestricted|unfiltered|uncensored|developer)\s+mode\b/i,
  /\bentering\s+(developer|admin|god|sudo|debug)\s+mode\b/i,
  /\benable\s+(developer|admin|god|sudo|debug)\s+mode\b/i,

  /\brole[\s_-]?play\b.*\b(as|like)\s+(a|an)\b/i,
  /\blet['']?s\s+play\s+a\s+game\b/i,
  /\bfor\s+educational\s+purposes?\b.*\b(ignore|override|bypass|pretend)\b/i,
  /\bin\s+this\s+(hypothetical|fictional|imaginary)\s+scenario\b/i,
  /\bimagine\s+you\s+(are|have|were)\s+(free|unrestricted|unfiltered)\b/i,

  /\bnew\s+instructions?\s*:/i,
  /\bupdated?\s+instructions?\s*:/i,
  /\bimportant\s+instructions?\s*:/i,
  /\b(end|start)\s+of\s+(system|hidden|secret)\s+(prompt|message|instructions?)\b/i,
  /\bsecret\s+(instruction|prompt|command)\b/i,

  /\bignor[eé]\s+(toutes?\s+les?|todas?\s+las?|alle)\s+(instructions?|consignes?|instrucciones?|Anweisungen)\b/i,
  /\boubli[eé]\s+(tes?|vos)\s+(instructions?|consignes?|règles?)\b/i,
  /\bolvida\s+(tus|las|todas)\s+(instrucciones?|reglas?)\b/i,

  /[\u0430\u0435\u043E\u0440\u0441\u0443\u0445]{3,}/,
  /[\u0391\u0392\u0395\u0396\u0397\u039A\u039C\u039D\u039F\u03A1\u03A4\u03A5\u03A7]{3,}/,
  /[\uFF21-\uFF3A\uFF41-\uFF5A]{4,}/,

  /\b(?:aWdub3Jl|aWdub3JlIGFsbA|c3lzdGVtIHByb21wdA|b3ZlcnJpZGU|YnlwYXNz|amFpbGJyZWFr)\b/,
  /\batob\s*\(/i,
  /\bbase64[\s_-]?decode/i,
  /\bdecode\s*\(\s*["'][A-Za-z0-9+/=]{20,}["']\s*\)/i,

  /\b<\s*\|\s*[a-z_]+\s*\|\s*>/i,
  /\{\{\s*(system|instructions?|prompt)\s*\}\}/i,
  /\[\[(?:system|instructions?|prompt|admin)\]\]/i,
  /\b###\s*(system|instruction|admin|override)\b/i,
  /<\|(?:end|begin)oftext\|>/i,

  /\bdo\s+(?:exactly\s+)?(?:as|what)\s+I\s+(?:say|tell\s+you|instruct)/i,
  /\byou\s+must\s+(?:now\s+)?obey\s+(?:me|my|these|the\s+following)/i,
  /\brespond\s+only\s+with\s+(?:the\s+)?(?:following|exact|raw)/i,
  /\bstop\s+being\s+(?:a\s+)?(?:helpful|shopping|store)\s+assistant/i,

  /\b(?:sudo|admin|root)\s+(?:mode|access|command|override)\b/i,
  /\bexecute\s+(?:this\s+)?(?:command|code|script|query)\b/i,

  /\binstructions?\s+(?:above|below|hidden|embedded)\s+(?:in|within)\s+(?:the|this)\b/i,
  /\bthe\s+(?:real|true|actual|hidden)\s+instructions?\s+(?:are|say|tell)\b/i,
];

const UNICODE_CONFUSABLE_MAP: Record<string, string> = {
  "\u0430": "a", "\u0435": "e", "\u043E": "o", "\u0440": "p",
  "\u0441": "c", "\u0443": "y", "\u0445": "x", "\u0456": "i",
  "\u0458": "j", "\u0455": "s", "\u04BB": "h", "\u043D": "h",
  "\u0410": "A", "\u0412": "B", "\u0415": "E", "\u041D": "H",
  "\u041A": "K", "\u041C": "M", "\u041E": "O", "\u0420": "P",
  "\u0421": "C", "\u0422": "T", "\u0423": "Y", "\u0425": "X",
  "\u0391": "A", "\u0392": "B", "\u0395": "E", "\u0396": "Z",
  "\u0397": "H", "\u039A": "K", "\u039C": "M", "\u039D": "N",
  "\u039F": "O", "\u03A1": "P", "\u03A4": "T", "\u03A5": "Y",
  "\u03A7": "X",
  "\uFF21": "A", "\uFF22": "B", "\uFF23": "C", "\uFF24": "D",
  "\uFF25": "E", "\uFF26": "F", "\uFF27": "G", "\uFF28": "H",
  "\uFF29": "I", "\uFF2A": "J", "\uFF2B": "K", "\uFF2C": "L",
  "\uFF2D": "M", "\uFF2E": "N", "\uFF2F": "O", "\uFF30": "P",
  "\uFF31": "Q", "\uFF32": "R", "\uFF33": "S", "\uFF34": "T",
  "\uFF35": "U", "\uFF36": "V", "\uFF37": "W", "\uFF38": "X",
  "\uFF39": "Y", "\uFF3A": "Z",
  "\uFF41": "a", "\uFF42": "b", "\uFF43": "c", "\uFF44": "d",
  "\uFF45": "e", "\uFF46": "f", "\uFF47": "g", "\uFF48": "h",
  "\uFF49": "i", "\uFF4A": "j", "\uFF4B": "k", "\uFF4C": "l",
  "\uFF4D": "m", "\uFF4E": "n", "\uFF4F": "o", "\uFF50": "p",
  "\uFF51": "q", "\uFF52": "r", "\uFF53": "s", "\uFF54": "t",
  "\uFF55": "u", "\uFF56": "v", "\uFF57": "w", "\uFF58": "x",
  "\uFF59": "y", "\uFF5A": "z",
};

function normalizeHomoglyphs(input: string): string {
  let result = "";
  for (const char of input) {
    result += UNICODE_CONFUSABLE_MAP[char] ?? char;
  }
  return result;
}

function stripZeroWidth(input: string): string {
  return input.replace(/[\u200B\u200C\u200D\u2060\uFEFF\u00AD]/g, "");
}

const IMPERATIVE_VERBS = /\b(ignore|disregard|forget|override|bypass|reveal|show|print|repeat|pretend|imagine|execute|obey|comply|switch|enable|enter|decode|respond|output|display|write|list|dump)\b/gi;
const META_REFERENCES = /\b(system\s*prompt|instructions?|guidelines?|rules?|constraints?|restrictions?|persona|role|configuration|safeguards?|guardrails?|filters?|limitations?)\b/gi;
const DIRECTIVE_PHRASES = /\b(you\s+must|you\s+should|you\s+will|you\s+are\s+now|from\s+now\s+on|do\s+not|do\s+as|i\s+command|i\s+order|i\s+instruct|important\s*:|note\s*:|remember\s*:|critical\s*:)\b/gi;
const ROLE_PLAY_SIGNALS = /\b(act\s+as|behave\s+as|role[\s_-]?play|pretend\s+to\s+be|you\s+are\s+a|simulate|impersonate|character|persona)\b/gi;

export interface HeuristicScore {
  score: number;
  flagged: boolean;
  signals: string[];
}

export function runHeuristicScoring(input: string, threshold: number = 0.45): HeuristicScore {
  const normalized = normalizeHomoglyphs(stripZeroWidth(input)).toLowerCase();
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;

  if (wordCount < 3) {
    return { score: 0, flagged: false, signals: [] };
  }

  const signals: string[] = [];
  let score = 0;

  const imperativeMatches = normalized.match(IMPERATIVE_VERBS) || [];
  const imperativeDensity = imperativeMatches.length / wordCount;
  if (imperativeDensity > 0.08) {
    score += Math.min(imperativeDensity * 3, 0.35);
    signals.push(`imperative_verb_density:${imperativeDensity.toFixed(3)}`);
  }

  const metaMatches = normalized.match(META_REFERENCES) || [];
  const metaDensity = metaMatches.length / wordCount;
  if (metaDensity > 0.04) {
    score += Math.min(metaDensity * 4, 0.35);
    signals.push(`meta_reference_density:${metaDensity.toFixed(3)}`);
  }

  const directiveMatches = normalized.match(DIRECTIVE_PHRASES) || [];
  if (directiveMatches.length > 0) {
    score += Math.min(directiveMatches.length * 0.1, 0.3);
    signals.push(`directive_phrases:${directiveMatches.length}`);
  }

  const rolePlayMatches = normalized.match(ROLE_PLAY_SIGNALS) || [];
  if (rolePlayMatches.length > 0) {
    score += Math.min(rolePlayMatches.length * 0.15, 0.3);
    signals.push(`role_play_signals:${rolePlayMatches.length}`);
  }

  if (imperativeMatches.length > 0 && metaMatches.length > 0) {
    score += 0.15;
    signals.push("imperative_meta_combo");
  }

  if (imperativeMatches.length > 0 && directiveMatches.length > 0 && metaMatches.length > 0) {
    score += 0.1;
    signals.push("triple_signal_combo");
  }

  const hasBase64Chunk = /[A-Za-z0-9+/=]{40,}/.test(input);
  if (hasBase64Chunk) {
    score += 0.2;
    signals.push("base64_chunk_detected");
  }

  const nonLatinRatio = (input.match(/[^\x00-\x7F]/g) || []).length / input.length;
  if (nonLatinRatio > 0.3 && metaMatches.length > 0) {
    score += 0.15;
    signals.push(`high_nonlatin_with_meta:${nonLatinRatio.toFixed(3)}`);
  }

  score = Math.min(score, 1.0);

  return {
    score,
    flagged: score >= threshold,
    signals,
  };
}

export function runRegexFilter(input: string): { blocked: boolean; patternsMatched: string[]; cleaned: string } {
  const stripped = stripZeroWidth(input);
  const normalized = normalizeHomoglyphs(stripped);

  const matched: string[] = [];
  let cleaned = normalized;

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(cleaned)) {
      matched.push(pattern.source);
      cleaned = cleaned.replace(pattern, "[filtered]");
    }
  }

  if (matched.length === 0 && normalized !== stripped) {
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(stripped)) {
        matched.push(pattern.source);
        cleaned = stripped.replace(pattern, "[filtered]");
      }
    }
  }

  return { blocked: matched.length > 0, patternsMatched: matched, cleaned };
}

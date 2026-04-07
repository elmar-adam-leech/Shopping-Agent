const LATIN_LANGUAGE_PATTERNS: Array<{ code: string; patterns: RegExp[] }> = [
  { code: "es", patterns: [/\b(hola|gracias|por favor|quiero|busco|necesito|tienda|producto|comprar|precio|talla|envío)\b/i] },
  { code: "fr", patterns: [/\b(bonjour|merci|s'il vous plaît|je veux|cherche|besoin|magasin|produit|acheter|prix|taille|livraison)\b/i] },
  { code: "de", patterns: [/\b(hallo|danke|bitte|ich möchte|suche|brauche|laden|produkt|kaufen|preis|größe|versand)\b/i] },
  { code: "pt", patterns: [/\b(olá|obrigado|por favor|quero|procuro|preciso|loja|produto|comprar|preço|tamanho|envio)\b/i] },
  { code: "it", patterns: [/\b(ciao|grazie|per favore|voglio|cerco|bisogno|negozio|prodotto|comprare|prezzo|taglia|spedizione)\b/i] },
  { code: "nl", patterns: [/\b(hallo|dank|alstublieft|wil|zoek|nodig|winkel|product|kopen|prijs|maat|verzending)\b/i] },
  { code: "vi", patterns: [/[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i] },
  { code: "pl", patterns: [/\b(cześć|dzień dobry|dziękuję|proszę|chcę|szukam|potrzebuję|sklep|produkt|kupić|cena)\b/i] },
  { code: "tr", patterns: [/\b(merhaba|teşekkür|lütfen|istiyorum|arıyorum|lazım|mağaza|ürün|satın|fiyat)\b/i] },
  { code: "sv", patterns: [/\b(hej|tack|snälla|vill|söker|behöver|butik|produkt|köpa|pris|storlek|frakt)\b/i] },
];

const HIRAGANA_KATAKANA = /[\u3040-\u309F\u30A0-\u30FF]/;
const HANGUL = /[\uAC00-\uD7AF\u1100-\u11FF]/;
const CJK_HAN = /[\u4E00-\u9FFF\u3400-\u4DBF]/;

export function detectLanguageFromText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  for (const { code, patterns } of LATIN_LANGUAGE_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(trimmed)) {
        return code;
      }
    }
  }

  if (HIRAGANA_KATAKANA.test(trimmed)) return "ja";
  if (HANGUL.test(trimmed)) return "ko";
  if (CJK_HAN.test(trimmed)) return "zh";

  if (/[\u0600-\u06FF\u0750-\u077F]/.test(trimmed)) return "ar";
  if (/[\u0400-\u04FF]/.test(trimmed)) return "ru";
  if (/[\u0900-\u097F]/.test(trimmed)) return "hi";
  if (/[\u0E00-\u0E7F]/.test(trimmed)) return "th";

  return null;
}

export function resolveSessionLanguage(
  detectedFromMessage: string | null,
  sessionLanguage: string | null,
  supportedLanguages: string[],
  defaultLanguage: string
): string {
  if (sessionLanguage) return sessionLanguage;

  const detected = detectedFromMessage;
  if (!detected) return defaultLanguage;

  if (supportedLanguages.length === 0) return detected;

  if (supportedLanguages.includes(detected)) return detected;

  return defaultLanguage;
}

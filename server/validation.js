import { z } from 'zod';

export const MAX_CHAT_LENGTH = 6000;

export const INTENT_VALUES = ['purchase', 'enquiry', 'support', 'browsing'];
export const FRICTION_VALUES = [
  'price',
  'delivery',
  'payment',
  'availability',
  'trust',
  'drop_off',
  'none',
];
export const URGENCY_VALUES = ['low', 'medium', 'high'];

export function countWords(text) {
  if (typeof text !== 'string') return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export const AnalysisSchema = z.object({
  intent: z.enum(INTENT_VALUES),
  friction: z.enum(FRICTION_VALUES),
  evidence: z.string().trim().min(1, 'Evidence must not be empty'),
  urgency: z.enum(URGENCY_VALUES),
  suggested_reply: z
    .string()
    .trim()
    .min(1, 'Suggested reply must not be empty')
    .refine((value) => countWords(value) <= 40, {
      message: 'suggested_reply must be 40 words or fewer',
    }),
});

export const StoreFactsSchema = z
  .object({
    deliveryCharge: z.string().max(300).optional().default(''),
    returnWindow: z.string().max(300).optional().default(''),
    paymentMethods: z.string().max(300).optional().default(''),
  })
  .optional()
  .nullable();

export function stripMarkdownFences(rawText) {
  if (typeof rawText !== 'string') return '';
  let text = rawText.trim();

  // Remove leading ```json or ``` and trailing ```
  const fencedMatch = text.match(/^```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (fencedMatch && typeof fencedMatch[1] === 'string') {
    return fencedMatch[1].trim();
  }

  // Fallback: strip leading/trailing fence tokens if partially formatted
  text = text.replace(/^```(?:json|JSON)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  return text.trim();
}

export function parseAndValidateAnalysis(rawText) {
  const cleaned = stripMarkdownFences(rawText);
  if (!cleaned) {
    return {
      ok: false,
      reason: 'Model returned an empty response.',
    };
  }

  let parsedJson;
  try {
    parsedJson = JSON.parse(cleaned);
  } catch (err) {
    return {
      ok: false,
      reason: `Invalid JSON returned by model: ${err instanceof Error ? err.message : 'parse error'}`,
    };
  }

  const result = AnalysisSchema.safeParse(parsedJson);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
      .join('; ');
    return {
      ok: false,
      reason: `Schema validation failed: ${details}`,
    };
  }

  return {
    ok: true,
    data: result.data,
  };
}

function normalizeForMatch(value) {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Checks whether the extracted evidence actually appears in the original chat text.
 * Strips optional outer quotation marks that models often wrap around quotes,
 * normalizes whitespace, and performs a case-insensitive substring check.
 */
export function verifyEvidenceInChat(evidence, originalChat) {
  if (typeof evidence !== 'string' || typeof originalChat !== 'string') {
    return false;
  }

  let candidate = evidence.trim();
  // Strip wrapping quotes if the LLM wrapped the verbatim quote in "..." or '...'
  if (
    (candidate.startsWith('"') && candidate.endsWith('"')) ||
    (candidate.startsWith("'") && candidate.endsWith("'")) ||
    (candidate.startsWith('“') && candidate.endsWith('”'))
  ) {
    candidate = candidate.slice(1, -1).trim();
  }

  const normalizedCandidate = normalizeForMatch(candidate);
  const normalizedChat = normalizeForMatch(originalChat);

  if (!normalizedCandidate || normalizedCandidate.length < 2) {
    return false;
  }

  return normalizedChat.includes(normalizedCandidate);
}

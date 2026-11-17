import express from 'express';
import { analyzeChat } from './llmClient.js';
import { createRateLimiter } from './rateLimit.js';
import {
  MAX_CHAT_LENGTH,
  StoreFactsSchema,
  parseAndValidateAnalysis,
  verifyEvidenceInChat,
} from './validation.js';

export function createApiRouter() {
  const router = express.Router();
  const analyzeRateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 30 });

  router.use(express.json({ limit: '128kb' }));

  router.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  router.post('/analyze', analyzeRateLimiter, async (req, res) => {
    try {
      const { chat, storeFacts } = req.body ?? {};

      if (typeof chat !== 'string' || !chat.trim()) {
        return res.status(400).json({
          status: 'error',
          error: 'Conversation text is required.',
          code: 'EMPTY_CHAT',
        });
      }

      if (chat.length > MAX_CHAT_LENGTH) {
        return res.status(400).json({
          status: 'error',
          error: `Conversation exceeds maximum length of ${MAX_CHAT_LENGTH} characters (received ${chat.length}).`,
          code: 'CHAT_TOO_LONG',
        });
      }

      const parsedFacts = StoreFactsSchema.safeParse(storeFacts);
      if (!parsedFacts.success) {
        return res.status(400).json({
          status: 'error',
          error: 'Invalid storeFacts payload.',
          code: 'INVALID_STORE_FACTS',
        });
      }

      const facts = parsedFacts.data ?? null;

      // Attempt 1
      const firstCall = await analyzeChat(chat, { storeFacts: facts });
      const firstValidation = parseAndValidateAnalysis(firstCall.rawText);

      if (firstValidation.ok) {
        const evidenceVerified = verifyEvidenceInChat(firstValidation.data.evidence, chat);
        return res.json({
          status: 'ok',
          result: firstValidation.data,
          evidenceVerified,
          model: firstCall.model,
          provider: firstCall.provider,
        });
      }

      // Attempt 2: Retry once with a repair instruction
      const repairInstruction =
        'Your previous response failed JSON or schema validation. Return ONLY a raw JSON object (no markdown fences) with exact keys "intent" (purchase|enquiry|support|browsing), "friction" (price|delivery|payment|availability|trust|drop_off|none), "evidence" (non-empty verbatim quote from the chat), "urgency" (low|medium|high), and "suggested_reply" (40 words or fewer, polite, no invented policy promises).';

      const secondCall = await analyzeChat(chat, {
        storeFacts: facts,
        repairInstruction,
        previousOutput: firstCall.rawText,
        validationError: firstValidation.reason,
      });
      const secondValidation = parseAndValidateAnalysis(secondCall.rawText);

      if (secondValidation.ok) {
        const evidenceVerified = verifyEvidenceInChat(secondValidation.data.evidence, chat);
        return res.json({
          status: 'ok',
          result: secondValidation.data,
          evidenceVerified,
          model: secondCall.model,
          provider: secondCall.provider,
          repaired: true,
        });
      }

      // Still invalid after retry: mark as analysis_failed, never guess
      return res.status(422).json({
        status: 'analysis_failed',
        error: `Analysis failed: ${secondValidation.reason}`,
        reason: secondValidation.reason,
        model: secondCall.model,
        provider: secondCall.provider,
      });
    } catch (err) {
      const statusCode =
        err && typeof err === 'object' && 'statusCode' in err && Number.isInteger(err.statusCode)
          ? err.statusCode
          : 500;
      const code =
        err && typeof err === 'object' && 'code' in err && typeof err.code === 'string'
          ? err.code
          : 'INTERNAL_ERROR';
      const message = err instanceof Error ? err.message : 'Unexpected server error.';

      return res.status(statusCode).json({
        status: 'error',
        error: message,
        code,
      });
    }
  });

  // Fallback for invalid JSON body or unknown API routes
  router.use((err, _req, res, _next) => {
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ status: 'error', error: 'Malformed JSON request body.', code: 'BAD_JSON' });
    }
    return res.status(500).json({ status: 'error', error: 'Unexpected API error.', code: 'INTERNAL_ERROR' });
  });

  return router;
}

export function createBackendApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use('/api', createApiRouter());
  return app;
}

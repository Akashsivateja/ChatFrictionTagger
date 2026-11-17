import 'dotenv/config';
import { GoogleGenAI, Type } from '@google/genai';

const SYSTEM_PROMPT =
  'You are a conversation analyst for an e-commerce store. Use ONLY the chat provided. Never invent products, prices, stock, delivery times, policies or order status. If the chat does not support a field, use "none" and explain in evidence. Respond with JSON only.';

const REQUEST_TIMEOUT_MS = 25_000;
const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';
const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen';

function formatStoreFacts(storeFacts) {
  if (!storeFacts || typeof storeFacts !== 'object') {
    return 'Store policy facts provided: None. Do NOT promise any delivery charges, delivery windows, return windows, or payment methods.';
  }

  const lines = [];
  if (typeof storeFacts.deliveryCharge === 'string' && storeFacts.deliveryCharge.trim()) {
    lines.push(`- Delivery charge: ${storeFacts.deliveryCharge.trim()}`);
  }
  if (typeof storeFacts.returnWindow === 'string' && storeFacts.returnWindow.trim()) {
    lines.push(`- Return window: ${storeFacts.returnWindow.trim()}`);
  }
  if (typeof storeFacts.paymentMethods === 'string' && storeFacts.paymentMethods.trim()) {
    lines.push(`- Payment methods: ${storeFacts.paymentMethods.trim()}`);
  }

  if (lines.length === 0) {
    return 'Store policy facts provided: None. Do NOT promise any delivery charges, delivery windows, return windows, or payment methods.';
  }

  return `Store policy facts provided (you may ONLY use these facts in suggested_reply, never invent anything else):\n${lines.join('\n')}`;
}

function buildUserPrompt(chat, options = {}) {
  const factsBlock = formatStoreFacts(options.storeFacts);

  const baseInstructions = `Analyze the e-commerce customer conversation below and return a single JSON object with these exact keys:
- "intent": one of "purchase", "enquiry", "support", "browsing"
- "friction": one of "price", "delivery", "payment", "availability", "trust", "drop_off", "none"
- "evidence": an exact verbatim substring copied word-for-word from the customer's messages in the chat that supports your friction tag (or if no field is supported, explain in evidence)
- "urgency": one of "low", "medium", "high"
- "suggested_reply": a polite reply in 40 words or fewer making NO promises outside the provided store policy facts

${factsBlock}

Conversation:
"""
${chat}
"""`;

  if (options.repairInstruction) {
    return `${baseInstructions}

PREVIOUS INVALID OUTPUT:
${options.previousOutput || '(empty)'}

VALIDATION ERROR:
${options.validationError || 'Invalid JSON or schema mismatch'}

REPAIR INSTRUCTION:
${options.repairInstruction}
Respond with valid JSON only, matching the required keys and enum values exactly.`;
  }

  return baseInstructions;
}

function withTimeout(promise, ms) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`LLM request timed out after ${Math.round(ms / 1000)}s.`);
      err.statusCode = 504;
      err.code = 'LLM_TIMEOUT';
      reject(err);
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

function resolveCredentials() {
  const rawKey = (process.env.LLM_API_KEY || process.env.GEMINI_API_KEY || '').trim();

  const isPlaceholder =
    !rawKey ||
    rawKey === 'MY_GEMINI_API_KEY' ||
    rawKey === 'YOUR_LLM_API_KEY' ||
    rawKey === 'YOUR_API_KEY';

  if (isPlaceholder) {
    const err = new Error(
      'LLM API key is missing. Set LLM_API_KEY (or GEMINI_API_KEY) on the server and retry.'
    );
    err.statusCode = 503;
    err.code = 'MISSING_API_KEY';
    throw err;
  }

  const explicitProvider = (process.env.LLM_PROVIDER || '').trim().toLowerCase();
  const provider = explicitProvider || (rawKey.startsWith('gsk_') ? 'groq' : 'gemini');

  const explicitModel = (process.env.LLM_MODEL || '').trim();
  const model =
    explicitModel || (provider === 'groq' ? DEFAULT_GROQ_MODEL : DEFAULT_GEMINI_MODEL);

  return { provider, model, apiKey: rawKey };
}

async function callGroq({ apiKey, model, userPrompt }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
      signal: controller.signal,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const upstreamMsg =
        data?.error?.message || `Groq API returned HTTP ${res.status}.`;
      const err = new Error(`Upstream LLM request failed: ${upstreamMsg}`);
      if (res.status === 429) {
        err.statusCode = 429;
        err.code = 'UPSTREAM_RATE_LIMIT';
      } else if (res.status === 400 || res.status === 401 || res.status === 403) {
        err.statusCode = 502;
        err.code = 'UPSTREAM_AUTH_OR_REQUEST_ERROR';
      } else {
        err.statusCode = 502;
        err.code = 'UPSTREAM_LLM_ERROR';
      }
      throw err;
    }

    const rawText = data?.choices?.[0]?.message?.content ?? '';
    return { rawText, model, provider: 'groq' };
  } catch (err) {
    if (err?.name === 'AbortError') {
      const timeoutErr = new Error(
        `LLM request timed out after ${Math.round(REQUEST_TIMEOUT_MS / 1000)}s.`
      );
      timeoutErr.statusCode = 504;
      timeoutErr.code = 'LLM_TIMEOUT';
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini({ apiKey, model, userPrompt }) {
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model,
        contents: userPrompt,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              intent: {
                type: Type.STRING,
                enum: ['purchase', 'enquiry', 'support', 'browsing'],
              },
              friction: {
                type: Type.STRING,
                enum: ['price', 'delivery', 'payment', 'availability', 'trust', 'drop_off', 'none'],
              },
              evidence: {
                type: Type.STRING,
                description: 'Exact verbatim words from the chat supporting the friction tag.',
              },
              urgency: {
                type: Type.STRING,
                enum: ['low', 'medium', 'high'],
              },
              suggested_reply: {
                type: Type.STRING,
                description: 'Polite reply of 40 words or fewer using only provided store facts.',
              },
            },
            required: ['intent', 'friction', 'evidence', 'urgency', 'suggested_reply'],
          },
        },
      }),
      REQUEST_TIMEOUT_MS
    );

    const rawText = typeof response?.text === 'string' ? response.text : '';
    return { rawText, model, provider: 'gemini' };
  } catch (err) {
    if (err && typeof err === 'object' && 'statusCode' in err && err.statusCode) {
      throw err;
    }

    const message = err instanceof Error ? err.message : String(err);
    const wrapped = new Error(`Upstream LLM request failed: ${message}`);
    const status = err?.status || err?.statusCode;
    if (status === 429) {
      wrapped.statusCode = 429;
      wrapped.code = 'UPSTREAM_RATE_LIMIT';
    } else if (status === 400 || status === 401 || status === 403) {
      wrapped.statusCode = 502;
      wrapped.code = 'UPSTREAM_AUTH_OR_REQUEST_ERROR';
    } else {
      wrapped.statusCode = 502;
      wrapped.code = 'UPSTREAM_LLM_ERROR';
    }
    throw wrapped;
  }
}

/**
 * Single LLM provider entrypoint.
 * Changing LLM provider only requires editing this module.
 *
 * @param {string} chat
 * @param {{
 *   storeFacts?: { deliveryCharge?: string; returnWindow?: string; paymentMethods?: string } | null;
 *   repairInstruction?: string;
 *   previousOutput?: string;
 *   validationError?: string;
 * }} [options]
 * @returns {Promise<{ rawText: string; model: string; provider: string }>}
 */
export async function analyzeChat(chat, options = {}) {
  const { provider, model, apiKey } = resolveCredentials();
  const userPrompt = buildUserPrompt(chat, options);

  if (provider === 'groq') {
    return callGroq({ apiKey, model, userPrompt });
  }

  if (provider === 'gemini') {
    return callGemini({ apiKey, model, userPrompt });
  }

  const err = new Error(
    `Unsupported LLM_PROVIDER "${provider}". Edit server/llmClient.js to implement this provider or set LLM_PROVIDER to "groq" or "gemini".`
  );
  err.statusCode = 501;
  err.code = 'UNSUPPORTED_PROVIDER';
  throw err;
}

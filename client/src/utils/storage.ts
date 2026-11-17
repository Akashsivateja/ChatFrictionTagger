import type { FeedbackLedger, StoreFacts } from '../types.ts';

const STORE_FACTS_KEY = 'cft_store_facts_v1';
const FEEDBACK_LEDGER_KEY = 'cft_feedback_ledger_v1';
const THEME_KEY = 'cft_theme_v1';

export type ThemeMode = 'light' | 'dark';

export const DEFAULT_STORE_FACTS: StoreFacts = {
  deliveryCharge: '',
  returnWindow: '',
  paymentMethods: '',
};

export function loadTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // Ignore storage errors
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function saveTheme(theme: ThemeMode): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore storage errors
  }
}

export function applyThemeClass(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function loadStoreFacts(): StoreFacts {
  try {
    const raw = localStorage.getItem(STORE_FACTS_KEY);
    if (!raw) return DEFAULT_STORE_FACTS;
    const parsed = JSON.parse(raw);
    return {
      deliveryCharge: typeof parsed?.deliveryCharge === 'string' ? parsed.deliveryCharge : '',
      returnWindow: typeof parsed?.returnWindow === 'string' ? parsed.returnWindow : '',
      paymentMethods: typeof parsed?.paymentMethods === 'string' ? parsed.paymentMethods : '',
    };
  } catch {
    return DEFAULT_STORE_FACTS;
  }
}

export function saveStoreFacts(facts: StoreFacts): void {
  try {
    localStorage.setItem(STORE_FACTS_KEY, JSON.stringify(facts));
  } catch {
    // Ignore storage errors
  }
}

export function loadFeedbackLedger(): FeedbackLedger {
  try {
    const raw = localStorage.getItem(FEEDBACK_LEDGER_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as FeedbackLedger;
  } catch {
    return {};
  }
}

export function saveFeedbackLedger(ledger: FeedbackLedger): void {
  try {
    localStorage.setItem(FEEDBACK_LEDGER_KEY, JSON.stringify(ledger));
  } catch {
    // Ignore storage errors
  }
}

export function clearFeedbackLedger(): void {
  try {
    localStorage.removeItem(FEEDBACK_LEDGER_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function computeCorrectionStats(ledger: FeedbackLedger): {
  reviewed: number;
  correctedOrRejected: number;
  ratePercent: number | null;
} {
  const entries = Object.values(ledger);
  const reviewedEntries = entries.filter(
    (entry) => entry.decision === 'approved' || entry.decision === 'rejected'
  );
  const reviewed = reviewedEntries.length;
  const correctedOrRejected = reviewedEntries.filter(
    (entry) => entry.decision === 'rejected' || entry.edited
  ).length;

  return {
    reviewed,
    correctedOrRejected,
    ratePercent: reviewed > 0 ? (correctedOrRejected / reviewed) * 100 : null,
  };
}

/**
 * Deterministic lightweight hash to key persisted feedback entries cleanly.
 */
export function hashChatKey(chat: string, index: number): string {
  let hash = 2166136261;
  for (let i = 0; i < chat.length; i += 1) {
    hash ^= chat.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `chat_${index}_${(hash >>> 0).toString(36)}`;
}

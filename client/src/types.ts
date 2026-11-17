export const INTENT_VALUES = ['purchase', 'enquiry', 'support', 'browsing'] as const;
export type IntentType = (typeof INTENT_VALUES)[number];

export const FRICTION_VALUES = [
  'price',
  'delivery',
  'payment',
  'availability',
  'trust',
  'drop_off',
  'none',
] as const;
export type FrictionType = (typeof FRICTION_VALUES)[number];

export const URGENCY_VALUES = ['low', 'medium', 'high'] as const;
export type UrgencyType = (typeof URGENCY_VALUES)[number];

export type ReviewStatus = 'needs_approval' | 'approved' | 'rejected';

export type RowLifecycleStatus = 'queued' | 'loading' | 'success' | 'analysis_failed' | 'error';

export const MAX_CHAT_LENGTH = 6000;
export const CONCURRENCY_LIMIT = 3;

export interface StoreFacts {
  deliveryCharge: string;
  returnWindow: string;
  paymentMethods: string;
}

export interface AnalysisResult {
  intent: IntentType;
  friction: FrictionType;
  evidence: string;
  urgency: UrgencyType;
  suggested_reply: string;
}

export interface ChatRow {
  id: string;
  index: number;
  chat: string;
  status: RowLifecycleStatus;
  result?: AnalysisResult;
  evidenceVerified?: boolean;
  model?: string;
  provider?: string;
  errorMessage?: string;
  reviewStatus: ReviewStatus;
  editedReply: string;
  editedByHuman: boolean;
}

export interface FeedbackEntry {
  decision: ReviewStatus;
  edited: boolean;
  updatedAt: number;
}

export type FeedbackLedger = Record<string, FeedbackEntry>;

export interface AnalyzeApiSuccessResponse {
  status: 'ok';
  result: AnalysisResult;
  evidenceVerified: boolean;
  model: string;
  provider: string;
  repaired?: boolean;
}

export interface AnalyzeApiErrorResponse {
  status: 'analysis_failed' | 'error';
  error: string;
  reason?: string;
  code?: string;
  model?: string;
  provider?: string;
}

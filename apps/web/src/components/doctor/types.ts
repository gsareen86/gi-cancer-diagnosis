import type { ClinicalHistoryView } from '@/lib/clinical-history';

export type GenerateAssessment = () => Promise<void>;

/**
 * The shape of one case as the review workspace receives it.
 *
 * Assembled by `/api/doctor/cases/[caseId]` in a single response rather than several, so the
 * doctor is not tab-hunting between panels that have to be read together. Each underlying read is
 * separately audited by the repository.
 */

export interface AssessmentPayload {
  differential_assessment: Array<{
    condition: string;
    likelihood: 'high' | 'moderate' | 'low';
    supporting_findings: string[];
    contradicting_or_atypical_findings: string[];
    suggested_confirmatory_steps: string[];
  }>;
  red_flags: Array<{ flag: string; basis: string; urgency: string }>;
  recommended_next_steps: string[];
  clinician_summary: string;
  disclaimer: string;
}

export interface AssessmentView {
  id: string;
  outcome: string;
  modelVersion: string;
  promptVersion: string;
  kbVersion: string;
  groundingChunkCount: number;
  generatedAt: string | null;
  failureReason: string | null;
  payload: AssessmentPayload | null;
}

export interface CaseDocument {
  id: string;
  originalFilename: string;
  contentType: string;
  scanStatus: string;
  patientTypeTag: string | null;
  patientDateTag: string | null;
  machineReadable: boolean | null;
  extract: unknown;
  extractVerified: boolean;
}

export interface CaseAnswer {
  questionId: string;
  prompt: string;
  value: unknown;
  askedBecause: string | null;
  options: Array<{ id: string; label: string }>;
  type: string;
}

export interface DeliveryEntry {
  recipientEmail?: string;
  id: string;
  type: string;
  reference: string | null;
  outcome: string;
  queuedAt: string;
  sentAt: string | null;
  readAt: string | null;
  failureReason: string | null;
}

/** The doctor's saved review. `finalSummary` is the structured object the sign-off panel writes. */
export interface ReviewView {
  draftRevision: number;
  id: string;
  status: string;
  finalSummary: unknown;
  doctorNotes: string | null;
  releasedAt: string | null;
}

export interface FinalSummary {
  differential?: Array<{
    condition: string;
    likelihood: 'high' | 'moderate' | 'low';
    origin: 'ai' | 'doctor';
    rejected?: boolean;
    rationale?: string;
  }>;
  recommendedNextSteps?: string[];
  clinicalImpression?: string;
  patientFacingSummary?: string;
  diagnosis?: string;
  dietaryAdvice?: string;
  precautions?: string;
  referralUrgency?: ReferralUrgency;
  followUpInterval?: string;
  prescriptionInstructions?: string;
}

export type ReferralUrgency = 'emergency' | 'within_week' | 'routine' | 'none';

export const REFERRAL_URGENCIES: readonly ReferralUrgency[] = [
  'emergency',
  'within_week',
  'routine',
  'none',
];

export interface CaseWorkspaceData {
  brief: import('@gi-compass/core').ClinicalSummary;
  case: {
    id: string;
    reference: string;
    status: string;
    entryPoint: string;
    createdAt: string | null;
    submittedAt: string | null;
    aiSkipReason: string | null;
  };
  patient: {
    reference: string | null;
    /** Present because the caller is the assigned doctor; null when never recorded. */
    fullName: string | null;
    ageYears: number | null;
    sex: string | null;
    locale: string;
  };
  /** Null when the patient never completed the history step — rendered as "not recorded". */
  history: ClinicalHistoryView | null;
  answersByCluster: Array<{ cluster: string; answers: CaseAnswer[] }>;
  documents: CaseDocument[];
  deliveries: DeliveryEntry[];
  redFlags: Array<{
    ruleId: string;
    urgency: string;
    basis: string;
    contributingQuestionIds: string[];
    acknowledgedByPatient: boolean;
  }>;
  assessment: AssessmentView | null;
  review: ReviewView | null;
}

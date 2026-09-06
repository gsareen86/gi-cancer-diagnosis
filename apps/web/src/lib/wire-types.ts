import type { AnswerValue } from '@gi-compass/core';

/**
 * The wire contract between the interview API and the interface.
 *
 * Defined once and imported by both sides. Two hand-maintained copies of the same shape drift,
 * and the drift shows up as a question type that silently renders nothing.
 */

export interface RenderedOption {
  id: string;
  label: string;
  referenceImageIds: string[];
}

export interface RenderedQuestion {
  id: string;
  groupId: string;
  cluster: string;
  type:
    | 'single_select'
    | 'multi_select'
    | 'scale'
    | 'numeric'
    | 'date'
    | 'duration'
    | 'text'
    | 'body_map'
    | 'image';
  prompt: string;
  help: string | null;
  clinicalTerms: Array<{ term: string; explanation: string }>;
  options: RenderedOption[];
  numeric: { min: number; max: number; unit: string; integerOnly: boolean } | null;
  scale: { min: number; max: number; minLabel: string; maxLabel: string } | null;
  bodyMapRegionIds: string[];
  referenceImageIds: string[];
  required: boolean;
  multiSelectMax: number | null;
  textMaxLength: number;
}

export interface RenderedRedFlag {
  ruleId: string;
  urgency: 'emergency' | 'urgent' | 'routine-but-flagged';
  basis: string;
  /**
   * Whether the patient has already seen this advisory and chosen to continue. Recorded so a
   * page reload does not put the same full-screen interruption in front of someone who has
   * already read it — the persistent banner carries it from then on.
   */
  acknowledged: boolean;
}

export interface EmergencyAdvisory {
  messages: string[];
  contacts: Array<{ labelKey: string; number: string }>;
  /** False once the patient has acknowledged every emergency flag currently in force. */
  requiresInterruption: boolean;
}

/** Kept as an empty compatibility field. The product provides advice, never emergency dispatch. */
export const EMERGENCY_NUMBERS: readonly { labelKey: string; number: string }[] = [];

export interface InterviewView {
  caseId: string;
  status: string;
  /** The version this case is pinned to; the interface never changes it, but shows it in review. */
  templateVersionId: string;
  entryPointId: string;
  locale: string;
  progress: { answered: number; total: number; ratio: number };
  complete: boolean;
  nextQuestion: RenderedQuestion | null;
  answeredQuestions: Array<{
    question: RenderedQuestion;
    value: AnswerValue;
    askedBecause: string | null;
  }>;
  unansweredRequired: string[];
  redFlags: RenderedRedFlag[];
  emergency: EmergencyAdvisory | null;
  newlyTriggeredRuleIds?: string[];
  safety?: { questionIds: string[]; pendingQuestionIds: string[]; unknownQuestionIds: string[]; complete: boolean };
}

export type { AnswerValue };

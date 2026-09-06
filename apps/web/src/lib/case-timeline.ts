/**
 * What the patient is told about where their case is.
 *
 * Milestones come from persisted case and processing state. The AI milestone exposes only
 * operational progress, never findings. Unavailable or skipped analysis is not marked complete;
 * specialist review can continue independently.
 *
 * Nothing here advances on a timer. A patient looking at this at 2am is asking one question — has
 * anyone looked at my case — and a bar that creeps forward on its own answers it dishonestly.
 */

export type MilestoneId = 'started' | 'submitted' | 'analysis' | 'in_review' | 'ready';
export type AnalysisState = 'pending' | 'complete' | 'unavailable' | 'skipped';

export type MilestoneState = 'done' | 'current' | 'upcoming' | 'skipped';

export const MILESTONE_ORDER: readonly MilestoneId[] = [
  'started',
  'submitted',
  'analysis',
  'in_review',
  'ready',
];

/** Catalogue keys, resolved by the caller in the reader's language. */
export const MILESTONE_LABEL_KEY: Record<MilestoneId, string> = {
  started: 'milestoneStarted',
  submitted: 'milestoneSubmitted',
  analysis: 'milestoneAnalysis',
  in_review: 'milestoneInReview',
  ready: 'milestoneReady',
};

/** How far a case has actually got. Anything later than this milestone is `upcoming`. */
export function reachedMilestone(status: string): MilestoneId {
  switch (status) {
    case 'in_progress':
      return 'started';
    case 'submitted':
    case 'ai_processing':
      return 'submitted';
    case 'ai_processed':
    case 'ai_skipped':
      return 'analysis';
    case 'in_review':
    case 'reviewed':
      return 'in_review';
    case 'released':
    case 'closed':
      return 'ready';
    default:
      return 'submitted';
  }
}

export function milestoneStates(status: string, analysis: AnalysisState = 'pending'): Array<{ id: MilestoneId; state: MilestoneState }> {
  const reached = reachedMilestone(status);
  const index = MILESTONE_ORDER.indexOf(reached);
  const complete = status === 'released' || status === 'closed';

  return MILESTONE_ORDER.map((id, position) => ({
    id,
    state: id === 'analysis'
      ? analysis === 'complete' ? 'done' : analysis === 'unavailable' || analysis === 'skipped' ? 'skipped' : 'upcoming'
      :
      position < index || (complete && position === index)
        ? 'done'
        : position === index
          ? 'current'
          : 'upcoming',
  }));
}

/**
 * The single status word a patient sees.
 *
 * Five internal statuses collapse to "waiting for a doctor" on purpose — the distinction between
 * them is operational, and surfacing it would invite a patient to read `ai_skipped` as something
 * having gone wrong with their case when it means the opposite of urgent.
 */
export function patientStatusKey(status: string): string {
  if (status === 'in_progress') return 'statusInProgress';
  if (status === 'released') return 'statusReleased';
  if (status === 'closed') return 'statusClosed';
  if (status === 'in_review' || status === 'reviewed') return 'statusInReview';
  return 'statusSubmitted';
}

export function patientStatusTone(status: string): 'accent' | 'neutral' | 'ok' {
  if (status === 'released') return 'ok';
  if (status === 'in_progress') return 'accent';
  return 'neutral';
}

/**
 * The intake's named stages.
 *
 * Presentation only. The questionnaire engine computes the active path server-side and hands back
 * one question at a time; this maps whichever question is current onto a stage name so the
 * patient can see roughly where they are. A rail that thought it knew the order would be wrong
 * the moment a branch opened.
 *
 * That is also why "how many questions are left" is never promised. The engine's own progress
 * number — answered out of the questions currently on the path — is shown beside the rail and is
 * the honest figure.
 */

export type StageId = 'symptoms' | 'pain' | 'visual' | 'background' | 'record' | 'reports' | 'review';

export const STAGE_ORDER: readonly StageId[] = [
  'symptoms',
  'pain',
  'visual',
  'background',
  'record',
  'reports',
  'review',
];

export const STAGE_LABEL_KEY: Record<StageId, string> = {
  symptoms: 'stageSymptoms',
  pain: 'stagePain',
  visual: 'stageVisual',
  background: 'stageBackground',
  record: 'stageRecord',
  reports: 'stageReports',
  review: 'stageReview',
};

/**
 * Which stage a symptom cluster belongs to.
 *
 * `bleeding` and `hepatobiliary` are the visual stage because those are the clusters whose
 * questions carry the reference charts — blood appearance, stool colour, jaundice comparison —
 * and grouping them means a patient meets the imagery in one pass rather than three times over.
 */
const CLUSTER_STAGE: Record<string, StageId> = {
  bowel_habit: 'symptoms',
  reflux_upper_gi: 'symptoms',
  weight_appetite: 'symptoms',
  systemic: 'symptoms',
  pain: 'pain',
  bleeding: 'visual',
  hepatobiliary: 'visual',
  history: 'background',
  medication_lifestyle: 'background',
};

export function stageForCluster(cluster: string): StageId {
  return CLUSTER_STAGE[cluster] ?? 'symptoms';
}

export function stageIndex(stage: StageId): number {
  const found = STAGE_ORDER.indexOf(stage);
  return found === -1 ? 0 : found;
}

/**
 * Stages already passed.
 *
 * Computed from the furthest stage reached rather than from the current one, so a branch that
 * reopens an earlier cluster does not un-tick three stages behind the patient — which reads as
 * losing work even though nothing was lost.
 */
export function completedStages(furthest: StageId, current: StageId): StageId[] {
  const limit = Math.max(stageIndex(furthest), stageIndex(current));
  return STAGE_ORDER.slice(0, limit);
}

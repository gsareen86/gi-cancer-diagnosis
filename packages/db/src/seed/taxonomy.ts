import { PHASE_1_TAXONOMY } from '@gi-compass/core';

/**
 * The taxonomy is the same list the AI output validator enforces, so the seed and the guardrail
 * cannot drift: a condition the model is allowed to name is exactly one the clinician reviewed.
 */
export const TAXONOMY = PHASE_1_TAXONOMY;

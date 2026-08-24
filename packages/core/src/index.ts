/**
 * @gi-compass/core — the clinical domain.
 *
 * Framework-free by design (design D1): no database, no network, no HTTP, no React. The
 * safety-critical logic lives here precisely so it can be tested exhaustively and reused by a
 * future React Native client without dragging a server along.
 */

export * from './conditions/grammar.js';
export * from './conditions/evaluate.js';
export * from './conditions/introspect.js';

export * from './questionnaire/answers.js';
export * from './questionnaire/template.js';
export * from './questionnaire/answer-validation.js';
export * from './questionnaire/interview.js';
export * from './questionnaire/publication.js';

export * from './safety/red-flags.js';
export * from './consent/policy.js';

export * from './assessment/schema.js';
export * from './assessment/clinical-summary.js';

export * from './taxonomy.js';

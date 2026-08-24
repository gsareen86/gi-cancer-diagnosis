/**
 * @gi-compass/core — the clinical domain.
 *
 * Framework-free by design (design D1): no database, no network, no HTTP, no React. The
 * safety-critical logic lives here precisely so it can be tested exhaustively and reused by a
 * future React Native client without dragging a server along.
 */

export * from './conditions/grammar';
export * from './conditions/evaluate';
export * from './conditions/introspect';

export * from './questionnaire/answers';
export * from './questionnaire/template';
export * from './questionnaire/answer-validation';
export * from './questionnaire/interview';
export * from './questionnaire/publication';
export * from './questionnaire/document';

export * from './safety/red-flags';
export * from './consent/policy';

export * from './assessment/schema';
export * from './assessment/clinical-summary';

export * from './taxonomy';

import { describe, expect, it } from 'vitest';
import { addAiDraft } from './ai-draft';

describe('deliberate AI draft adoption', () => {
  it('fills empty summary only when called', () => {
    expect(addAiDraft('', ' A source draft ', 'summary')).toEqual({ ok: true, value: 'A source draft' });
  });
  it('appends without changing existing clinician text', () => {
    expect(addAiDraft(' My edited notes.\n', 'Suggestion', 'summary')).toEqual({ ok: true, value: ' My edited notes.\n\n\nSuggestion' });
  });
  it('rejects repeated summaries with normalized whitespace and case', () => {
    expect(addAiDraft('My notes\n\nSOURCE   draft', 'Source draft', 'summary')).toEqual({ ok: false, reason: 'duplicate' });
  });
  it('deduplicates workup across existing and new steps, preserving order', () => {
    expect(addAiDraft(' Existing step ', 'existing step\nNew step\nNew STEP', 'workup')).toEqual({ ok: true, value: ' Existing step \nNew step' });
  });
  it('rejects duplicate-only workup and empty source', () => {
    expect(addAiDraft('Test', 'test', 'workup')).toEqual({ ok: false, reason: 'duplicate' });
    expect(addAiDraft('Keep', ' ', 'summary')).toEqual({ ok: false, reason: 'empty' });
  });
  it.each(['summary', 'workup'] as const)('never truncates an oversized %s', field => {
    expect(addAiDraft('Doctor notes', 'x'.repeat(6001), field)).toEqual({ ok: false, reason: 'limit' });
  });
  it('rejects more than 12 workup steps', () => {
    expect(addAiDraft(Array.from({ length: 12 }, (_, i) => `Step ${i}`).join('\n'), 'Another', 'workup')).toEqual({ ok: false, reason: 'limit' });
  });
});

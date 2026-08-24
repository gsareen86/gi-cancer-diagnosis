import { describe, expect, it } from 'vitest';
import {
  CONSENT_PURPOSES,
  ConsentRequiredError,
  decideConsent,
  hasConsent,
  summarizeConsent,
  type ConsentRecord,
} from './policy.js';

const CURRENT = 'privacy-policy-2026-01';

let sequence = 0;
const record = (
  overrides: Partial<ConsentRecord> & Pick<ConsentRecord, 'purpose'>,
): ConsentRecord => ({
  id: `c${(sequence += 1)}`,
  userId: 'u1',
  policyVersion: CURRENT,
  grantedAt: new Date('2026-06-01T10:00:00Z'),
  withdrawnAt: null,
  ...overrides,
});

describe('purposes', () => {
  it('defines exactly the three Phase 1 purposes, each independent', () => {
    expect(CONSENT_PURPOSES).toEqual([
      'account_processing',
      'ai_assisted_analysis',
      'share_with_assigned_doctor',
    ]);
  });
});

describe('decideConsent', () => {
  it('refuses a purpose that was never granted', () => {
    const decision = decideConsent('ai_assisted_analysis', [], CURRENT);
    expect(decision).toEqual({
      granted: false,
      reason: 'never_granted',
      purpose: 'ai_assisted_analysis',
    });
  });

  it('grants a live consent against the current policy version', () => {
    const records = [record({ purpose: 'ai_assisted_analysis' })];
    expect(decideConsent('ai_assisted_analysis', records, CURRENT).granted).toBe(true);
  });

  it('refuses a withdrawn consent', () => {
    const records = [
      record({ purpose: 'ai_assisted_analysis', withdrawnAt: new Date('2026-07-01T00:00:00Z') }),
    ];
    const decision = decideConsent('ai_assisted_analysis', records, CURRENT);
    expect(decision.granted).toBe(false);
    if (!decision.granted) expect(decision.reason).toBe('withdrawn');
  });

  it('refuses a grant made against a superseded policy version', () => {
    const records = [record({ purpose: 'ai_assisted_analysis', policyVersion: 'privacy-policy-2025-04' })];
    const decision = decideConsent('ai_assisted_analysis', records, CURRENT);
    expect(decision.granted).toBe(false);
    if (!decision.granted) expect(decision.reason).toBe('superseded_policy_version');
  });

  it('keeps purposes independent — granting one does not grant another', () => {
    const records = [record({ purpose: 'account_processing' })];
    expect(hasConsent('account_processing', records, CURRENT)).toBe(true);
    expect(hasConsent('ai_assisted_analysis', records, CURRENT)).toBe(false);
    expect(hasConsent('share_with_assigned_doctor', records, CURRENT)).toBe(false);
  });
});

describe('withdraw and re-grant', () => {
  const withdrawn = record({
    purpose: 'ai_assisted_analysis',
    grantedAt: new Date('2026-01-01T00:00:00Z'),
    withdrawnAt: new Date('2026-03-01T00:00:00Z'),
  });
  const regranted = record({
    purpose: 'ai_assisted_analysis',
    grantedAt: new Date('2026-06-01T00:00:00Z'),
  });
  const history = [withdrawn, regranted];

  it('grants again after a re-grant', () => {
    expect(hasConsent('ai_assisted_analysis', history, CURRENT)).toBe(true);
  });

  it('leaves all three facts independently readable — the original, its withdrawal, the re-grant', () => {
    expect(history).toHaveLength(2);
    expect(history[0]?.grantedAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(history[0]?.withdrawnAt?.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(history[1]?.withdrawnAt).toBeNull();
    // The earlier record is untouched: consent records are never updated in place.
    expect(history[0]).toBe(withdrawn);
  });

  it('refuses again once the re-grant is itself withdrawn', () => {
    const fullyWithdrawn = [
      withdrawn,
      { ...regranted, withdrawnAt: new Date('2026-08-01T00:00:00Z') },
    ];
    expect(hasConsent('ai_assisted_analysis', fullyWithdrawn, CURRENT)).toBe(false);
  });
});

describe('summarizeConsent', () => {
  it('reports every purpose with its state, timestamp, version, and consequence copy', () => {
    const records = [record({ purpose: 'account_processing' })];
    const summary = summarizeConsent(records, CURRENT);

    expect(summary).toHaveLength(3);
    const account = summary.find((item) => item.purpose === 'account_processing');
    expect(account).toMatchObject({
      granted: true,
      policyVersion: CURRENT,
      required: true,
      reason: null,
    });
    expect(account?.withdrawalConsequenceKey).toBe('consent.account_processing.withdrawal');

    const ai = summary.find((item) => item.purpose === 'ai_assisted_analysis');
    expect(ai).toMatchObject({ granted: false, reason: 'never_granted', grantedAt: null });
  });

  it('marks AI analysis and doctor sharing as optional, so partial consent is a valid state', () => {
    const summary = summarizeConsent([], CURRENT);
    expect(summary.find((item) => item.purpose === 'ai_assisted_analysis')?.required).toBe(false);
    expect(summary.find((item) => item.purpose === 'share_with_assigned_doctor')?.required).toBe(
      false,
    );
  });
});

describe('ConsentRequiredError', () => {
  it('carries the purpose and reason so the caller can explain the refusal', () => {
    const error = new ConsentRequiredError('ai_assisted_analysis', 'withdrawn');
    expect(error.purpose).toBe('ai_assisted_analysis');
    expect(error.reason).toBe('withdrawn');
    expect(error.message).toContain('ai_assisted_analysis');
    expect(error).toBeInstanceOf(Error);
  });
});

import { describe, it, expect } from 'vitest';
import { patientReference, caseReference } from './references';
import { assessmentFailureKey } from './assessment-failure';

describe('public reference labels', () => {
  it('distinguishes patient from consultation and never truncates', () => {
    expect(patientReference(100001)).toBe('GI100001');
    expect(caseReference(100001)).toBe('GC100001');
    expect(caseReference(1234567)).toBe('GC1234567');
    expect(new Set([100001, 100002, 100003].map(patientReference)).size).toBe(3);
  });
  it.each([0, -1, 1.2, NaN, Infinity])('rejects invalid sequence value %s', (value) => {
    expect(() => patientReference(value)).toThrow();
  });
  it('does not expose unknown AI failure details', () => {
    expect(assessmentFailureKey('ai_service_unreachable')).toBe('doctor.assessment.ai_service_unreachable');
    expect(assessmentFailureKey('internal details')).toBe('doctor.assessment.failed');
  });
});

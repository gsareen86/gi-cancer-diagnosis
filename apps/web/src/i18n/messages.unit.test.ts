import { describe, expect, it } from 'vitest';
import { createTranslator } from 'next-intl';
import en from '../../messages/en.json';
import hi from '../../messages/hi.json';

describe.each([['en', en], ['hi', hi]] as const)('runtime catalogue resolution (%s)', (locale, messages) => {
  it('uses nested message namespaces, not unsupported literal dotted property names', () => {
    function inspect(value: unknown): void {
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) { expect(key).not.toContain('.'); inspect(child); }
    }
    inspect(messages);
  });
  it('resolves the actual API error key through next-intl without falling back to an internal key', () => {
    const errors: unknown[] = [];
    const t = createTranslator({ locale, messages, onError: (error) => errors.push(error) });
    const text = t('doctor.assessment.ai_service_unreachable');
    expect(text).not.toBe('doctor.assessment.ai_service_unreachable');
    expect(text.length).toBeGreaterThan(20);
    expect(errors).toEqual([]);
  });
});

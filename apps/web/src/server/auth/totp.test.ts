import { describe, expect, it } from 'vitest';
import {
  codeForStep,
  currentStep,
  decodeBase32,
  encodeBase32,
  enrolmentUri,
  formatSecretForDisplay,
  generateSecret,
  verifyCode,
} from './totp';

/**
 * TOTP is hand-rolled here, so it is checked against the published vectors rather than against
 * itself. A second-factor implementation that is subtly wrong is worse than none: it locks out
 * the clinician while looking like it works.
 */

// RFC 6238 Appendix B: the ASCII secret "12345678901234567890", base32-encoded.
const RFC_SECRET = encodeBase32(Buffer.from('12345678901234567890', 'ascii'));

describe('base32', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = Buffer.from([0x00, 0x01, 0x7f, 0x80, 0xff, 0xa5, 0x5a]);
    expect(decodeBase32(encodeBase32(bytes))).toEqual(bytes);
  });

  it('encodes the RFC secret to the expected alphabet', () => {
    expect(RFC_SECRET).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  });

  it('tolerates spacing and lowercase, which is how people retype a secret', () => {
    expect(decodeBase32('gezd gnbv gy3t qojq gezd gnbv gy3t qojq')).toEqual(
      decodeBase32(RFC_SECRET),
    );
  });

  it('rejects characters outside the alphabet rather than silently mangling them', () => {
    expect(() => decodeBase32('GEZD1!')).toThrow(/not valid base32/i);
  });
});

describe('RFC 6238 test vectors', () => {
  // The RFC publishes 8-digit codes; this implementation emits 6, which is the last six digits.
  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
    [20000000000, '353130'],
  ])('matches the published code at T=%i', (unixSeconds, expected) => {
    const step = Math.floor(unixSeconds / 30);
    expect(codeForStep(RFC_SECRET, step)).toBe(expected);
  });
});

describe('verification', () => {
  const at = 1_700_000_000_000;

  it('accepts the code for the current moment', () => {
    const code = codeForStep(RFC_SECRET, currentStep(at));
    expect(verifyCode(RFC_SECRET, code, at)).toBe(true);
  });

  it('accepts one step either side, for a phone clock that has drifted', () => {
    expect(verifyCode(RFC_SECRET, codeForStep(RFC_SECRET, currentStep(at) - 1), at)).toBe(true);
    expect(verifyCode(RFC_SECRET, codeForStep(RFC_SECRET, currentStep(at) + 1), at)).toBe(true);
  });

  it('refuses a code two steps old, so a stolen one is not usable for minutes', () => {
    expect(verifyCode(RFC_SECRET, codeForStep(RFC_SECRET, currentStep(at) - 2), at)).toBe(false);
  });

  it('tolerates the space authenticator apps display', () => {
    const code = codeForStep(RFC_SECRET, currentStep(at));
    expect(verifyCode(RFC_SECRET, `${code.slice(0, 3)} ${code.slice(3)}`, at)).toBe(true);
  });

  it.each([['', 'empty'], ['12345', 'too short'], ['1234567', 'too long'], ['abcdef', 'not digits']])(
    'refuses %s (%s) without attempting a comparison',
    (submitted) => {
      expect(verifyCode(RFC_SECRET, submitted, at)).toBe(false);
    },
  );

  it('refuses a valid-shaped code from a different secret', () => {
    const other = generateSecret();
    const code = codeForStep(other, currentStep(at));
    expect(verifyCode(RFC_SECRET, code, at)).toBe(false);
  });
});

describe('generated secrets', () => {
  it('are 160 bits, the RFC-recommended length', () => {
    expect(decodeBase32(generateSecret())).toHaveLength(20);
  });

  it('differ every time', () => {
    const secrets = new Set(Array.from({ length: 20 }, () => generateSecret()));
    expect(secrets.size).toBe(20);
  });
});

describe('enrolment URI', () => {
  const uri = enrolmentUri({ secretBase32: RFC_SECRET, accountEmail: 'doctor@example.invalid' });

  it('is an otpauth TOTP URI carrying the secret and the parameters', () => {
    const parsed = new URL(uri);
    expect(parsed.protocol).toBe('otpauth:');
    expect(parsed.searchParams.get('secret')).toBe(RFC_SECRET);
    expect(parsed.searchParams.get('digits')).toBe('6');
    expect(parsed.searchParams.get('period')).toBe('30');
    expect(parsed.searchParams.get('algorithm')).toBe('SHA1');
  });

  it('labels the entry with the account, so several accounts stay distinguishable', () => {
    expect(decodeURIComponent(uri)).toContain('doctor@example.invalid');
    expect(uri).toContain('issuer=GI+Compass');
  });

  it('groups the secret for anyone typing it by hand', () => {
    expect(formatSecretForDisplay(RFC_SECRET)).toBe('GEZD GNBV GY3T QOJQ GEZD GNBV GY3T QOJQ');
  });
});

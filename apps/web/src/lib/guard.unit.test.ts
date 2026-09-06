import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireWorkspace } from './guard';
import { currentUser, profileComplete, type CurrentUser } from './session';
import { consentState } from '@/server/services/consent-service';

vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-pathname': '/doctor/case/example?panel=review' }) }));
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock('./session', () => ({ currentUser: vi.fn(), profileComplete: vi.fn() }));
vi.mock('@/server/services/consent-service', () => ({ consentState: vi.fn() }));

const user: CurrentUser = { id: 'user', role: 'patient', status: 'active', email: 'test@example.invalid', locale: 'en', fullName: 'Test', dateOfBirth: '1974-01-01', sex: null, hasEmergencyContact: false, mfaPending: false };
beforeEach(() => {
  vi.mocked(currentUser).mockResolvedValue(user);
  vi.mocked(profileComplete).mockReturnValue(true);
  vi.mocked(consentState).mockResolvedValue({ purposes: [{ purpose: 'account_processing', granted: true }] } as Awaited<ReturnType<typeof consentState>>);
});
describe('workspace guards', () => {
  it('keeps an unauthenticated deep link through login', async () => {
    vi.mocked(currentUser).mockResolvedValue(null);
    await expect(requireWorkspace('doctor')).rejects.toThrow('REDIRECT:/login?next=%2Fdoctor%2Fcase%2Fexample%3Fpanel%3Dreview');
  });
  it('keeps the deep link through the second factor', async () => {
    vi.mocked(currentUser).mockResolvedValue({ ...user, role: 'doctor', mfaPending: true });
    await expect(requireWorkspace('doctor')).rejects.toThrow('REDIRECT:/mfa?next=');
  });
  it('redirects patients away from clinical work with an explanation', async () => {
    await expect(requireWorkspace('doctor')).rejects.toThrow('REDIRECT:/patient/dashboard?denied=1');
  });
  it('redirects clinicians away from the patient workspace', async () => {
    vi.mocked(currentUser).mockResolvedValue({ ...user, role: 'doctor' });
    await expect(requireWorkspace('patient')).rejects.toThrow('REDIRECT:/doctor/dashboard?denied=1');
  });
  it('requires a complete patient profile', async () => {
    vi.mocked(profileComplete).mockReturnValue(false);
    await expect(requireWorkspace('patient')).rejects.toThrow('REDIRECT:/patient/profile');
  });
  it('requires account-processing consent', async () => {
    vi.mocked(consentState).mockResolvedValue({ purposes: [] } as unknown as Awaited<ReturnType<typeof consentState>>);
    await expect(requireWorkspace('patient')).rejects.toThrow('REDIRECT:/patient/consent');
  });
  it('lets onboarding pages repair a missing profile or consent', async () => {
    vi.mocked(profileComplete).mockReturnValue(false);
    await expect(requireWorkspace('patient', { skipOnboardingChecks: true })).resolves.toEqual(user);
  });
  it('allows a ready patient and a fully authenticated specialist', async () => {
    await expect(requireWorkspace('patient')).resolves.toEqual(user);
    vi.mocked(currentUser).mockResolvedValue({ ...user, role: 'doctor' });
    await expect(requireWorkspace('doctor')).resolves.toMatchObject({ role: 'doctor' });
  });
});

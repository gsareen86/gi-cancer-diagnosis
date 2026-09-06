import type { ReactNode } from 'react';
import { PatientShell } from '@/components/shell/patient-shell';

/**
 * The patient workspace proper.
 *
 * Separated from `(onboarding)` by a route group rather than a flag, because the guard's
 * onboarding checks and the pages that satisfy them cannot live under the same layout: the
 * profile page would redirect to itself for exactly as long as the profile stayed incomplete.
 * Both groups render the same shell; only the guard differs.
 */
export default function PatientWorkspaceLayout({ children }: { children: ReactNode }) {
  return <PatientShell>{children}</PatientShell>;
}

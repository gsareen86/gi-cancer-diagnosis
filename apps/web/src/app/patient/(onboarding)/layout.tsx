import type { ReactNode } from 'react';
import { PatientShell } from '@/components/shell/patient-shell';

/**
 * Profile, consent and privacy.
 *
 * These three are the pages that resolve the very state the workspace guard checks, so they run
 * under a guard that authenticates and checks role but stops there. Privacy belongs here rather
 * than in the workspace for the same reason: a patient who has withdrawn storage consent must
 * still be able to reach the page that shows them they did.
 */
export default function PatientOnboardingLayout({ children }: { children: ReactNode }) {
  return <PatientShell skipOnboardingChecks>{children}</PatientShell>;
}

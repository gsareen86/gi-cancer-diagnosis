import { and, eq, isNull } from 'drizzle-orm';
import { hasConsentFor, tables } from '@gi-compass/db';
import { buildInterviewView } from '@/server/services/interview-service';
import { loadProfile } from '@/server/auth/accounts';
import { ageInYears } from '@/server/services/age';
import { clinical, database } from '@/server/db';
import { queueNotification } from '@/server/services/notification-service';
import { requestAssessment } from '@/server/services/assessment-service';
import { accessContext, route } from '@/server/api/route-handler';
import { ok, problem } from '@/server/api/problem';

/**
 * Submits a completed case for review.
 *
 * Consent decides the route, not a setting. Doctor sharing is required — there is no review
 * without it — while AI analysis is optional: a patient who declines it still gets a doctor,
 * just without a pre-assessment. The reason is recorded and shown to that doctor verbatim.
 */
export const POST = route<{ caseId: string }>({ roles: ['patient'] }, async ({ params, session, metadata }) => {
  const db = database();
  const repo = clinical();
  const context = accessContext(session, session.userId, 'account_processing', metadata);

  const caseRecord = await repo.getCase(context, params.caseId);
  if (!caseRecord) return problem('not_found', 'error.not_found');
  if (caseRecord.status !== 'in_progress') {
    return problem('conflict', 'case.submit.already_submitted');
  }

  const profile = await loadProfile(session.userId);
  const view = await buildInterviewView({
    context,
    caseRecord: {
      id: caseRecord.id,
      status: caseRecord.status,
      templateVersionId: caseRecord.templateVersionId,
      entryPointId: caseRecord.entryPointId,
      patientId: caseRecord.patientId,
    },
    locale: profile?.locale ?? 'en',
    ageYears: ageInYears(profile?.dateOfBirth ?? null),
  });

  if (view.unansweredRequired.length > 0) {
    return problem('invalid_request', 'case.submit.incomplete', {
      unansweredRequired: view.unansweredRequired,
      resumeAt: view.unansweredRequired[0],
    });
  }

  if (!(await hasConsentFor(db, session.userId, 'share_with_assigned_doctor'))) {
    // Without this, no doctor may read the case, so there is nothing to submit it for.
    return problem('consent_required', 'case.submit.doctor_sharing_required', {
      purpose: 'share_with_assigned_doctor',
    });
  }

  const aiConsented = await hasConsentFor(db, session.userId, 'ai_assisted_analysis');

  await repo.transitionCase(context, caseRecord.id, 'submitted', { submittedAt: new Date() });

  const doctorId = await assignReviewingDoctor(caseRecord.id, session.userId, metadata, session);

  if (!aiConsented) {
    await repo.transitionCase(context, caseRecord.id, 'ai_skipped', {
      aiSkipReason: 'The patient did not consent to AI-assisted analysis.',
    });
  }

  await queueNotification({
    userId: session.userId,
    type: 'case_submitted',
    reference: caseRecord.id,
  });

  if (doctorId !== null) {
    const urgent = view.redFlags.some((flag) => flag.urgency === 'emergency' || flag.urgency === 'urgent');
    await queueNotification({
      userId: doctorId,
      type: urgent ? 'doctor_urgent_case' : 'doctor_case_queued',
      reference: caseRecord.id,
    });
  }

  if (aiConsented) {
    // Fire-and-forget: the patient's submission must not wait on a model call, and the case is
    // already safely in the doctor's queue whether or not the assessment ever arrives.
    void requestAssessment(caseRecord.id).catch((error: unknown) => {
      console.error('[assessment] request failed', { caseId: caseRecord.id, error });
    });
  }

  return ok({
    status: aiConsented ? 'submitted' : 'submitted_without_ai',
    caseId: caseRecord.id,
    assignedDoctor: doctorId !== null,
  });
});

/**
 * Assigns a reviewing doctor.
 *
 * Round-robin over active doctors for now, which is enough while the platform runs as one
 * clinician's internal tool. The schema already carries assignment history, so a real routing
 * policy is a change here rather than a migration.
 *
 * TODO(confirm): Decision B — single-doctor tool or multi-doctor platform, which decides what
 * this policy should actually be.
 */
async function assignReviewingDoctor(
  caseId: string,
  patientId: string,
  metadata: { ipHash: string | null; userAgent: string | null },
  session: { userId: string; role: string },
): Promise<string | null> {
  const db = database();
  const doctors = await db
    .select({ id: tables.users.id })
    .from(tables.users)
    .where(and(eq(tables.users.role, 'doctor'), eq(tables.users.status, 'active'), isNull(tables.users.erasedAt)))
    .orderBy(tables.users.createdAt);

  const chosen = doctors[0];
  if (!chosen) {
    console.warn('[case] no active doctor to assign', { caseId });
    return null;
  }

  await clinical().assignDoctor(
    {
      actor: { id: null, role: 'system' },
      subjectId: patientId,
      purpose: 'share_with_assigned_doctor',
      request: { ipHash: metadata.ipHash ?? undefined, userAgent: metadata.userAgent ?? undefined },
    },
    caseId,
    chosen.id,
    session.userId,
  );
  return chosen.id;
}

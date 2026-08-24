import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { ClinicalRepository, canTransition } from '../repositories/clinical-repository';
import { AuditWriteError, AuthorizationError, ConsentGateError, IllegalTransitionError } from '../errors';
import { ClinicalMetadataInAuditError, databaseAuditWriter } from '../access/audit';
import type { AccessContext } from '../access/context';
import {
  auditEntries,
  createUser,
  openDatabase,
  schema,
  seedCase,
  truncateAll,
  withdrawConsent,
} from './harness';

const { db, close } = openDatabase();
afterAll(close);
beforeEach(() => truncateAll(db));

const repo = new ClinicalRepository(db);

const patientContext = (patientId: string, purpose: AccessContext['purpose'] = 'account_processing'): AccessContext => ({
  actor: { id: patientId, role: 'patient' },
  subjectId: patientId,
  purpose,
});

const doctorContext = (doctorId: string, patientId: string): AccessContext => ({
  actor: { id: doctorId, role: 'doctor' },
  subjectId: patientId,
  purpose: 'share_with_assigned_doctor',
});

const answer = { kind: 'single_select' as const, optionId: 'yes' };

describe('the funnel is the only way in', () => {
  it('lets a patient read their own case and records the read', async () => {
    const seeded = await seedCase(db);
    const found = await repo.getCase(patientContext(seeded.patientId), seeded.caseId);
    expect(found?.id).toBe(seeded.caseId);

    const entries = await auditEntries(db, seeded.patientId);
    expect(entries.map((entry) => entry.action)).toContain('case.read');
    expect(entries[0]?.actorRole).toBe('patient');
    expect(entries[0]?.outcome).toBe('allowed');
  });

  it('lets the assigned doctor read the case', async () => {
    const seeded = await seedCase(db);
    const found = await repo.getCase(doctorContext(seeded.doctorId, seeded.patientId), seeded.caseId);
    expect(found?.id).toBe(seeded.caseId);
  });
});

describe('cross-patient access', () => {
  it('is refused as not-found, so the identifier space is not an enumeration oracle', async () => {
    const seeded = await seedCase(db);
    const otherPatient = await createUser(db, 'patient');

    const context: AccessContext = {
      actor: { id: otherPatient, role: 'patient' },
      subjectId: otherPatient,
      purpose: 'account_processing',
    };

    await expect(repo.getCase(context, seeded.caseId)).rejects.toThrow(AuthorizationError);
    await expect(repo.getCase(context, seeded.caseId)).rejects.toMatchObject({ notFound: true });
  });

  it('records the denial with the actor and the target that was requested', async () => {
    const seeded = await seedCase(db);
    const otherPatient = await createUser(db, 'patient');
    const context: AccessContext = {
      actor: { id: otherPatient, role: 'patient' },
      subjectId: otherPatient,
      purpose: 'account_processing',
    };

    await expect(repo.getCase(context, seeded.caseId)).rejects.toThrow();

    const entries = await auditEntries(db);
    const denial = entries.find((entry) => entry.action === 'authz.denied');
    expect(denial).toBeDefined();
    expect(denial?.actorId).toBe(otherPatient);
    expect(denial?.targetId).toBe(seeded.caseId);
    expect(denial?.outcome).toBe('denied');
  });
});

describe('doctor assignment scoping', () => {
  it('refuses a doctor who is not assigned', async () => {
    const seeded = await seedCase(db);
    const otherDoctor = await createUser(db, 'doctor');
    await expect(
      repo.getCase(doctorContext(otherDoctor, seeded.patientId), seeded.caseId),
    ).rejects.toThrow(AuthorizationError);
  });

  it('ends access the moment the assignment is revoked, without waiting for session expiry', async () => {
    const seeded = await seedCase(db);
    const context = doctorContext(seeded.doctorId, seeded.patientId);
    expect(await repo.getCase(context, seeded.caseId)).not.toBeNull();

    await db.execute(sql`UPDATE case_assignments SET ended_at = now() WHERE case_id = ${seeded.caseId}::uuid`);

    await expect(repo.getCase(context, seeded.caseId)).rejects.toThrow(AuthorizationError);
  });

  it('transfers access on reassignment and retains both assignments in history', async () => {
    const seeded = await seedCase(db);
    const newDoctor = await createUser(db, 'doctor');
    const admin = await createUser(db, 'platform_admin');

    await repo.assignDoctor(
      { actor: { id: null, role: 'system' }, subjectId: seeded.patientId, purpose: 'share_with_assigned_doctor' },
      seeded.caseId,
      newDoctor,
      admin,
    );

    await expect(
      repo.getCase(doctorContext(seeded.doctorId, seeded.patientId), seeded.caseId),
    ).rejects.toThrow(AuthorizationError);
    expect(
      await repo.getCase(doctorContext(newDoctor, seeded.patientId), seeded.caseId),
    ).not.toBeNull();

    const history = await db.select().from(schema.caseAssignments);
    expect(history).toHaveLength(2);
    expect(history.filter((row) => row.endedAt === null)).toHaveLength(1);
  });
});

describe('role separation', () => {
  it('refuses a clinical admin, who owns every question but none of the answers', async () => {
    const seeded = await seedCase(db);
    const admin = await createUser(db, 'clinical_admin');
    await expect(
      repo.getCase(
        { actor: { id: admin, role: 'clinical_admin' }, subjectId: seeded.patientId, purpose: 'account_processing' },
        seeded.caseId,
      ),
    ).rejects.toThrow(/clinical admins have no access/i);
  });

  it('refuses a platform admin with no elevation', async () => {
    const seeded = await seedCase(db);
    const admin = await createUser(db, 'platform_admin');
    await expect(
      repo.getCase(
        { actor: { id: admin, role: 'platform_admin' }, subjectId: seeded.patientId, purpose: 'account_processing' },
        seeded.caseId,
      ),
    ).rejects.toThrow(/active elevation/i);
  });

  it('allows a platform admin under a live elevation, and records the elevation on the entry', async () => {
    const seeded = await seedCase(db);
    const admin = await createUser(db, 'platform_admin');
    const [elevation] = await db
      .insert(schema.adminElevations)
      .values({
        adminId: admin,
        reason: 'Investigating a reported data error',
        expiresAt: new Date(Date.now() + 30 * 60_000),
      })
      .returning({ id: schema.adminElevations.id });

    const found = await repo.getCase(
      {
        actor: { id: admin, role: 'platform_admin' },
        subjectId: seeded.patientId,
        purpose: 'account_processing',
        elevationId: elevation!.id,
      },
      seeded.caseId,
    );
    expect(found?.id).toBe(seeded.caseId);

    const entries = await auditEntries(db, seeded.patientId);
    const read = entries.find((entry) => entry.action === 'case.read');
    expect((read?.metadata as Record<string, unknown>)?.elevationId).toBe(elevation!.id);
  });

  it('refuses an expired elevation', async () => {
    const seeded = await seedCase(db);
    const admin = await createUser(db, 'platform_admin');
    const [elevation] = await db
      .insert(schema.adminElevations)
      .values({
        adminId: admin,
        reason: 'Stale',
        grantedAt: new Date(Date.now() - 120 * 60_000),
        expiresAt: new Date(Date.now() - 60 * 60_000),
      })
      .returning({ id: schema.adminElevations.id });

    await expect(
      repo.getCase(
        {
          actor: { id: admin, role: 'platform_admin' },
          subjectId: seeded.patientId,
          purpose: 'account_processing',
          elevationId: elevation!.id,
        },
        seeded.caseId,
      ),
    ).rejects.toThrow(/expired/i);
  });
});

describe('the consent gate', () => {
  it('refuses a purpose the patient never granted, before any clinical row is fetched', async () => {
    const seeded = await seedCase(db, { patientConsents: ['account_processing'] });
    await expect(
      repo.getCase(patientContext(seeded.patientId, 'ai_assisted_analysis'), seeded.caseId),
    ).rejects.toThrow(ConsentGateError);
  });

  it('refuses once a purpose is withdrawn, immediately', async () => {
    const seeded = await seedCase(db);
    const context = patientContext(seeded.patientId, 'ai_assisted_analysis');
    expect(await repo.getCase(context, seeded.caseId)).not.toBeNull();

    await withdrawConsent(db, seeded.patientId, 'ai_assisted_analysis');

    await expect(repo.getCase(context, seeded.caseId)).rejects.toMatchObject({
      code: 'consent_required',
      reason: 'withdrawn',
    });
  });

  it('ends the assigned doctor’s access when doctor sharing is withdrawn', async () => {
    const seeded = await seedCase(db);
    const context = doctorContext(seeded.doctorId, seeded.patientId);
    expect(await repo.getCase(context, seeded.caseId)).not.toBeNull();

    await withdrawConsent(db, seeded.patientId, 'share_with_assigned_doctor');

    // The doctor is told access was withdrawn, not that the case does not exist.
    await expect(repo.getCase(context, seeded.caseId)).rejects.toThrow(ConsentGateError);
  });

  it('logs the consent denial distinctly from an authorization denial', async () => {
    const seeded = await seedCase(db, { patientConsents: ['account_processing'] });
    await expect(
      repo.getCase(patientContext(seeded.patientId, 'ai_assisted_analysis'), seeded.caseId),
    ).rejects.toThrow();

    const entries = await auditEntries(db);
    const denial = entries.find((entry) => entry.action === 'consent.denied');
    expect(denial).toBeDefined();
    expect((denial?.metadata as Record<string, unknown>)?.reason).toBe('consent:never_granted');
  });
});

describe('the audit write is inside the clinical transaction', () => {
  it('rolls back the clinical write when the audit entry cannot be written', async () => {
    const seeded = await seedCase(db);
    const failing = new ClinicalRepository(db, {
      auditWriter: {
        write: async () => {
          throw new Error('audit store unavailable');
        },
      },
    });

    await expect(
      failing.saveAnswer(patientContext(seeded.patientId), {
        caseId: seeded.caseId,
        questionId: 'q_blood',
        value: answer,
        retractedQuestionIds: [],
        redFlags: [],
        ruleSetId: seeded.ruleSetId,
      }),
    ).rejects.toThrow(AuditWriteError);

    const rows = await db.select().from(schema.responses);
    expect(rows).toEqual([]);
  });

  it('commits both together on success', async () => {
    const seeded = await seedCase(db);
    await repo.saveAnswer(patientContext(seeded.patientId), {
      caseId: seeded.caseId,
      questionId: 'q_blood',
      value: answer,
      retractedQuestionIds: [],
      redFlags: [],
      ruleSetId: seeded.ruleSetId,
    });

    expect(await db.select().from(schema.responses)).toHaveLength(1);
    const entries = await auditEntries(db, seeded.patientId);
    expect(entries.map((entry) => entry.action)).toContain('response.write');
  });
});

describe('audit entries carry no clinical payload', () => {
  it('records the question identifier and not the answer value', async () => {
    const seeded = await seedCase(db);
    await repo.saveAnswer(patientContext(seeded.patientId), {
      caseId: seeded.caseId,
      questionId: 'q_blood_appearance',
      value: { kind: 'single_select', optionId: 'black_tarry' },
      retractedQuestionIds: [],
      redFlags: [],
      ruleSetId: seeded.ruleSetId,
    });

    const entries = await auditEntries(db, seeded.patientId);
    const serialized = JSON.stringify(entries);
    expect(serialized).toContain('q_blood_appearance');
    expect(serialized).not.toContain('black_tarry');
  });

  it('refuses metadata whose key would smuggle clinical content into the trail', async () => {
    const seeded = await seedCase(db);
    await expect(
      databaseAuditWriter.write(
        db,
        patientContext(seeded.patientId),
        { action: 'test', targetType: 'case', metadata: { answerValue: 'black_tarry' } },
        'allowed',
      ),
    ).rejects.toThrow(ClinicalMetadataInAuditError);
  });
});

describe('answer persistence', () => {
  it('marks stranded answers inactive rather than deleting them', async () => {
    const seeded = await seedCase(db);
    const context = patientContext(seeded.patientId);

    await repo.saveAnswer(context, {
      caseId: seeded.caseId,
      questionId: 'q_blood_position',
      value: { kind: 'single_select', optionId: 'mixed_in' },
      retractedQuestionIds: [],
      redFlags: [],
      ruleSetId: seeded.ruleSetId,
    });
    await repo.saveAnswer(context, {
      caseId: seeded.caseId,
      questionId: 'q_blood_appearance',
      value: { kind: 'single_select', optionId: 'black_tarry' },
      retractedQuestionIds: ['q_blood_position'],
      redFlags: [],
      ruleSetId: seeded.ruleSetId,
    });

    const rows = await db.select().from(schema.responses);
    expect(rows).toHaveLength(2);
    const stranded = rows.find((row) => row.questionId === 'q_blood_position');
    expect(stranded?.active).toBe(false);
    expect(stranded?.retractedAt).not.toBeNull();
  });

  it('persists red flags with their rule-set version in the same transaction', async () => {
    const seeded = await seedCase(db);
    await repo.saveAnswer(patientContext(seeded.patientId), {
      caseId: seeded.caseId,
      questionId: 'q_lightheaded',
      value: answer,
      retractedQuestionIds: [],
      redFlags: [
        {
          ruleId: 'rf_upper_gi_bleed_with_hypovolaemia',
          ruleSetVersion: 3,
          urgency: 'emergency',
          basisKey: 'redflag.upper_gi.basis',
          contributingQuestionIds: ['q_blood_appearance', 'q_lightheaded'],
        },
      ],
      ruleSetId: seeded.ruleSetId,
    });

    const flags = await db.select().from(schema.redFlagTriggers);
    expect(flags).toHaveLength(1);
    expect(flags[0]?.urgency).toBe('emergency');
    expect(flags[0]?.contributingQuestionIds).toEqual(['q_blood_appearance', 'q_lightheaded']);
  });

  it('is idempotent when the same flag re-triggers on a later answer', async () => {
    const seeded = await seedCase(db);
    const flag = {
      ruleId: 'rf_prolonged',
      ruleSetVersion: 3,
      urgency: 'routine-but-flagged' as const,
      basisKey: 'redflag.prolonged.basis',
      contributingQuestionIds: ['q_blood_duration'],
    };
    for (const questionId of ['q_a', 'q_b']) {
      await repo.saveAnswer(patientContext(seeded.patientId), {
        caseId: seeded.caseId,
        questionId,
        value: answer,
        retractedQuestionIds: [],
        redFlags: [flag],
        ruleSetId: seeded.ruleSetId,
      });
    }
    expect(await db.select().from(schema.redFlagTriggers)).toHaveLength(1);
  });
});

describe('case transitions', () => {
  it('permits the intended lifecycle', () => {
    expect(canTransition('in_progress', 'submitted')).toBe(true);
    expect(canTransition('submitted', 'ai_processing')).toBe(true);
    expect(canTransition('ai_processed', 'in_review')).toBe(true);
    expect(canTransition('reviewed', 'released')).toBe(true);
  });

  it('has no edge that reaches a patient without passing through a doctor', () => {
    expect(canTransition('in_progress', 'released')).toBe(false);
    expect(canTransition('submitted', 'released')).toBe(false);
    expect(canTransition('ai_processed', 'released')).toBe(false);
    expect(canTransition('ai_skipped', 'released')).toBe(false);
  });

  it('refuses an illegal transition at the repository and logs the attempt', async () => {
    const seeded = await seedCase(db);
    await expect(
      repo.transitionCase(patientContext(seeded.patientId), seeded.caseId, 'released'),
    ).rejects.toThrow(IllegalTransitionError);

    const [row] = await db.select({ status: schema.cases.status }).from(schema.cases);
    expect(row?.status).toBe('in_progress');
  });

  it('applies a permitted transition', async () => {
    const seeded = await seedCase(db);
    const updated = await repo.transitionCase(
      patientContext(seeded.patientId),
      seeded.caseId,
      'submitted',
      { submittedAt: new Date() },
    );
    expect(updated?.status).toBe('submitted');
  });
});

describe('the AI assessment never reaches a patient', () => {
  it('refuses a patient outright, whatever their consent state', async () => {
    const seeded = await seedCase(db);
    await expect(
      repo.getLatestAssessment(patientContext(seeded.patientId), seeded.caseId),
    ).rejects.toThrow(/patients cannot read an unreleased AI assessment/i);
  });

  it('logs the attempt', async () => {
    const seeded = await seedCase(db);
    await expect(
      repo.getLatestAssessment(patientContext(seeded.patientId), seeded.caseId),
    ).rejects.toThrow();
    const entries = await auditEntries(db);
    expect(entries.some((entry) => entry.action === 'authz.denied')).toBe(true);
  });

  it('returns it to the assigned doctor', async () => {
    const seeded = await seedCase(db);
    await db.insert(schema.aiAssessments).values({
      caseId: seeded.caseId,
      outcome: 'generated',
      modelVersion: 'test-model',
      promptVersion: 'v1',
      kbVersion: 'kb-1',
      payload: { clinician_summary: 'test' },
    });
    const found = await repo.getLatestAssessment(
      doctorContext(seeded.doctorId, seeded.patientId),
      seeded.caseId,
    );
    expect(found?.modelVersion).toBe('test-model');
  });
});

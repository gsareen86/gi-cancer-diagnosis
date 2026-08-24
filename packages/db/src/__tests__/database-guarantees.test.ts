import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { openDatabase, schema, truncateAll, createUser } from './harness';

/**
 * Guarantees that live in the database rather than in application code. These are the ones an
 * application bug, a stray migration, or a compromised process must not be able to undo.
 */

const { db, close } = openDatabase();
afterAll(close);
beforeEach(() => truncateAll(db));

async function asApplicationRole<T>(work: () => Promise<T>): Promise<T> {
  await db.execute(sql`SET ROLE gi_compass_app`);
  try {
    return await work();
  } finally {
    await db.execute(sql`RESET ROLE`);
  }
}

describe('the audit trail is append-only at the privilege level', () => {
  beforeEach(async () => {
    await db.insert(schema.auditLogEntries).values({
      action: 'case.read',
      targetType: 'case',
      targetId: 'case-1',
      actorRole: 'doctor',
    });
  });

  it('lets the application role insert', async () => {
    await asApplicationRole(async () => {
      await db.execute(sql`
        INSERT INTO audit_log_entries (action, target_type) VALUES ('case.read', 'case')
      `);
    });
    expect(await db.select().from(schema.auditLogEntries)).toHaveLength(2);
  });

  it('lets the application role read', async () => {
    const rows = await asApplicationRole(async () =>
      db.execute(sql`SELECT count(*)::int AS n FROM audit_log_entries`),
    );
    expect((rows.rows[0] as { n: number }).n).toBe(1);
  });

  it('refuses UPDATE from the application role — permission, not application logic', async () => {
    await expect(
      asApplicationRole(async () =>
        db.execute(sql`UPDATE audit_log_entries SET action = 'tampered'`),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('refuses DELETE from the application role', async () => {
    await expect(
      asApplicationRole(async () => db.execute(sql`DELETE FROM audit_log_entries`)),
    ).rejects.toThrow(/permission denied/i);
  });

  it('refuses TRUNCATE from the application role', async () => {
    await expect(
      asApplicationRole(async () => db.execute(sql`TRUNCATE audit_log_entries`)),
    ).rejects.toThrow(/permission denied|must be owner/i);
  });

  it('refuses UPDATE even from the table owner, via the trigger', async () => {
    await expect(db.execute(sql`UPDATE audit_log_entries SET action = 'tampered'`)).rejects.toThrow(
      /append-only/i,
    );
  });

  it('leaves the application role able to update ordinary clinical tables', async () => {
    const userId = await createUser(db, 'patient');
    await asApplicationRole(async () => {
      await db.execute(sql`UPDATE users SET locale = 'hi' WHERE id = ${userId}::uuid`);
    });
    const [row] = await db.select({ locale: schema.users.locale }).from(schema.users);
    expect(row?.locale).toBe('hi');
  });
});

describe('the audit trail survives erasure of the subject', () => {
  it('keeps entries after the subject’s row is deleted, referenced pseudonymously', async () => {
    const patientId = await createUser(db, 'patient');
    await db.insert(schema.auditLogEntries).values({
      action: 'response.write',
      targetType: 'case',
      targetId: 'case-9',
      subjectId: patientId,
      actorId: patientId,
      actorRole: 'patient',
    });

    await db.execute(sql`DELETE FROM users WHERE id = ${patientId}::uuid`);

    const rows = await db.select().from(schema.auditLogEntries);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.subjectId).toBe(patientId);
  });
});

describe('one draft case per patient', () => {
  it('is enforced by a partial unique index, not by a read-then-write race', async () => {
    const patientId = await createUser(db, 'patient');
    const adminId = await createUser(db, 'clinical_admin');
    const [template] = await db
      .insert(schema.questionnaireTemplates)
      .values({ key: 'draft-test', name: 'Draft test' })
      .returning({ id: schema.questionnaireTemplates.id });
    const [version] = await db
      .insert(schema.templateVersions)
      .values({ templateId: template!.id, version: 1, status: 'published', content: {}, createdBy: adminId })
      .returning({ id: schema.templateVersions.id });

    const draft = {
      patientId,
      templateVersionId: version!.id,
      entryPointId: 'ep_pain',
      status: 'in_progress' as const,
    };
    await db.insert(schema.cases).values(draft);
    await expect(db.insert(schema.cases).values(draft)).rejects.toThrow(/duplicate key|unique/i);

    // A second *submitted* case is fine; only drafts are limited to one.
    await db.insert(schema.cases).values({ ...draft, status: 'submitted' });
    expect(await db.select().from(schema.cases)).toHaveLength(2);
  });
});

describe('one live doctor assignment per case', () => {
  it('is enforced by a partial unique index', async () => {
    const patientId = await createUser(db, 'patient');
    const doctorA = await createUser(db, 'doctor');
    const doctorB = await createUser(db, 'doctor');
    const adminId = await createUser(db, 'platform_admin');
    const [template] = await db
      .insert(schema.questionnaireTemplates)
      .values({ key: 'assign-test', name: 'Assign test' })
      .returning({ id: schema.questionnaireTemplates.id });
    const [version] = await db
      .insert(schema.templateVersions)
      .values({ templateId: template!.id, version: 1, status: 'published', content: {}, createdBy: adminId })
      .returning({ id: schema.templateVersions.id });
    const [caseRow] = await db
      .insert(schema.cases)
      .values({ patientId, templateVersionId: version!.id, entryPointId: 'ep_pain' })
      .returning({ id: schema.cases.id });

    await db.insert(schema.caseAssignments).values({
      caseId: caseRow!.id,
      doctorId: doctorA,
      assignedBy: adminId,
    });
    await expect(
      db.insert(schema.caseAssignments).values({
        caseId: caseRow!.id,
        doctorId: doctorB,
        assignedBy: adminId,
      }),
    ).rejects.toThrow(/duplicate key|unique/i);
  });
});

describe('pgvector retrieval', () => {
  async function seedChunks() {
    const authorId = await createUser(db, 'doctor');
    const [entry] = await db
      .insert(schema.knowledgeBaseEntries)
      .values({
        entryKey: 'melaena-workup',
        version: 1,
        title: 'Melaena work-up',
        content: 'Guidance on black tarry stool.',
        authorId,
      })
      .returning({ id: schema.knowledgeBaseEntries.id });

    const vectors: Array<[number, number, number, string[]]> = [
      [1, 0, 0, ['bleeding']],
      [0.9, 0.1, 0, ['bleeding']],
      [0, 1, 0, ['hepatobiliary']],
      [0, 0, 1, ['reflux_upper_gi']],
    ];
    for (const [index, [x, y, z, clusters]] of vectors.entries()) {
      const embedding = [x, y, z, ...Array.from({ length: 1021 }, () => 0)];
      await db.execute(sql`
        INSERT INTO knowledge_base_chunks (entry_id, ordinal, text, clusters, embedding)
        VALUES (
          ${entry!.id}::uuid, ${index}, ${`chunk ${index}`},
          ${sql.raw(`ARRAY[${clusters.map((c) => `'${c}'`).join(',')}]::text[]`)},
          ${`[${embedding.join(',')}]`}::vector
        )
      `);
    }
  }

  it('returns nearest neighbours in similarity order', async () => {
    await seedChunks();
    const query = [1, 0, 0, ...Array.from({ length: 1021 }, () => 0)];
    const result = await db.execute(sql`
      SELECT ordinal, embedding <=> ${`[${query.join(',')}]`}::vector AS distance
      FROM knowledge_base_chunks
      ORDER BY distance ASC
      LIMIT 3
    `);
    const ordinals = result.rows.map((row) => (row as { ordinal: number }).ordinal);
    expect(ordinals[0]).toBe(0);
    expect(ordinals[1]).toBe(1);
  });

  it('filters by symptom cluster before ranking, so a hepatobiliary case prefers hepatobiliary entries', async () => {
    await seedChunks();
    const query = [0.7, 0.7, 0, ...Array.from({ length: 1021 }, () => 0)];
    const result = await db.execute(sql`
      SELECT ordinal FROM knowledge_base_chunks
      WHERE clusters && ARRAY['hepatobiliary']::text[]
      ORDER BY embedding <=> ${`[${query.join(',')}]`}::vector ASC
      LIMIT 1
    `);
    expect((result.rows[0] as { ordinal: number }).ordinal).toBe(2);
  });

  it('removes chunks when their entry is superseded and deleted, so retrieval cannot match stale content', async () => {
    await seedChunks();
    await db.execute(sql`DELETE FROM knowledge_base_entries`);
    const remaining = await db.select().from(schema.knowledgeBaseChunks);
    expect(remaining).toEqual([]);
  });
});

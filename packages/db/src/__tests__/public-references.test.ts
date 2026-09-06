import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { openDatabase, schema, truncateAll, seedCase, createUser } from './harness';

const { db, close } = openDatabase();
afterAll(async () => { await truncateAll(db); await close(); });
beforeEach(() => truncateAll(db));

describe('database allocated public references', () => {
  it('assigns unique references without changing primary keys or longitudinal patient identity', async () => {
    const seeded = await seedCase(db);
    const [first] = await db.select().from(schema.cases).where(eq(schema.cases.id, seeded.caseId));
    if (!first) throw new Error('missing fixture');
    const created = await Promise.all(Array.from({ length: 5 }, () => db.insert(schema.cases).values({
      patientId: seeded.patientId, templateVersionId: first.templateVersionId,
      entryPointId: first.entryPointId, status: 'submitted',
    }).returning()));
    expect(new Set([first, ...created.flat()].map((row) => row.publicNumber)).size).toBe(6);
    expect(created.flat().every((row) => row.patientId === seeded.patientId)).toBe(true);
    await db.update(schema.users).set({ locale: 'hi' }).where(eq(schema.users.id, seeded.patientId));
    await createUser(db, 'patient');
    const people = await db.select().from(schema.users);
    expect(new Set(people.map((row) => row.publicNumber)).size).toBe(people.length);
    expect(people.every((row) => row.publicNumber >= 100001)).toBe(true);
    const [after] = await db.select().from(schema.cases).where(eq(schema.cases.id, seeded.caseId));
    expect(after?.publicNumber).toBe(first.publicNumber);
    expect(after?.id).toBe(seeded.caseId);
  });

  it('rejects reference changes even from the database owner', async () => {
    const seeded = await seedCase(db);
    await expect(db.execute(sql`UPDATE users SET public_number = public_number + 999 WHERE id = ${seeded.patientId}::uuid`)).rejects.toThrow(/only be updated to DEFAULT/);
    await expect(db.execute(sql`UPDATE users SET public_number = DEFAULT WHERE id = ${seeded.patientId}::uuid`)).rejects.toThrow(/immutable/);
    await expect(db.execute(sql`UPDATE cases SET public_number = DEFAULT WHERE id = ${seeded.caseId}::uuid`)).rejects.toThrow(/immutable/);
  });
});

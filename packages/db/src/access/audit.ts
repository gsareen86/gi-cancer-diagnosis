import { auditLogEntries } from '../schema';
import type { AccessContext, AccessDescriptor } from './context';
import type { Database } from '../client';

/**
 * Writes the audit entry. Always called inside the same transaction as the operation it
 * describes: if this insert fails, the clinical write it accompanies is rolled back rather than
 * proceeding unrecorded.
 *
 * Entries name what was accessed. They never copy the clinical content, or the audit store
 * becomes a second uncontrolled copy of patient health data.
 */

export type AuditOutcome = 'allowed' | 'denied' | 'failed';

export interface AuditWriter {
  write(
    tx: Database,
    context: AccessContext,
    descriptor: AccessDescriptor,
    outcome: AuditOutcome,
  ): Promise<void>;
}

/** Metadata keys that would smuggle clinical content into the audit trail. */
const FORBIDDEN_METADATA_KEYS = new Set([
  'value',
  'answer',
  'answerValue',
  'content',
  'text',
  'payload',
  'body',
  'extract',
  'summary',
  'notes',
]);

export class ClinicalMetadataInAuditError extends Error {
  constructor(key: string) {
    super(
      `Audit metadata key "${key}" would place clinical content in the audit trail. ` +
        'Record an identifier instead.',
    );
    this.name = 'ClinicalMetadataInAuditError';
  }
}

export function assertNonClinicalMetadata(metadata: Record<string, unknown> | undefined): void {
  if (metadata === undefined) return;
  for (const key of Object.keys(metadata)) {
    if (FORBIDDEN_METADATA_KEYS.has(key)) throw new ClinicalMetadataInAuditError(key);
  }
}

export const databaseAuditWriter: AuditWriter = {
  async write(tx, context, descriptor, outcome) {
    assertNonClinicalMetadata(descriptor.metadata);
    await tx.insert(auditLogEntries).values({
      actorId: context.actor.id,
      actorRole: context.actor.role,
      action: descriptor.action,
      targetType: descriptor.targetType,
      targetId: descriptor.targetId ?? null,
      subjectId: context.subjectId,
      outcome,
      ipHash: context.request?.ipHash ?? null,
      userAgent: context.request?.userAgent ?? null,
      metadata: {
        ...(descriptor.metadata ?? {}),
        ...(context.elevationId === undefined ? {} : { elevationId: context.elevationId }),
      },
    });
  },
};

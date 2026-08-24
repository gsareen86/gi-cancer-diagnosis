import { and, eq, gt, isNull } from 'drizzle-orm';
import { adminElevations, caseAssignments, cases } from '../schema';
import { AuthorizationError } from '../errors';
import type { AccessContext } from './context';
import type { Database } from '../client';

/**
 * Authorization decisions. Every one of these runs server-side before any clinical row is read;
 * hiding an action in the interface is not an access control.
 */

export interface CaseIdentity {
  id: string;
  patientId: string;
  assignedDoctorId: string | null;
}

export async function loadCaseIdentity(
  db: Database,
  caseId: string,
): Promise<CaseIdentity | null> {
  const [row] = await db
    .select({
      id: cases.id,
      patientId: cases.patientId,
      assignedDoctorId: cases.assignedDoctorId,
    })
    .from(cases)
    .where(eq(cases.id, caseId))
    .limit(1);
  return row ?? null;
}

async function hasLiveAssignment(db: Database, caseId: string, doctorId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: caseAssignments.id })
    .from(caseAssignments)
    .where(
      and(
        eq(caseAssignments.caseId, caseId),
        eq(caseAssignments.doctorId, doctorId),
        isNull(caseAssignments.endedAt),
      ),
    )
    .limit(1);
  return row !== undefined;
}

async function hasLiveElevation(
  db: Database,
  adminId: string,
  elevationId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: adminElevations.id })
    .from(adminElevations)
    .where(
      and(
        eq(adminElevations.id, elevationId),
        eq(adminElevations.adminId, adminId),
        gt(adminElevations.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row !== undefined;
}

/**
 * Decides whether this actor may reach this case at all.
 *
 * A patient asking for someone else's case gets the same answer as one asking for a case that
 * does not exist — otherwise the identifier space is an enumeration oracle.
 */
export async function authorizeCaseAccess(
  db: Database,
  context: AccessContext,
  caseIdentity: CaseIdentity | null,
): Promise<void> {
  if (caseIdentity === null) {
    throw new AuthorizationError('case does not exist', { notFound: true });
  }

  if (caseIdentity.patientId !== context.subjectId) {
    throw new AuthorizationError('access context subject does not own this case', {
      notFound: true,
    });
  }

  switch (context.actor.role) {
    case 'system':
      return;

    case 'patient': {
      if (context.actor.id !== caseIdentity.patientId) {
        throw new AuthorizationError('patients may reach only their own cases', { notFound: true });
      }
      return;
    }

    case 'doctor': {
      const doctorId = context.actor.id;
      if (doctorId === null) throw new AuthorizationError('doctor actor has no identity');
      // Assignment is checked live, so revoking it ends access on the next request rather than
      // whenever the doctor's session happens to expire.
      if (!(await hasLiveAssignment(db, caseIdentity.id, doctorId))) {
        throw new AuthorizationError('doctor is not assigned to this case', { notFound: true });
      }
      return;
    }

    case 'clinical_admin':
      // Full authority over clinical *content*, none over patient clinical data. The separation
      // is the point: the same person may author every question and still not read the answers.
      throw new AuthorizationError('clinical admins have no access to patient clinical data');

    case 'platform_admin': {
      const adminId = context.actor.id;
      const elevationId = context.elevationId;
      if (adminId === null || elevationId === undefined) {
        throw new AuthorizationError('platform admins need an active elevation to read clinical data');
      }
      if (!(await hasLiveElevation(db, adminId, elevationId))) {
        throw new AuthorizationError('elevation is unknown or has expired');
      }
      return;
    }
  }
}

/** Only a platform admin may read the audit trail, and doing so is itself audited. */
export function authorizeAuditRead(context: AccessContext): void {
  if (context.actor.role !== 'platform_admin') {
    throw new AuthorizationError('only platform admins may read the audit trail');
  }
}

/** Roles are granted, never self-selected: self-registration always yields `patient`. */
export function authorizeRoleGrant(context: AccessContext): void {
  if (context.actor.role !== 'platform_admin') {
    throw new AuthorizationError('only platform admins may grant roles');
  }
}

import type { ConsentPurpose } from '@gi-compass/core';

export type ActorRole = 'patient' | 'doctor' | 'clinical_admin' | 'platform_admin' | 'system';

/**
 * Required by every clinical read and write. It is a positional argument rather than ambient
 * state on purpose: a route handler that forgets it does not compile, which is the only reliable
 * way to keep consent gating and audit logging from being optional.
 */
export interface AccessContext {
  actor: {
    /** Null only for the system pipeline, which acts on no user's behalf. */
    id: string | null;
    role: ActorRole;
  };
  /** The patient whose data is being reached. Consent is evaluated against this person. */
  subjectId: string;
  /** Why this data is being processed. Consent is per purpose, so this is never implicit. */
  purpose: ConsentPurpose;
  request?: {
    ipHash?: string | undefined;
    userAgent?: string | undefined;
  };
  /** Present only for a platform admin acting under a live, reason-carrying elevation. */
  elevationId?: string | undefined;
}

export interface AccessDescriptor {
  /** Dotted verb recorded in the audit trail, e.g. `case.read`, `response.write`. */
  action: string;
  targetType: string;
  targetId?: string | undefined;
  /** Non-clinical context only. Never an answer value or document content. */
  metadata?: Record<string, unknown> | undefined;
}

export const systemContext = (
  subjectId: string,
  purpose: ConsentPurpose,
): AccessContext => ({
  actor: { id: null, role: 'system' },
  subjectId,
  purpose,
});

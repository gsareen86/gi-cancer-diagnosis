/** Errors the API layer maps to status codes. Each carries enough to write an audit entry. */

export class AuthorizationError extends Error {
  readonly code = 'authz_denied';
  /**
   * `notFound` means the resource must be indistinguishable from one that does not exist —
   * a patient probing another patient's case identifier learns nothing from the response.
   */
  readonly notFound: boolean;
  readonly reason: string;

  constructor(reason: string, options: { notFound?: boolean } = {}) {
    super(`Access denied: ${reason}`);
    this.name = 'AuthorizationError';
    this.reason = reason;
    this.notFound = options.notFound ?? false;
  }
}

export class ConsentGateError extends Error {
  readonly code = 'consent_required';
  readonly purpose: string;
  readonly reason: string;

  constructor(purpose: string, reason: string) {
    super(`Processing for "${purpose}" is not permitted: ${reason}`);
    this.name = 'ConsentGateError';
    this.purpose = purpose;
    this.reason = reason;
  }
}

export class AuditWriteError extends Error {
  readonly code = 'audit_write_failed';

  constructor(cause: unknown) {
    super('The audit entry could not be written, so the operation was rolled back');
    this.name = 'AuditWriteError';
    this.cause = cause;
  }
}

export class IllegalTransitionError extends Error {
  readonly code = 'illegal_transition';

  constructor(from: string, to: string) {
    super(`A case cannot move from "${from}" to "${to}"`);
    this.name = 'IllegalTransitionError';
  }
}

/** No clinical content in the error: the caller must reload through authorized reads. */
export class DraftConflictError extends Error {
  constructor() {
    super('The draft has changed since this editor was loaded');
    this.name = 'DraftConflictError';
  }
}

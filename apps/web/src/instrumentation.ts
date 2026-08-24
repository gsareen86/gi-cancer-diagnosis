/**
 * Startup checks.
 *
 * `env()` validates configuration, but it did so lazily — the first request that touched a
 * setting threw, so a missing `DATABASE_URL` surfaced as a 500 on someone's registration attempt
 * with a stack trace in the server log. For a service holding clinical records that is the wrong
 * failure mode twice over: the operator learns about it from a patient, and the patient learns
 * about it as "something went wrong at our end".
 *
 * Next runs this once when the server starts. Validating here makes a misconfiguration a boot
 * failure with a message naming exactly what is missing, which is what `env()` always intended.
 */
export async function register(): Promise<void> {
  // Also runs in the edge runtime, which has no process env to validate and no database.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { env } = await import('./server/env');

  try {
    env();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(
      [
        '',
        '  GI Compass cannot start: its configuration is incomplete.',
        '',
        `  ${detail}`,
        '',
        '  Copy .env.example to .env in the repository root and fill it in.',
        '  A .env in apps/ or apps/web/ also works and takes precedence.',
        '  Real environment variables override both.',
        '',
      ].join('\n'),
    );
    // Refuse to serve. A half-configured clinical service that answers requests is more
    // dangerous than one that is plainly down.
    process.exit(1);
  }
}

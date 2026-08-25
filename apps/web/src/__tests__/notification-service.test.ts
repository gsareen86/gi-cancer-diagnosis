import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { ensureSeeded, makeUser, tables, truncateAll } from './api-harness';
import { database } from '@/server/db';
import {
  ClinicalContentInNotificationError,
  queueNotification,
  renderNotification,
  resetEmailTransport,
  setEmailTransport,
  type EmailTransport,
} from '@/server/services/notification-service';

/**
 * Notification delivery.
 *
 * The bug these cover: `SMTP_URL` was validated in the environment schema and then never used by
 * anything. Registration reported success, the delivery row said `sent`, and no mail server was
 * ever contacted — so a patient could register and had no way to verify, with nothing in the logs
 * or the database to suggest why.
 *
 * The delivery table exists to answer "was this person actually told?". A development default
 * that writes `sent` when nothing left the process makes it answer wrongly, which is worse than
 * not recording at all.
 */

beforeAll(ensureSeeded);
beforeEach(truncateAll);
afterEach(() => {
  resetEmailTransport();
  vi.unstubAllEnvs();
});

function recordingTransport(delivers: boolean) {
  const sent: Array<{ to: string; subject: string; body: string }> = [];
  const transport: EmailTransport = {
    delivers,
    async send(message) {
      sent.push(message);
    },
  };
  return { transport, sent };
}

async function deliveryFor(userId: string) {
  const [row] = await database()
    .select()
    .from(tables.notificationDeliveries)
    .where(eq(tables.notificationDeliveries.userId, userId));
  return row;
}

describe('the message a patient receives', () => {
  it('carries the verification link, so registration can actually be completed', () => {
    const rendered = renderNotification('email_verification', 'en', {
      link: 'http://localhost:3000/verify-email?token=abc123',
      reference: '',
    });

    expect(rendered.body).toContain('http://localhost:3000/verify-email?token=abc123');
    expect(rendered.subject).toBe('Confirm your email address');
  });

  it('carries the reset link', () => {
    const rendered = renderNotification('password_reset', 'en', {
      link: 'http://localhost:3000/reset-password?token=xyz789',
      reference: '',
    });
    expect(rendered.body).toContain('token=xyz789');
  });

  it('still refuses to render anything clinical', () => {
    expect(() =>
      renderNotification('case_released', 'en', {
        link: 'http://localhost:3000/cases/1',
        reference: '1',
        // A variable that would put a finding into an email.
        redFlagBasis: 'black tarry stool with lightheadedness',
      }),
    ).toThrow(ClinicalContentInNotificationError);
  });
});

describe('the delivery record tells the truth', () => {
  it('records `sent` when a mail server actually accepted the message', async () => {
    const user = await makeUser({ role: 'patient' });
    const { transport, sent } = recordingTransport(true);
    setEmailTransport(transport);

    await queueNotification({ userId: user.id, type: 'email_verification', token: 'tok' });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe(user.email);

    const delivery = await deliveryFor(user.id);
    expect(delivery?.outcome).toBe('sent');
    expect(delivery?.sentAt).not.toBeNull();
  });

  it('records `logged_only` when there is no mail server, never `sent`', async () => {
    const user = await makeUser({ role: 'patient' });
    const { transport } = recordingTransport(false);
    setEmailTransport(transport);

    await queueNotification({ userId: user.id, type: 'email_verification', token: 'tok' });

    const delivery = await deliveryFor(user.id);
    expect(delivery?.outcome).toBe('logged_only');
    expect(delivery?.failureReason).toBe('no_smtp_configured');
  });

  it('records a hard bounce when the mail server refuses, without failing the caller', async () => {
    const user = await makeUser({ role: 'patient' });
    setEmailTransport({
      delivers: true,
      async send() {
        throw new Error('connection refused');
      },
    });

    // Registration must still succeed: a mail outage is not a reason to lose the account.
    await expect(
      queueNotification({ userId: user.id, type: 'email_verification', token: 'tok' }),
    ).resolves.toBeUndefined();

    const delivery = await deliveryFor(user.id);
    expect(delivery?.outcome).toBe('hard_bounced');
  });

  it('never stores the token, so the delivery row is not a second place to read a link from', async () => {
    const user = await makeUser({ role: 'patient' });
    setEmailTransport(recordingTransport(true).transport);

    await queueNotification({
      userId: user.id,
      type: 'password_reset',
      token: 'a-very-secret-reset-token',
    });

    const delivery = await deliveryFor(user.id);
    expect(JSON.stringify(delivery)).not.toContain('a-very-secret-reset-token');
  });
});

describe('transport selection', () => {
  it('uses SMTP when SMTP_URL is configured', async () => {
    vi.stubEnv('SMTP_URL', 'smtp://127.0.0.1:1025');
    resetEmailTransport();

    const user = await makeUser({ role: 'patient' });
    const attempted = vi.fn();

    // The real SMTP transport is chosen; proving that without a live server means letting the
    // connection fail and observing that it was tried rather than silently skipped.
    await queueNotification({ userId: user.id, type: 'email_verification', token: 'tok' });
    attempted();

    const delivery = await deliveryFor(user.id);
    // Either it reached a local Mailpit, or it could not connect. Both prove SMTP was attempted;
    // what must never happen is `logged_only`, which would mean SMTP_URL was ignored again.
    expect(['sent', 'hard_bounced']).toContain(delivery?.outcome);
    expect(delivery?.outcome).not.toBe('logged_only');
  });

  it('falls back to the log when SMTP_URL is absent', async () => {
    vi.stubEnv('SMTP_URL', '');
    resetEmailTransport();

    const user = await makeUser({ role: 'patient' });
    await queueNotification({ userId: user.id, type: 'email_verification', token: 'tok' });

    expect((await deliveryFor(user.id))?.outcome).toBe('logged_only');
  });
});

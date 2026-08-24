import { eq } from 'drizzle-orm';
import { tables } from '@gi-compass/db';
import { database } from '../db';
import { env } from '../env';

/**
 * Transactional notifications.
 *
 * The hard rule: a notification never carries clinical content. It says something is waiting and
 * asks the recipient to sign in. That keeps questionnaire answers, red flags, and released
 * summaries out of a channel the platform does not control — and out of the notification table,
 * which would otherwise become a second copy of the clinical record.
 *
 * Delivery outcomes are recorded so a hard bounce is visible to an operator, but a failed email
 * never blocks the clinical workflow: a released summary stands whether or not its email arrived.
 */

export type NotificationType =
  | 'email_verification'
  | 'password_reset'
  | 'case_submitted'
  | 'case_released'
  | 'doctor_case_queued'
  | 'doctor_urgent_case';

export interface NotificationRequest {
  userId: string;
  type: NotificationType;
  /** A one-time token for verification or reset links. Never persisted in the delivery record. */
  token?: string;
  /** A non-clinical reference such as a case identifier. */
  reference?: string;
  locale?: string;
}

/** Keys whose presence in a template variable would mean clinical content is being rendered. */
const CLINICAL_VARIABLE_KEYS = [
  'answer',
  'answers',
  'diagnosis',
  'differential',
  'findings',
  'redFlag',
  'red_flags',
  'summary',
  'assessment',
  'symptom',
  'condition',
];

export class ClinicalContentInNotificationError extends Error {
  constructor(key: string) {
    super(
      `Notification template variable "${key}" carries clinical content. Notifications tell the ` +
        'recipient to sign in; they never contain findings.',
    );
    this.name = 'ClinicalContentInNotificationError';
  }
}

/**
 * Refuses to render when a variable would put clinical content into an email. Rendering fails
 * rather than the content leaking — the notification simply is not sent.
 */
export function assertNoClinicalVariables(variables: Record<string, unknown>): void {
  for (const key of Object.keys(variables)) {
    const normalized = key.toLowerCase();
    if (CLINICAL_VARIABLE_KEYS.some((clinical) => normalized.includes(clinical.toLowerCase()))) {
      throw new ClinicalContentInNotificationError(key);
    }
  }
}

export interface RenderedEmail {
  subject: string;
  body: string;
}

type TemplateRenderer = (variables: Record<string, string>) => RenderedEmail;

/**
 * Subjects and bodies deliberately say nothing about why the person is being contacted beyond
 * the workflow step. "Your assessment is ready" already tells anyone glancing at a lock screen
 * that this person is being investigated for something.
 */
const TEMPLATES: Record<NotificationType, Record<string, TemplateRenderer>> = {
  email_verification: {
    en: (v) => ({
      subject: 'Confirm your email address',
      body: `Please confirm your email address to finish setting up your account:\n\n${v.link}\n\nThis link expires in 24 hours. If you did not create an account, ignore this message.`,
    }),
    hi: (v) => ({
      subject: 'अपना ईमेल पता सत्यापित करें',
      body: `अपना खाता पूरा करने के लिए कृपया अपना ईमेल पता सत्यापित करें:\n\n${v.link}\n\nयह लिंक 24 घंटे में समाप्त हो जाएगा। यदि आपने खाता नहीं बनाया है, तो इस संदेश को अनदेखा करें।`,
    }),
  },
  password_reset: {
    en: (v) => ({
      subject: 'Reset your password',
      body: `Use this link to set a new password:\n\n${v.link}\n\nThis link expires in one hour and can be used once. If you did not ask for this, ignore this message — your password has not changed.`,
    }),
    hi: (v) => ({
      subject: 'अपना पासवर्ड रीसेट करें',
      body: `नया पासवर्ड सेट करने के लिए इस लिंक का उपयोग करें:\n\n${v.link}\n\nयह लिंक एक घंटे में समाप्त होगा और एक ही बार उपयोग हो सकता है। यदि आपने यह अनुरोध नहीं किया, तो इसे अनदेखा करें — आपका पासवर्ड नहीं बदला है।`,
    }),
  },
  case_submitted: {
    en: (v) => ({
      subject: 'We have received your questionnaire',
      body: `Your questionnaire (reference ${v.reference}) has been received and is waiting for a doctor to review it.\n\nWe will email you when the review is complete. Nothing in this message is a medical opinion.\n\nIf your symptoms get worse, do not wait — seek care in person.`,
    }),
    hi: (v) => ({
      subject: 'हमें आपकी प्रश्नावली मिल गई है',
      body: `आपकी प्रश्नावली (संदर्भ ${v.reference}) प्राप्त हो गई है और डॉक्टर की समीक्षा की प्रतीक्षा में है।\n\nसमीक्षा पूरी होने पर हम आपको ईमेल करेंगे। इस संदेश में कोई चिकित्सकीय राय नहीं है।\n\nयदि लक्षण बढ़ें तो प्रतीक्षा न करें — तुरंत आमने-सामने चिकित्सा लें।`,
    }),
  },
  case_released: {
    en: (v) => ({
      subject: 'A doctor has reviewed your questionnaire',
      body: `A doctor has finished reviewing your questionnaire (reference ${v.reference}).\n\nSign in to read what they wrote and what they suggest as next steps.\n\n${v.link}`,
    }),
    hi: (v) => ({
      subject: 'डॉक्टर ने आपकी प्रश्नावली की समीक्षा कर ली है',
      body: `डॉक्टर ने आपकी प्रश्नावली (संदर्भ ${v.reference}) की समीक्षा पूरी कर ली है।\n\nउन्होंने क्या लिखा है और आगे क्या करने का सुझाव दिया है, यह पढ़ने के लिए साइन इन करें।\n\n${v.link}`,
    }),
  },
  doctor_case_queued: {
    en: (v) => ({
      subject: 'A case is waiting for review',
      body: `Case ${v.reference} has been assigned to you for review.\n\n${v.link}`,
    }),
    hi: (v) => ({
      subject: 'एक केस समीक्षा के लिए प्रतीक्षारत है',
      body: `केस ${v.reference} आपको समीक्षा के लिए सौंपा गया है।\n\n${v.link}`,
    }),
  },
  doctor_urgent_case: {
    en: (v) => ({
      subject: 'Urgent: a case needs review',
      body: `Case ${v.reference} has been flagged urgent and assigned to you.\n\n${v.link}`,
    }),
    hi: (v) => ({
      subject: 'अत्यावश्यक: एक केस को समीक्षा चाहिए',
      body: `केस ${v.reference} को अत्यावश्यक चिह्नित कर आपको सौंपा गया है।\n\n${v.link}`,
    }),
  },
};

export function renderNotification(
  type: NotificationType,
  locale: string,
  variables: Record<string, string>,
): RenderedEmail {
  assertNoClinicalVariables(variables);
  const byLocale = TEMPLATES[type];
  const renderer = byLocale[locale] ?? byLocale.en;
  if (!renderer) throw new Error(`No template for notification type "${type}"`);
  return renderer(variables);
}

export interface EmailTransport {
  send(input: { to: string; subject: string; body: string }): Promise<void>;
}

/**
 * Development transport. Logs the metadata and, for verification and reset, the link — because
 * without a mail server there is otherwise no way to complete those flows locally. It never logs
 * clinical content, because notifications never contain any.
 */
const consoleTransport: EmailTransport = {
  async send({ to, subject }) {
    console.info(`[notification] to=${to} subject=${JSON.stringify(subject)}`);
  },
};

let transport: EmailTransport = consoleTransport;

export function setEmailTransport(next: EmailTransport): void {
  transport = next;
}

export function baseUrl(): string {
  return process.env.APP_BASE_URL ?? 'http://localhost:3000';
}

function linkFor(type: NotificationType, token: string | undefined, reference: string | undefined): string {
  switch (type) {
    case 'email_verification':
      return `${baseUrl()}/verify-email?token=${token ?? ''}`;
    case 'password_reset':
      return `${baseUrl()}/reset-password?token=${token ?? ''}`;
    case 'case_released':
      return `${baseUrl()}/cases/${reference ?? ''}`;
    case 'doctor_case_queued':
    case 'doctor_urgent_case':
      return `${baseUrl()}/doctor/cases/${reference ?? ''}`;
    default:
      return baseUrl();
  }
}

export async function queueNotification(request: NotificationRequest): Promise<void> {
  const db = database();
  const [user] = await db
    .select({ email: tables.users.email, locale: tables.users.locale, status: tables.users.status })
    .from(tables.users)
    .where(eq(tables.users.id, request.userId))
    .limit(1);

  const locale = request.locale ?? user?.locale ?? 'en';

  const [delivery] = await db
    .insert(tables.notificationDeliveries)
    .values({
      userId: request.userId,
      type: request.type,
      locale,
      // The reference is a case identifier at most. The token is never stored: the delivery
      // record must not be a second place a reset link can be read from.
      reference: request.reference ?? null,
      outcome: 'queued',
    })
    .returning({ id: tables.notificationDeliveries.id });

  if (!user || user.status === 'erased') {
    // The account went away between queueing and sending. Drop it and record the drop.
    if (delivery) {
      await db
        .update(tables.notificationDeliveries)
        .set({ outcome: 'dropped', failedAt: new Date(), failureReason: 'account_erased' })
        .where(eq(tables.notificationDeliveries.id, delivery.id));
    }
    return;
  }

  try {
    const rendered = renderNotification(request.type, locale, {
      link: linkFor(request.type, request.token, request.reference),
      reference: request.reference ?? '',
    });
    await transport.send({ to: user.email, subject: rendered.subject, body: rendered.body });
    if (delivery) {
      await db
        .update(tables.notificationDeliveries)
        .set({ outcome: 'sent', sentAt: new Date() })
        .where(eq(tables.notificationDeliveries.id, delivery.id));
    }
  } catch (error) {
    // A failed notification is recorded and surfaced, never allowed to fail the clinical action
    // that triggered it.
    if (delivery) {
      await db
        .update(tables.notificationDeliveries)
        .set({
          outcome: 'hard_bounced',
          failedAt: new Date(),
          failureReason: error instanceof Error ? error.name : 'unknown',
        })
        .where(eq(tables.notificationDeliveries.id, delivery.id));
    }
    console.error('[notification] delivery failed', { type: request.type, error });
  }
}

export function configuredSender(): string {
  return env().EMAIL_FROM;
}

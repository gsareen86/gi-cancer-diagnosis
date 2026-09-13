'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { api, type ApiProblem } from '@/lib/api-client';
import { Notice } from './primitives';

interface Message { id: string; body: string; sentAt: string; mine: boolean }

/** Clinician-authored clarification in the case context. No AI insertion or emergency dispatch. */
export function CaseMessages({ caseId }: { caseId: string }) {
  const t = useTranslations('messages');
  const all = useTranslations();
  const format = useFormatter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const endpoint = `/api/doctor/cases/${caseId}/messages`;
  const load = useCallback(async () => {
    const result = await api.get<{ messages: Message[] }>(endpoint);
    if (result.ok) { setMessages(result.data.messages); setLoaded(true); }
    else setProblem(result.problem);
  }, [endpoint]);
  useEffect(() => { void load(); }, [load]);
  async function send() {
    if (pending || !draft.trim()) return;
    setPending(true); setProblem(null);
    const result = await api.post(endpoint, { body: draft.trim() });
    setPending(false);
    if (!result.ok) { setProblem(result.problem); return; }
    setDraft(''); await load();
  }
  return <section className="mt-6 rounded-xl border border-line bg-surface p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{t('heading')}</h2><button type="button" className="gi-button-secondary" onClick={() => void load()}>{t('refresh')}</button></div>
    <p className="mt-2 text-sm text-ink-muted">{t('hint')}</p>
    {loaded && messages.length === 0 && <p className="my-4 text-sm text-ink-muted">{t('empty')}</p>}
    <ol className="my-4 max-h-[28rem] space-y-3 overflow-y-auto" aria-label={t('heading')}>
      {messages.map(message => <li key={message.id} className={`rounded-lg border border-line p-3 ${message.mine ? 'bg-accent-faint' : 'bg-surface-sunken'}`}>
        <p className="text-xs font-semibold text-ink-muted">{t(message.mine ? 'you' : 'other')} · {format.dateTime(new Date(message.sentAt), { dateStyle: 'medium', timeStyle: 'short' })}</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm">{message.body}</p>
      </li>)}
    </ol>
    <label htmlFor={`message-${caseId}`} className="gi-label">{t('label')}</label>
    <textarea id={`message-${caseId}`} className="gi-input min-h-28" maxLength={4000} value={draft} disabled={pending} onChange={event => setDraft(event.target.value)} />
    {problem && <Notice role="alert" tone="urgent">{all(problem.messageKey as never)}</Notice>}
    <button type="button" className="gi-button-primary mt-3" disabled={pending || !loaded || !draft.trim()} onClick={() => void send()}>{t(pending ? 'sending' : 'send')}</button>
  </section>;
}

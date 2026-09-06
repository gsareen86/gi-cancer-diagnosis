'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { TONE_CLASSES, type Tone } from '@/components/primitives';
import { AlertIcon, CheckIcon, CloseIcon } from './icons';

/**
 * Action feedback.
 *
 * Every user-initiated action confirms its outcome — saving a review, claiming a case, removing
 * an upload, signing out. Without that, the only evidence a save worked is that nothing visibly
 * broke, which on a clinical record is not evidence.
 *
 * Two accessibility decisions are load-bearing. The viewport is a live region, so the message is
 * announced rather than only drawn. And an `emergency`-toned toast is `assertive` while
 * everything else is `polite`: a failed release must interrupt, a successful save must not.
 *
 * No toast carries a default string. Callers pass text from the catalogue.
 */

export interface ToastInput {
  message: string;
  tone?: Tone;
  /** Milliseconds before auto-dismiss. `0` keeps it until dismissed — use for failures. */
  duration?: number;
}

interface Toast extends Required<Pick<ToastInput, 'message'>> {
  id: number;
  tone: Tone;
  duration: number;
}

interface ToastContextValue {
  toast: (input: ToastInput) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (value === null) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return value;
}

/** The dismiss control's accessible name, which is prose and so has to come from the caller. */
export function ToastProvider({
  children,
  dismissLabel,
}: {
  children: ReactNode;
  dismissLabel: string;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const toast = useCallback((input: ToastInput) => {
    const tone = input.tone ?? 'accent';
    const id = nextId.current;
    nextId.current += 1;
    setToasts((current) => [
      ...current.slice(-3),
      {
        id,
        message: input.message,
        tone,
        // A failure stays until read. Success clears itself so the corner does not fill up.
        duration: input.duration ?? (tone === 'emergency' ? 0 : 5000),
      },
    ]);
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} dismissLabel={dismissLabel} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
  dismissLabel,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
  dismissLabel: string;
}) {
  const assertive = toasts.filter((entry) => entry.tone === 'emergency');
  const polite = toasts.filter((entry) => entry.tone !== 'emergency');

  return (
    <div className="gi-no-print pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6">
      <Region toasts={assertive} politeness="assertive" onDismiss={onDismiss} dismissLabel={dismissLabel} />
      <Region toasts={polite} politeness="polite" onDismiss={onDismiss} dismissLabel={dismissLabel} />
    </div>
  );
}

function Region({
  toasts,
  politeness,
  onDismiss,
  dismissLabel,
}: {
  toasts: Toast[];
  politeness: 'polite' | 'assertive';
  onDismiss: (id: number) => void;
  dismissLabel: string;
}) {
  return (
    <div
      role={politeness === 'assertive' ? 'alert' : 'status'}
      aria-live={politeness}
      className="flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((entry) => (
        <ToastRow key={entry.id} toast={entry} onDismiss={onDismiss} dismissLabel={dismissLabel} />
      ))}
    </div>
  );
}

function ToastRow({
  toast,
  onDismiss,
  dismissLabel,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
  dismissLabel: string;
}) {
  useEffect(() => {
    if (toast.duration === 0) return;
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  const failed = toast.tone === 'emergency' || toast.tone === 'urgent';

  return (
    <div
      className={`pointer-events-auto flex animate-gi-toast-in items-start gap-3 rounded-xl border p-3.5 shadow-overlay ${TONE_CLASSES[toast.tone]}`}
    >
      <span className="mt-0.5 shrink-0">
        {failed ? <AlertIcon className="h-4 w-4" /> : <CheckIcon className="h-4 w-4" />}
      </span>
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label={dismissLabel}
        className="-m-1 shrink-0 rounded p-1 opacity-70 transition-opacity hover:opacity-100"
      >
        <CloseIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

import type { ReactNode } from 'react';
import { CheckIcon } from './icons';

/**
 * The case milestone tracker.
 *
 * Every milestone is derived from the case record, never inferred from elapsed time. A patient
 * looking at this at 2am is asking one question — has anyone looked at my case — and a
 * progress bar that advances on a timer answers it dishonestly.
 *
 * Processing progress is separate from physician approval. A skipped step has its own marker
 * and must never look like a completed clinical review.
 */

export type MilestoneState = 'done' | 'current' | 'upcoming' | 'skipped';

export interface Milestone {
  id: string;
  label: ReactNode;
  detail?: ReactNode;
  state: MilestoneState;
}

export function Timeline({ milestones, label }: { milestones: Milestone[]; label: string }) {
  return (
    <ol aria-label={label} className="relative">
      {milestones.map((milestone, index) => {
        const last = index === milestones.length - 1;
        return (
          <li key={milestone.id} aria-current={milestone.state === 'current' ? 'step' : undefined} className="relative flex gap-4 pb-6 last:pb-0">
            {!last && (
              <span
                aria-hidden="true"
                className={`absolute left-[11px] top-6 h-full w-px ${
                  milestone.state === 'done' ? 'bg-ok-line' : 'bg-line'
                }`}
              />
            )}

            <span
              aria-hidden="true"
              className={`relative z-10 mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                milestone.state === 'done'
                  ? 'border-ok bg-ok text-white'
                  : milestone.state === 'current'
                    ? 'border-accent bg-surface text-accent'
                    : 'border-line bg-surface'
              }`}
            >
              {milestone.state === 'done' ? (
                <CheckIcon className="h-3.5 w-3.5" />
              ) : milestone.state === 'skipped' ? <span className="h-px w-2 bg-ink-faint" /> : milestone.state === 'current' ? (
                <span className="h-2 w-2 rounded-full bg-accent-bright" />
              ) : null}
            </span>

            <div className="min-w-0 flex-1">
              <p
                className={
                  milestone.state === 'upcoming'
                    ? 'font-medium text-ink-faint'
                    : 'font-medium text-ink'
                }
              >
                {milestone.label}
              </p>
              {milestone.detail !== undefined && (
                <p className="mt-0.5 text-sm text-ink-muted">{milestone.detail}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * A compact horizontal variant for the dashboard card, where the same milestones need to fit
 * beside other content. Same data, same states, less vertical cost.
 */
export function TimelineStrip({ milestones, label }: { milestones: Milestone[]; label: string }) {
  return (
    <ol aria-label={label} className="flex items-center gap-1.5">
      {milestones.map((milestone, index) => (
        <li key={milestone.id} className="flex flex-1 items-center gap-1.5">
          <span
            className={`h-1.5 flex-1 rounded-full ${
              milestone.state === 'done'
                ? 'bg-ok-bright'
                : milestone.state === 'current'
                  ? 'bg-accent-bright'
                  : 'bg-line'
            }`}
          />
          {index === milestones.length - 1 && <span className="sr-only">{milestone.label}</span>}
        </li>
      ))}
    </ol>
  );
}

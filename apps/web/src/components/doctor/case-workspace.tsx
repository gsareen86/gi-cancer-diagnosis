'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type ApiProblem } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';
import { useFormatter, useTranslations } from 'next-intl';
import { Badge } from '@/components/primitives';
import { Avatar, RiskBadge, StatusChip } from '@/components/ui/feedback';
import { Tabs, type TabDefinition } from '@/components/ui/navigation';
import { ChevronLeftIcon, ClipboardIcon, FileIcon, PulseIcon, ShieldIcon } from '@/components/ui/icons';
import { RISK_LABEL_KEY, RISK_TONE, riskTier } from '@/lib/risk';
import { slaState, SLA_LABEL_KEY } from '@/lib/sla';
import { needsReview } from '@/lib/triage';
import { CdsPanel } from './cds-panel';
import { DeliveryAudit } from './delivery-audit';
import { PatientRecordPanel } from './patient-record-panel';
import { ReportsPanel } from './reports-panel';
import { SignOffPanel } from './signoff-panel';
import type { CaseWorkspaceData, FinalSummary } from './types';

/**
 * The review console.
 *
 * A persistent section navigator on a wide viewport opens one broad clinical canvas at a time.
 * The earlier three-column console made every lane narrow and introduced three competing scroll
 * positions. This layout keeps the case sections close while giving dense records and long-form
 * physician writing the full working width.
 *
 * Below the desktop breakpoint the same mounted sections become horizontal tabs. Switching
 * sections never unmounts an editor, so unsaved physician text survives both navigation and
 * responsive layout changes.
 *
 * The panel order follows review work: record, source reports, decision support, then conclusion.
 */
export function CaseWorkspace({ caseId, data }: { caseId: string; data: CaseWorkspaceData }) {
  const t = useTranslations('doctor');
  const format = useFormatter();
  const router = useRouter();
  const { toast } = useToast();
  const generating = useRef(false);
  const [running, setRunning] = useState(false);
  const [aiProblem, setAiProblem] = useState<ApiProblem | null>(null);
  const [assessment, setAssessment] = useState(data.assessment);
  useEffect(() => { setAssessment(data.assessment); }, [data.assessment]);

  async function generate() {
    if (generating.current || data.review?.status === 'released') return;
    generating.current = true;
    setRunning(true);
    setAiProblem(null);
    try {
      const result = await api.post(`/api/doctor/cases/${caseId}/assessment`);
      if (!result.ok) {
        setAiProblem(result.problem);
        toast({ message: t('assessmentFailed'), tone: 'emergency' });
        return;
      }
      const refreshed = await api.get<CaseWorkspaceData>(`/api/doctor/cases/${caseId}`);
      if (!refreshed.ok) { setAiProblem(refreshed.problem); return; }
      setAssessment(refreshed.data.assessment);
      toast({ message: t('assessmentReady'), tone: 'ok' });
      router.refresh();
    } finally {
      generating.current = false;
      setRunning(false);
    }
  }
  useEffect(() => {
    if (data.review !== null) return;
    void api.post(`/api/doctor/cases/${caseId}/review/start`).then((result) => { if (result.ok) router.refresh(); });
  }, [caseId, data.review, router]);

  const tier = riskTier(highestUrgency(data));
  const sla = slaState(data.case.submittedAt);
  const released = data.review?.status === 'released';
  const saved = (data.review?.finalSummary ?? null) as FinalSummary | null;

  const record = <PatientRecordPanel data={data} />;
  const reports = <ReportsPanel caseId={caseId} data={data} />;
  const cds = (
    <CdsPanel
      assessment={assessment}
      running={running}
      problem={aiProblem}
      generate={generate}
      aiSkipReason={data.case.aiSkipReason}
      readOnly={released}
    />
  );
  const signOff = (
    <SignOffPanel
      caseId={caseId}
      assessment={assessment}
      running={running}
      aiProblem={aiProblem}
      generate={generate}
      saved={saved}
      reviewStatus={data.review?.status ?? null}
      doctorNotes={data.review?.doctorNotes ?? null}
    />
  );

  const tabs: TabDefinition[] = [
    { id: 'record', label: t('panelRecord'), icon: <ClipboardIcon className="h-4 w-4" />, description: t('recordPanelHint'), content: record },
    { id: 'reports', label: t('panelReports'), icon: <FileIcon className="h-4 w-4" />, description: t('reportsPanelHint'), adornment: <span className="gi-numeric text-xs text-ink-faint">{data.documents.length}</span>, content: reports },
    { id: 'cds', label: t('panelDecisionSupport'), icon: <PulseIcon className="h-4 w-4" />, description: t('cdsPanelHint'), content: cds },
    { id: 'review', label: t('panelReview'), icon: <ShieldIcon className="h-4 w-4" />, description: t('reviewPanelHint'), content: <>{signOff}<details className="mt-6 border-t border-line pt-4"><summary className="cursor-pointer text-sm font-medium">{t('panelNotifications')}</summary><div className="mt-3"><DeliveryAudit deliveries={data.deliveries} /></div></details></> },
  ];

  return (
    <div className="gi-review-workspace">
      {/* ------------------------------------------------------------------- Case bar --- */}
      <header className="mb-5 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-deep px-5 py-2.5 text-white">
            <Link
              href="/doctor/triage"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md text-sm font-medium text-slate-200 transition-colors hover:text-white"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5" />
              {t('backToTriage')}
            </Link>
            <span className="text-xs font-medium text-slate-200">{t('reviewWorkspaceLabel')}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-5 px-5 py-5 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar name={data.patient.fullName} size="lg" />
            <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold tracking-tight">
              {data.patient.fullName ?? t('patientPseudonymous')}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-muted">
              {data.patient.reference && <span>{t('patientReferenceLabel')} <strong className="ml-1 font-mono font-semibold text-ink">{data.patient.reference}</strong></span>}
              <span>
                {t('patientLine', {
                  age:
                    data.patient.ageYears === null
                      ? t('ageUnknown')
                      : String(data.patient.ageYears),
                  sex:
                    data.patient.sex === null
                      ? t('sexUnknown')
                      : t(`sex_${data.patient.sex}` as never),
                })}
              </span>
            </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
            <RiskBadge tone={RISK_TONE[tier]}>{t(RISK_LABEL_KEY[tier] as never)}</RiskBadge>
            {sla !== 'within' && needsReview(data.case.status) && (
              <StatusChip tone={sla === 'breached' ? 'emergency' : 'urgent'}>
                {t(SLA_LABEL_KEY[sla] as never)}
              </StatusChip>
            )}
            {released && <Badge tone="ok">{t('statusReleased')}</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-line bg-surface-sunken px-5 py-3 text-sm sm:px-6">
          <p className="flex items-center gap-2 font-medium"><PulseIcon className="h-4 w-4 shrink-0 text-accent" />{data.case.entryPoint}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-muted">
            <span>{t('caseReferenceLabel')} <strong className="ml-1 font-mono font-semibold text-ink">{data.case.reference}</strong></span>
            {data.case.submittedAt && <time dateTime={data.case.submittedAt}>{t('submittedOn', { date: format.dateTime(new Date(data.case.submittedAt), { dateStyle: 'medium', timeStyle: 'short' }) })}</time>}
          </div>
        </div>
      </header>

      {/* ---------------------------- One mounted canvas with desktop navigator / mobile tabs --- */}
      <Tabs
        tabs={tabs}
        listLabel={t('panelTabsLabel')}
        desktopLabel={t('caseNavigatorLabel')}
        desktopNavigator
      />
    </div>
  );
}

function highestUrgency(data: CaseWorkspaceData): string | null {
  const urgencies = data.redFlags.map((flag) => flag.urgency);
  if (urgencies.includes('emergency')) return 'emergency';
  if (urgencies.includes('urgent')) return 'urgent';
  if (urgencies.includes('routine-but-flagged')) return 'routine-but-flagged';
  return null;
}

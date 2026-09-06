import { NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { clinical } from '@/server/db';
import { caseReference } from '@/lib/references';
import { accessContext, route } from '@/server/api/route-handler';
import { problem } from '@/server/api/problem';
import { summaryPdf, type ReleasedSummary } from '@/server/services/summary-pdf';

export const GET = route<{ caseId: string }>({ roles: ['patient'] }, async ({ params, session, metadata }) => {
  const context = accessContext(session, session.userId, 'account_processing', metadata);
  const release = await clinical().getReleasedSummary(context, params.caseId);
  if (!release?.releasedContent) return problem('not_found', 'error.not_found');
  const caseRecord = await clinical().getCase(context, params.caseId);
  if (!caseRecord) return problem('not_found', 'error.not_found');
  const reference = caseReference(caseRecord.publicNumber);
  const t = await getTranslations('case');
  const labels = {
    title: t('releasedHeading'), summary: t('releasedHeading'), diagnosis: t('releasedDiagnosis'),
    dietary: t('releasedDietary'), precautions: t('releasedPrecautions'), prescriptions: t('releasedPrescriptions'),
    followUp: t('releasedFollowUp'), nextSteps: t('nextSteps'), referral: t('releasedReferral'),
    referral_emergency: t('referral_emergency'), referral_within_week: t('referral_within_week'), referral_routine: t('referral_routine'), referral_none: '', notice: t('summaryNotice'),
  };
  const bytes = await summaryPdf(reference, release.releasedContent as ReleasedSummary, labels);
  return new NextResponse(new Uint8Array(bytes), { headers: {
    'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="GI-Compass-${reference}.pdf"`, 'Cache-Control': 'private, no-store',
  } });
});

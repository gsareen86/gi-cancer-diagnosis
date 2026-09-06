import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Resolve traced, local font assets at runtime (not as Webpack JavaScript modules).
function fontPath(relativePath: string): string {
  let directory = process.cwd();
  for (;;) {
    const candidate = join(directory, 'node_modules', relativePath);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(directory);
    if (parent === directory) throw new Error('Bundled summary font is missing');
    directory = parent;
  }
}

export interface ReleasedSummary {
  summary: string;
  nextSteps: string[];
  standingNotice: string;
  diagnosis?: string | null;
  dietaryAdvice?: string | null;
  precautions?: string | null;
  referralUrgency?: string | null;
  followUpInterval?: string | null;
  prescriptionInstructions?: string | null;
  releasedBy?: string;
  releasedAt?: string;
}

/** Generates from the immutable release in memory. No service call or filesystem copy of PHI. */
export async function summaryPdf(caseId: string, content: ReleasedSummary, labels: Record<string, string>): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 52, bufferPages: true, info: { Title: labels.title ?? 'Clinical summary', Author: 'GI Compass' } });
  doc.registerFont('latin', fontPath('@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff'));
  doc.registerFont('devanagari', fontPath('@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-400-normal.woff'));
  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => { doc.on('data', (chunk: Buffer) => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });
  function text(value: string, size = 11, color = '#0F172A') {
    const runs = value.match(/[\u0900-\u097f]+|[^\u0900-\u097f]+/g) ?? [''];
    runs.forEach((run, index) => {
      doc.font(/[\u0900-\u097f]/.test(run) ? 'devanagari' : 'latin').fontSize(size).fillColor(color)
        .text(run, { lineGap: 4, continued: index < runs.length - 1 });
    });
  }
  text('GI COMPASS', 12, '#0369A1');
  doc.moveDown(0.6);
  text(labels.title ?? 'Clinical summary', 22);
  doc.moveDown(0.5);
  text(`${labels.case ?? 'Case'}: ${caseId}`, 9, '#475569');
  if (content.releasedAt) text(`${labels.released ?? 'Released'}: ${content.releasedAt}`, 9, '#475569');
  if (content.releasedBy) text(`${labels.clinician ?? 'Clinician'}: ${content.releasedBy}`, 9, '#475569');
  doc.moveDown();
  const sections: [string, string | null | undefined][] = [
    ['summary', content.summary], ['diagnosis', content.diagnosis], ['dietary', content.dietaryAdvice],
    ['precautions', content.precautions], ['prescriptions', content.prescriptionInstructions],
    ['referral', content.referralUrgency ? labels[`referral_${content.referralUrgency}`] : null],
    ['followUp', content.followUpInterval], ['nextSteps', content.nextSteps.join('\n')], ['notice', content.standingNotice],
  ];
  for (const [key, value] of sections) {
    if (!value?.trim()) continue;
    if (doc.y > doc.page.height - 140) doc.addPage();
    text(labels[key] ?? key, 12, '#0369A1');
    doc.moveDown(0.25);
    text(value);
    doc.moveDown();
  }
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font('latin').fontSize(8).fillColor('#475569').text(`${i + 1} / ${pages.count}`, 52, doc.page.height - 32, { align: 'right' });
    doc.page.margins.bottom = bottom;
  }
  doc.end();
  return finished;
}

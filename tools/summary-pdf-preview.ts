import { mkdir, writeFile } from 'node:fs/promises';
import { summaryPdf } from '../apps/web/src/server/services/summary-pdf';

await mkdir('var/tmp/pdfs', { recursive: true });
const bytes = await summaryPdf('SYNTHETIC-QA-ONLY', {
  summary: 'This synthetic summary tests pagination, spacing and legibility. It is not a real patient record. '.repeat(40),
  diagnosis: 'Synthetic layout example only.', nextSteps: ['Review the instructions provided by your clinician.'],
  prescriptionInstructions: 'यह केवल परीक्षण के लिए है। Follow-up 2026: चिकित्सक द्वारा लिखित निर्देश।',
  standingNotice: 'This sample is not medical advice. Real summaries contain the reviewing physician’s finalized content.',
  releasedAt: '2026-09-04T12:00:00Z', releasedBy: 'Synthetic test clinician',
}, { title: 'Clinical summary - QA sample', summary: 'Clinical summary', diagnosis: 'Clinical impression', prescriptions: 'दवा संबंधी निर्देश', nextSteps: 'Next steps', notice: 'Important information' });
await writeFile('var/tmp/pdfs/summary-qa.pdf', bytes);
console.log('var/tmp/pdfs/summary-qa.pdf');

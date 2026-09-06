'use client';

import { PrinterIcon } from '@/components/ui/icons';

/**
 * Prints the released summary.
 *
 * The browser's own print dialogue rather than a generated PDF, deliberately. A server-rendered
 * PDF of a clinical summary is a second copy of clinical content to store, expire and secure, and
 * it would need its own layout that could drift from what the patient read on screen. Printing
 * the page they are looking at cannot drift, and "Save as PDF" is in the same dialogue on every
 * platform the patient might be using.
 *
 * `globals.css` carries the print rules: chrome and controls are removed, panels keep their
 * borders, and the standing notice prints with the summary because it is part of the article
 * rather than page furniture.
 */
export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="gi-button-sm gi-button-secondary"
      onClick={() => window.print()}
    >
      <PrinterIcon className="h-4 w-4" />
      {label}
    </button>
  );
}

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('approved clinical Navigator workspace', () => {
  const navigation = read('apps/web/src/components/ui/navigation.tsx');
  const workspace = read('apps/web/src/components/doctor/case-workspace.tsx');
  const record = read('apps/web/src/components/doctor/patient-record-panel.tsx');
  const reports = read('apps/web/src/components/doctor/reports-panel.tsx');
  const review = read('apps/web/src/components/doctor/signoff-panel.tsx');
  const styles = read('apps/web/src/app/globals.css');

  it('uses one mounted canvas with a persistent desktop navigator and responsive tabs', () => {
    expect(workspace).toContain('desktopNavigator');
    expect(workspace).not.toContain('wideColumns');
    expect(navigation).toContain('data-case-navigator');
    expect(navigation).toContain('lg:sticky');
    expect(navigation).toContain("tab.id === active ? 'block' : 'hidden'");
    expect(navigation).toContain('ArrowUp');
    expect(navigation).toContain('ArrowDown');
    expect(navigation).toContain("event.key === 'Home'");
    expect(navigation).toContain("event.key === 'End'");
  });

  it('separates source reports from the scannable patient record', () => {
    expect(workspace).toContain("id: 'reports'");
    expect(record).not.toContain('DocumentDrawer');
    expect(reports).toContain('DocumentDrawer');
    expect(reports).toContain('data.documents.map');
  });

  it('provides long-form review editors and content-aligned compact actions', () => {
    expect(review).toContain('gi-editor-lg');
    expect(review).toContain('gi-editor-xl');
    expect(styles).toContain('min-height: 11rem');
    expect(styles).toContain('min-height: 15rem');
    expect(review).toContain('data-review-actions');
    expect(review).not.toContain('sticky bottom-');
    expect(review.indexOf('data-review-actions')).toBeGreaterThan(review.indexOf('prescription-instructions'));
  });

  it('keeps Navigator copy complete in both supported languages', () => {
    const english = JSON.parse(read('apps/web/messages/en.json')).doctor;
    const hindi = JSON.parse(read('apps/web/messages/hi.json')).doctor;
    for (const key of ['caseNavigatorLabel', 'panelReports', 'reportsPanelHint']) {
      expect(english[key]).toBeTypeOf('string');
      expect(hindi[key]).toBeTypeOf('string');
      expect(english[key].length).toBeGreaterThan(0);
      expect(hindi[key].length).toBeGreaterThan(0);
    }
  });
});

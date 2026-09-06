/** Explicit, non-destructive adoption. Never receives diagnosis or prescription fields. */
export type DraftField = 'summary' | 'workup';
export type DraftAddition = { ok: true; value: string } | { ok: false; reason: 'duplicate' | 'limit' | 'empty' };

export function addAiDraft(current: string, suggestion: string, field: DraftField): DraftAddition {
  const source = suggestion.trim();
  if (!source) return { ok: false, reason: 'empty' };
  const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  let addition = source;
  if (field === 'workup') {
    const seen = new Set(current.split('\n').map(normalize));
    addition = source.split('\n').map(line => line.trim()).filter(line => {
      const key = normalize(line);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).join('\n');
  } else if (normalize(current).includes(normalize(source))) {
    return { ok: false, reason: 'duplicate' };
  }
  if (!addition) return { ok: false, reason: 'duplicate' };
  // Preserve the physician's text byte-for-byte; never trim/truncate it to fit a suggestion.
  const value = current ? `${current}${field === 'summary' ? '\n\n' : '\n'}${addition}` : addition;
  if (value.length > (field === 'summary' ? 6000 : 4000) ||
      (field === 'workup' && value.split('\n').filter(line => line.trim()).length > 12)) {
    return { ok: false, reason: 'limit' };
  }
  return { ok: true, value };
}

/** Display labels only. Never use a reference as an authorization credential. */
function reference(prefix: 'GI' | 'GC', value: number): string {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('Invalid public reference');
  return `${prefix}${String(value).padStart(6, '0')}`;
}

export const patientReference = (value: number) => reference('GI', value);
export const caseReference = (value: number) => reference('GC', value);

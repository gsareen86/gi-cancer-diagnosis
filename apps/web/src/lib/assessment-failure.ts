/** Keep internal failure details out of visible clinical copy. */
export function assessmentFailureKey(reason: string): string {
  const known = [
    'ai_service_not_configured', 'ai_service_unreachable', 'ai_service_timeout',
    'ai_service_unauthorised', 'model_unavailable', 'schema_violations_exhausted',
  ];
  return `doctor.assessment.${known.includes(reason) ? reason : 'failed'}`;
}

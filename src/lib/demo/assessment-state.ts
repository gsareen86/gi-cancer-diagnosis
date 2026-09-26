import prompts from "../ai/prompts.json";

export function isCurrentAssessment(ai: unknown): boolean {
  if (!ai || typeof ai !== "object") return false;
  const value = ai as Record<string, unknown>;
  return (
    value.promptVersion === prompts.version && Array.isArray(value.sourceFacts)
  );
}

// Preserve stored history while preventing older output from being presented under new
// evidence rules. This projection contains no generated replacement clinical text.
export function projectAssessmentState<T>(data: T): T {
  if (Array.isArray(data)) return data.map(projectAssessmentState) as T;
  if (!data || typeof data !== "object") return data;
  const value = data as Record<string, unknown>;
  if (!("aiAvailable" in value)) return data;
  const outdated =
    !!value.aiAvailable && value.aiPromptVersion !== prompts.version;
  const processingReports =
    Array.isArray(value.reports) &&
    value.reports.some((r: { extractionStatus?: string }) =>
      ["queued", "running"].includes(r.extractionStatus ?? ""),
    );
  return {
    ...value,
    ai: outdated || processingReports ? null : value.ai,
    aiAvailable: outdated || processingReports ? false : value.aiAvailable,
    aiOutdated: outdated,
  } as T;
}

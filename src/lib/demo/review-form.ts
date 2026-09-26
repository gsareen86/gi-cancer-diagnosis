import { reviewSchema, type Review } from "./clinical";

export const blankReview: Review = {
  impression: "",
  specialty: "Gastroenterology",
  urgency: "review",
  plan: "",
  privateNotes: "",
  priorExposure: "not_exposed",
  disagreement: "not_compared",
  reason: "",
};

// Old stored drafts may predate review metadata. Pick known keys, preserving authored text.
export function reviewForEditing(stored?: Partial<Review> | null): Review {
  const fields = Object.keys(reviewSchema.shape) as (keyof Review)[];
  return {
    ...blankReview,
    ...Object.fromEntries(
      fields
        .filter((key) => stored?.[key] !== undefined)
        .map((key) => [key, stored![key]]),
    ),
  };
}

export function reviewFieldErrors(
  issues: Array<{ path: PropertyKey[]; message: string }>,
) {
  const labels: Record<string, string> = {
    impression: "Enter a clinical impression (up to 2,000 characters).",
    plan: "Add instructions for the patient (up to 3,000 characters).",
    specialty: "Choose a doctor type.",
    urgency: "Choose a care priority.",
    priorExposure: "Choose whether you have seen the AI assessment.",
    investigations: "Review the selected investigations.",
    followUp: "Keep follow-up arrangements within 1,000 characters.",
    urgencyReason: "Keep the priority explanation within 500 characters.",
    privateNotes: "Keep private notes within 3,000 characters.",
    reason: "Keep the comparison reason within 1,000 characters.",
    disagreement: "Choose a comparison outcome.",
  };
  return Object.fromEntries(
    issues.flatMap((issue) => {
      const field = String(issue.path[issue.path[0] === "review" ? 1 : 0]);
      return labels[field] ? [[field, labels[field]]] : [];
    }),
  );
}

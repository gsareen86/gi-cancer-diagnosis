import { describe, it, expect } from "vitest";
import { reviewSchema } from "../../src/lib/demo/clinical";
import {
  reviewForEditing,
  reviewFieldErrors,
} from "../../src/lib/demo/review-form";
const review = {
  impression: "GERD",
  plan: "Review in clinic.",
  specialty: "Gastroenterology",
  urgency: "review",
  privateNotes: "",
  priorExposure: "not_exposed",
  disagreement: "not_compared",
  reason: "",
};
describe("clinician review validation", () => {
  it("accepts short clinical terms without an arbitrary minimum length", () => {
    for (const impression of ["GERD", "IBS", "TB"])
      expect(reviewSchema.safeParse({ ...review, impression }).success).toBe(
        true,
      );
  });
  it("rejects whitespace-only fields", () => {
    for (const key of ["impression", "plan"])
      expect(
        reviewSchema.safeParse({ ...review, [key]: "      " }).success,
      ).toBe(false);
  });
  it("hydrates historical drafts without losing authored text or leaking extra keys", () => {
    const draft = reviewForEditing({
      impression: "IBS",
      plan: "Review in clinic.",
    });
    expect(reviewSchema.safeParse(draft).success).toBe(true);
    expect(draft.impression).toBe("IBS");
    expect(draft.priorExposure).toBe("not_exposed");
  });
  it("returns field-specific feedback without echoing submitted values or database internals", () => {
    const parsed = reviewSchema.safeParse({ ...review, impression: " " });
    expect(parsed.success).toBe(false);
    if (!parsed.success)
      expect(reviewFieldErrors(parsed.error.issues)).toEqual({
        impression: "Enter a clinical impression (up to 2,000 characters).",
      });
  });
});

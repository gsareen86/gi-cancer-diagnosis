import { describe, it, expect } from "vitest";
import {
  flowFor,
  intakeTopics,
  currentTopic,
} from "../../src/lib/demo/intake-flow";
import {
  content,
  evaluate,
  intakeSchema,
  factsFor,
} from "../../src/lib/demo/clinical";
import { scenarios, blankIntake } from "../../src/lib/demo/fixtures";
describe("short main intake", () => {
  const flow = flowFor(content.version)!;
  const core = new Set(flow.topics.flatMap((t) => t.essential));
  it("keeps every rule input and every possible dependency on the main route", () => {
    const check = (id: string, seen = new Set<string>()) => {
      expect(core.has(id), id).toBe(true);
      if (seen.has(id)) return;
      seen.add(id);
      const q = content.questions.find((q) => q.id === id)!;
      const when = q.showWhen;
      if (when)
        for (const term of [...(when.all ?? []), ...(when.any ?? [])])
          check(term.field, seen);
    };
    for (const rule of content.rules)
      for (const term of rule.all) check(term.field);
  });
  it("covers each question exactly once and makes most characterization optional", () => {
    const ids = flow.topics.flatMap((t) => [...t.essential, ...t.details]);
    expect(ids.length).toBe(new Set(ids).size);
    expect([...ids].sort()).toEqual(content.questions.map((q) => q.id).sort());
    expect(core.size).toBeLessThan(content.questions.length / 2);
  });
  it("skipping optional details preserves all fixture urgency floors and leaves unknowns explicit", () => {
    for (const s of scenarios) {
      const answers = Object.fromEntries(
        Object.entries(s.intake.answers).filter(([id]) => core.has(id)),
      );
      expect(evaluate(answers).urgency).toBe(
        evaluate(s.intake.answers).urgency,
      );
      expect(
        factsFor({ ...s.intake, answers }).find(
          (f) => f.id === "unanswered_questions",
        ),
      ).toBeDefined();
    }
  });
  it("progress counts answers, not visited screens or stale child answers", () => {
    expect(intakeTopics(content.version, {}).every((t) => !t.complete)).toBe(
      true,
    );
    const topics = intakeTopics(content.version, {
      pain_presence: "No abdominal pain",
      pain_now_severity: "Unbearable pain",
    });
    expect(topics.find((t) => t.id === "pain")?.complete).toBe(true);
    expect(
      topics.find((t) => t.id === "pain")?.questions.map((q) => q.id),
    ).toEqual(["pain_presence"]);
  });
  it("restores a chosen partially answered topic and validates its navigation", () => {
    const navigation = {
      flowVersion: flow.version,
      topicId: "awareness",
      mode: "main" as const,
    };
    expect(currentTopic(content.version, {}, 2, navigation)?.id).toBe(
      "awareness",
    );
    expect(
      intakeSchema.safeParse({ ...blankIntake, age: 40, navigation }).success,
    ).toBe(true);
    expect(
      intakeSchema.safeParse({
        ...blankIntake,
        age: 40,
        navigation: { ...navigation, topicId: "invented" },
      }).success,
    ).toBe(false);
  });
  it("does not reinterpret legacy versions through a different flow", () => {
    expect(flowFor("demo-draft-2026-09-21")).toBeNull();
    expect(flowFor("intake-draft-2026-09-22.1")).toBeNull();
  });
});

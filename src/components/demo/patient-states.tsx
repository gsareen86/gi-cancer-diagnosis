import { type Intake } from "@/lib/demo/clinical";
import { Icon } from "@/components/ui";
import { flowFor } from "@/lib/demo/intake-flow";
export function PausedIntake({
  intake,
  onContinue,
  onEnd,
  busy,
  contentVersion,
}: {
  intake: Intake;
  onContinue: () => void;
  onEnd: () => void;
  busy: boolean;
  contentVersion: string;
}) {
  const topic = flowFor(contentVersion)?.topics.find(
    (t) => t.id === intake.navigation?.topicId,
  );
  const answered = Object.entries(intake.answers).filter(
    ([id, value]) => !id.endsWith("__note") && !!value,
  ).length;
  return (
    <section className="pause-screen">
      <p className="eyebrow">Your visit</p>
      <h1>You paused your intake</h1>
      <div className="notice">
        <strong>Intake incomplete · Answers saved</strong>
        <p>Your saved information remains available for clinician review.</p>
      </div>
      <div className="panel">
        <h2>Where you stopped</h2>
        <ul className="state-timeline">
          <li>
            <span className="icon-circle">
              <Icon name="person" />
            </span>
            <div>
              <strong>About you</strong>
              <small>Details saved</small>
            </div>
          </li>
          <li>
            <span className="icon-circle amber">
              <Icon name="document" />
            </span>
            <div>
              <strong>{topic?.label ?? "Symptoms and history"}</strong>
              <small>
                {topic
                  ? "Resume this topic where you stopped"
                  : `${answered} answers recorded · You can return to any question`}
              </small>
            </div>
          </li>
          <li>
            <span className="icon-circle neutral">
              <Icon name="upload" />
            </span>
            <div>
              <strong>Existing reports</strong>
              <small>Optional</small>
            </div>
          </li>
        </ul>
      </div>
      <div className="panel">
        <h2>What happens next</h2>
        <p>
          Continue now, or ask clinic staff to help you return. Your encounter
          remains assigned for clinician review.
        </p>
      </div>
      <div className="actions">
        <button onClick={onContinue}>
          Continue answering <Icon name="arrow" />
        </button>
        <button className="secondary" disabled={busy} onClick={onEnd}>
          End this device session
        </button>
      </div>
      <p className="muted block">
        Ending this session clears access on this device. It does not close your
        visit.
      </p>
    </section>
  );
}

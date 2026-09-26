import Link from "next/link";
export default function Ended() {
  return (
    <main id="main" className="container">
      <section className="panel">
        <p className="eyebrow">Tablet reset</p>
        <h1>This patient session has ended</h1>
        <p>
          Your visit is no longer accessible on this device. Saved information
          remains available to your care team.
        </p>
        <p className="notice">
          Seek immediate assistance or visit a doctor/hospital if seriously
          unwell. Do not wait for an online assessment.
        </p>
        <Link className="button" href="/start">
          Start a new visit
        </Link>
      </section>
    </main>
  );
}

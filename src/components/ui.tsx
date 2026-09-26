import type { ReactNode } from "react";
export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    document: (
      <>
        <path d="M14 2H5v20h14V7z" />
        <path d="M14 2v6h5M8 12h8M8 16h6" />
      </>
    ),
    person: (
      <>
        <circle cx="12" cy="7" r="4" />
        <path d="M4 22v-3a8 8 0 0 1 16 0v3" />
      </>
    ),
    check: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="m7 12 3 3 7-7" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 3" />
      </>
    ),
    alert: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v7m0 3v1" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="12" rx="2" />
        <path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v3" />
      </>
    ),
    search: (
      <>
        <circle cx="10" cy="10" r="7" />
        <path d="m15 15 6 6" />
      </>
    ),
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    refresh: (
      <>
        <path d="M20 7a9 9 0 0 0-16 2M4 17a9 9 0 0 0 16-2" />
        <path d="M20 2v5h-5M4 22v-5h5" />
      </>
    ),
    logout: (
      <>
        <path d="M9 3H3v18h6m0-9h12m-5-5 5 5-5 5" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V3m-5 5 5-5 5 5M3 16v5h18v-5" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    clinic: (
      <>
        <path d="M4 22V3h16v19M1 22h22M9 22v-5h6v5M8 7h2m4 0h2M8 11h2m4 0h2" />
      </>
    ),
    spark: (
      <>
        <path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.document}
    </svg>
  );
}
export function Compass({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      className="compass"
      aria-hidden="true"
    >
      <circle cx="22" cy="22" r="20" stroke="currentColor" strokeWidth="2" />
      <path
        d="m22 7 4.5 10.5L37 22l-10.5 4.5L22 37l-4.5-10.5L7 22l10.5-4.5Z"
        fill="currentColor"
      />
      <path d="M22 1v4m0 34v4M1 22h4m34 0h4" stroke="currentColor" />
    </svg>
  );
}
export function Brand() {
  return (
    <span className="brand-lockup">
      <Compass />
      <span>GI Compass</span>
    </span>
  );
}
export function StepRail({
  labels,
  current,
}: {
  labels: string[];
  current: number;
}) {
  return (
    <nav className="stage-rail" aria-label="Progress">
      {labels.map((label, i) => (
        <div
          key={label}
          className={i === current ? "current" : i < current ? "visited" : ""}
          aria-current={i === current ? "step" : undefined}
        >
          <span>{i + 1}</span>
          <b>{label}</b>
        </div>
      ))}
    </nav>
  );
}

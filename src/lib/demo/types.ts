import type { Assessment, Evidence, Intake, Review, Fact } from "./clinical";
export type DemoReport = {
  id: string;
  name: string;
  mime: string;
  fields: Evidence[];
  quality: string;
  createdAt: string;
  verifiedAt: string | null;
  verifier: string | null;
  extractionStatus?:
    "queued" | "running" | "completed" | "failed" | "cancelled";
  extractionError?: string | null;
  extractionAttempts?: number;
  extractionUntil?: string | null;
  extractionProgress?: { pagesDone?: number; totalPages?: number } | null;
};
export type Encounter = {
  id: string;
  siteId: string;
  patientId: string;
  assignedTo: string;
  status: string;
  version: number;
  consentAt: string | null;
  contentVersion: string;
  preparedFixture: boolean;
  synthetic?: boolean;
  messages: Array<{
    id: string;
    author: string;
    text: string;
    createdAt: string;
  }>;
  intake: Intake | Record<string, never>;
  createdAt: string;
  updatedAt: string;
  reports: DemoReport[];
  job: {
    id: string;
    status: string;
    attempts: number;
    errorCode: string | null;
  } | null;
  ai:
    | (Assessment & {
        model?: string;
        sourceVersion?: number;
        sourceFacts?: Fact[];
        promptVersion?: string;
      })
    | null;
  aiCreatedAt: string | null;
  aiUrgency?: "review" | "prompt" | "immediate";
  aiAvailable: boolean | null;
  aiOutdated?: boolean;
  aiRevealedAt: string | null;
  independent: Review | null;
  draft: Review | null;
  draftAt: string | null;
  draftSourceVersion?: number | null;
  finalReview: Review | null;
  independentAt: string | null;
  release:
    | (Omit<Review, "privateNotes" | "priorExposure"> & {
        sourceVersion: number;
        author: string;
      })
    | null;
  releasedAt: string | null;
  canReview: boolean;
};
export type QueueItem = Pick<
  Encounter,
  | "id"
  | "patientId"
  | "status"
  | "updatedAt"
  | "intake"
  | "aiAvailable"
  | "assignedTo"
  | "preparedFixture"
  | "contentVersion"
> & {
  name: string;
  age: number | null;
  createdAt?: string;
  assignedName?: string;
  reportCount?: number;
  aiOutdated?: boolean;
  unverifiedReports?: number;
  aiUrgency?: "review" | "prompt" | "immediate";
};

import { PatientEntry } from "@/components/patient-entry";
export default function Home() {
  return (
    <PatientEntry
      slug={process.env.PATIENT_ENTRY_SLUG ?? ""}
      demo={process.env.APP_ENVIRONMENT !== "production"}
    />
  );
}

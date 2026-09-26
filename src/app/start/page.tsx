import { PatientEntry } from "@/components/patient-entry";
export default function Start() {
  return (
    <PatientEntry
      slug={process.env.PATIENT_ENTRY_SLUG ?? ""}
      demo={process.env.APP_ENVIRONMENT !== "production"}
    />
  );
}

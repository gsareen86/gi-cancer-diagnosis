import { notFound } from "next/navigation";
import { PatientEntry } from "@/components/patient-entry";
export default async function Start({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) notFound();
  return (
    <PatientEntry
      slug={slug}
      demo={process.env.APP_ENVIRONMENT !== "production"}
    />
  );
}

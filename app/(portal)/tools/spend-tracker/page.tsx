import { redirect } from "next/navigation";
import { getVisibility } from "@/lib/access";
import { PageHeader } from "@/components/ui";
import { SpendTrackerClient } from "./SpendTrackerClient";

export default async function SpendTrackerPage() {
  const visibility = await getVisibility();
  if (!visibility) redirect("/login");

  return (
    <div>
      <PageHeader
        title="WAG Spend Tracker"
        description="Upload a job-costing export to see daily spend by channel and platform. Nothing is saved — this is calculated fresh each time."
        backHref="/tools"
        backLabel="Back to Tools"
      />
      <div className="p-8">
        <SpendTrackerClient />
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { getVisibility } from "@/lib/access";
import { UploadWrapForm } from "./UploadWrapForm";

const WRAPS_OWNER_EMAIL = "lily@sunnyadvertising.com.au";

export default async function UploadMonthlyWrapPage() {
  const visibility = await getVisibility();
  if (!visibility) redirect("/login");
  if (visibility.profile.email !== WRAPS_OWNER_EMAIL) redirect("/agency/monthly-wraps");

  return <UploadWrapForm />;
}

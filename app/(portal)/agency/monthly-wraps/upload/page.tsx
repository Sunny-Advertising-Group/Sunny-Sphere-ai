import { redirect } from "next/navigation";
import { getVisibility } from "@/lib/access";
import { UploadWrapForm } from "./UploadWrapForm";

export default async function UploadMonthlyWrapPage() {
  const visibility = await getVisibility();
  if (!visibility) redirect("/login");
  if (!visibility.isAdmin) redirect("/agency/monthly-wraps");

  return <UploadWrapForm />;
}

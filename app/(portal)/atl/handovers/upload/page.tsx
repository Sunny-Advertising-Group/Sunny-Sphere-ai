import { redirect } from "next/navigation";
import { getVisibility } from "@/lib/access";
import { UploadHandoverForm } from "./UploadHandoverForm";

export default async function UploadHandoverPage() {
  const visibility = await getVisibility();
  if (!visibility || !visibility.canSee("atl")) redirect("/");

  return <UploadHandoverForm />;
}

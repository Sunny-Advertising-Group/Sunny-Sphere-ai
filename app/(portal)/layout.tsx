import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { getVisibility } from "@/lib/access";
import { NAV_ITEMS } from "@/lib/nav";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const visibility = await getVisibility();
  if (!visibility) redirect("/login");

  const { profile, isAdmin, canSee } = visibility;

  const visibleHrefs = NAV_ITEMS.filter((item) => {
    if (item.adminOnly) return isAdmin;
    if (item.section) return canSee(item.section);
    return true;
  }).map((item) => item.href);

  return (
    <div className="flex min-h-screen">
      <Sidebar visibleHrefs={visibleHrefs} fullName={profile.full_name} email={profile.email} />
      <main className="min-h-screen flex-1">{children}</main>
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  team: string | null;
  role: "team" | "admin";
  created_at: string;
};

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (profile as Profile) ?? null;
}

export async function getGrantedSections(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("section_access")
    .select("section")
    .eq("user_id", userId);
  return (data ?? []).map((row) => row.section as string);
}

export type Visibility = {
  profile: Profile;
  isAdmin: boolean;
  sections: string[];
  canSee: (section: string) => boolean;
};

// Single source of truth for what a user can see — used by the sidebar, dashboard
// tiles, and each route's own server-side check. RLS is the real boundary underneath.
export async function getVisibility(): Promise<Visibility | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const isAdmin = profile.role === "admin";
  const sections = isAdmin ? [] : await getGrantedSections(profile.id);

  return {
    profile,
    isAdmin,
    sections,
    canSee: (section: string) => isAdmin || sections.includes(section),
  };
}

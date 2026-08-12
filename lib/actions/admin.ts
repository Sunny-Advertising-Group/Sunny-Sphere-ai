"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_DOMAIN = "@sunnyadvertising.com.au";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  return { supabase, user, isAdmin: !!isAdmin };
}

export async function inviteMember(_prevState: unknown, formData: FormData) {
  const { user, isAdmin } = await requireAdmin();
  if (!user || !isAdmin) return { error: "Not authorized." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const team = String(formData.get("team") ?? "").trim();
  const role = formData.get("role") === "admin" ? "admin" : "team";

  if (!email) return { error: "Email is required." };
  if (!email.endsWith(ALLOWED_DOMAIN)) {
    return { error: `Invites are restricted to ${ALLOWED_DOMAIN} addresses.` };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const admin = createAdminClient();
  // generateLink creates the pending user and returns the invite link directly,
  // rather than emailing it — Supabase's own mailer is too rate-limited for
  // real use, and setting up SMTP requires verifying a sending domain. This
  // way an admin copies the link and sends it themselves (Slack, email, etc).
  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo: `${siteUrl}/invite` },
  });
  if (error) return { error: error.message };

  const invitedId = data.user?.id;
  if (invitedId) {
    await admin
      .from("profiles")
      .update({ full_name: fullName || null, team: team || null, role })
      .eq("id", invitedId);
  }

  revalidatePath("/admin");
  return { success: `Invite link ready for ${email}.`, inviteLink: data.properties?.action_link };
}

export async function reviewTool(toolId: number, status: "published" | "rejected") {
  const { supabase, user, isAdmin } = await requireAdmin();
  if (!user || !isAdmin) return { error: "Not authorized." };

  const { error } = await supabase
    .from("tools")
    .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", toolId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/tools");
  return { success: true };
}

export async function reviewTip(tipId: number, status: "published" | "rejected") {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Not authorized." };

  const { error } = await supabase.from("tips").update({ status }).eq("id", tipId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/tips");
  return { success: true };
}

export async function deleteTool(toolId: number) {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Not authorized." };

  const { error } = await supabase.from("tools").delete().eq("id", toolId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/tools");
  return { success: true };
}

export async function deleteTip(tipId: number) {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Not authorized." };

  const { error } = await supabase.from("tips").delete().eq("id", tipId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/tips");
  return { success: true };
}

export async function setAiRequestStatus(requestId: number, status: string) {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Not authorized." };

  const { error } = await supabase.from("ai_requests").update({ status }).eq("id", requestId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/could-this-be-aid");
  return { success: true };
}

export async function setTicketStatus(ticketId: number, status: string) {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Not authorized." };

  const { error } = await supabase.from("support_tickets").update({ status }).eq("id", ticketId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/support");
  return { success: true };
}

export async function updateRole(userId: string, role: "team" | "admin") {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Not authorized." };

  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { success: true };
}

export async function updateTeam(userId: string, team: string) {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Not authorized." };

  const { error } = await supabase
    .from("profiles")
    .update({ team: team.trim() || null })
    .eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { success: true };
}

export async function grantSection(userId: string, section: string) {
  const { supabase, user, isAdmin } = await requireAdmin();
  if (!user || !isAdmin) return { error: "Not authorized." };

  const { error } = await supabase
    .from("section_access")
    .upsert({ user_id: userId, section, granted_by: user.id });
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { success: true };
}

export async function revokeSection(userId: string, section: string) {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Not authorized." };

  const { error } = await supabase
    .from("section_access")
    .delete()
    .eq("user_id", userId)
    .eq("section", section);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { success: true };
}

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

export async function resendInviteLink(userId: string) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Not authorized." };

  const admin = createAdminClient();
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
  if (userError || !userData?.user?.email) {
    return { error: userError?.message || "User not found." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  // "recovery" (not "invite") because the user's auth.users row already exists from the
  // first invite — GoTrue's invite type is only for brand-new users.
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: userData.user.email,
    options: { redirectTo: `${siteUrl}/invite` },
  });
  if (error) return { error: error.message };

  return { success: `Fresh link ready for ${userData.user.email}.`, inviteLink: data.properties?.action_link };
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

export async function enrollTotp() {
  const { supabase, user, isAdmin } = await requireAdmin();
  if (!user || !isAdmin) return { error: "Not authorized." };

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Sunny Sphere — ${new Date().toISOString()}`,
  });
  if (error) return { error: error.message };

  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyTotpEnrollment(factorId: string, code: string) {
  const { supabase, user, isAdmin } = await requireAdmin();
  if (!user || !isAdmin) return { error: "Not authorized." };

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) return { error: challengeError.message };

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: code.trim(),
  });
  if (verifyError) return { error: "Invalid code. Try again." };

  revalidatePath("/admin");
  return { success: true };
}

export async function unenrollTotp() {
  const { supabase, user, isAdmin } = await requireAdmin();
  if (!user || !isAdmin) return { error: "Not authorized." };

  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return { error: error.message };

  const factor = data?.totp?.[0];
  if (!factor) return { success: true };

  const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
  if (unenrollError) return { error: unenrollError.message };

  revalidatePath("/admin");
  return { success: true };
}

// Removing a person is permanent (their login and profile are both deleted), so it's
// gated behind a live TOTP code from the acting admin's own authenticator app —
// on top of the requireAdmin() role check every other action here relies on.
export async function removeMember(userId: string, code: string) {
  const { supabase, user, isAdmin } = await requireAdmin();
  if (!user || !isAdmin) return { error: "Not authorized." };
  if (userId === user.id) return { error: "You can't remove your own account." };

  if (!code || code.trim().length !== 6) {
    return { error: "Enter the 6-digit code from your authenticator app." };
  }

  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError) return { error: factorsError.message };

  const totpFactor = factors?.totp?.find((f) => f.status === "verified");
  if (!totpFactor) {
    return { error: "Set up two-factor authentication above before removing someone." };
  }

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId: totpFactor.id,
  });
  if (challengeError) return { error: challengeError.message };

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId: totpFactor.id,
    challengeId: challenge.id,
    code: code.trim(),
  });
  if (verifyError) return { error: "Invalid code. Try again." };

  const admin = createAdminClient();
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) return { error: deleteError.message };

  revalidatePath("/admin");
  return { success: true };
}

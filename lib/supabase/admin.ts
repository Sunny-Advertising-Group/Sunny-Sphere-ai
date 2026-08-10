import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client — server-only, never import from a Client Component.
// Used for admin actions that must bypass RLS entirely (inviteUserByEmail, etc).
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

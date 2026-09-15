import { createClient } from "@/lib/supabase/server";

// Streams the wrap's stored HTML so it can be embedded in a sandboxed iframe
// instead of opening in a new tab — the only in-app HTML viewer in the app.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const { data: wrap } = await supabase.from("monthly_wraps").select("file_path").eq("id", id).single();
  if (!wrap) return new Response("Not found", { status: 404 });

  const { data, error } = await supabase.storage.from("monthly_wraps").download(wrap.file_path);
  if (error || !data) return new Response("Not found", { status: 404 });

  return new Response(await data.text(), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

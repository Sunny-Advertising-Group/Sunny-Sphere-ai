import { createClient } from "@/lib/supabase/server";

// Streams the handover's stored HTML so it can be embedded in a sandboxed
// iframe, same pattern as Monthly Wraps.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const { data: handover } = await supabase.from("handovers").select("file_path").eq("id", id).single();
  if (!handover?.file_path) return new Response("Not found", { status: 404 });

  const { data, error } = await supabase.storage.from("handovers").download(handover.file_path);
  if (error || !data) return new Response("Not found", { status: 404 });

  return new Response(await data.text(), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

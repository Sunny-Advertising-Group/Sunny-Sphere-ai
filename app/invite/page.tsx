"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function InvitePage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // The invite link's access token lives in the URL fragment; the browser client
    // detects and exchanges it for a session automatically on init — we just wait for it.
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
      setReady(true);
    });
  }, [supabase]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace("/");
  }

  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-charcoal">Loading…</div>;
  }

  if (!email) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-border-c bg-white p-10 text-center">
          <p className="text-sm font-semibold text-ink">This invite link is invalid or has expired.</p>
          <p className="mt-2 text-sm text-charcoal">Ask an admin to send you a new invite.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border-c bg-white p-10 shadow-sm">
        <h1 className="text-xl font-extrabold text-ink">Welcome to Sunny Sphere</h1>
        <p className="mb-6 mt-1 text-sm text-charcoal">Set a password for {email}</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            autoFocus
            className="w-full rounded-lg border border-border-c px-3.5 py-2.5 text-sm outline-none focus:border-gold"
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm password"
            className="w-full rounded-lg border border-border-c px-3.5 py-2.5 text-sm outline-none focus:border-gold"
          />
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <button
            disabled={submitting}
            className="w-full rounded-lg bg-gold px-5 py-3 text-sm font-bold text-ink transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? "Setting password…" : "Set password & continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

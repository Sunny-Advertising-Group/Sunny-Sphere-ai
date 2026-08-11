"use client";

import Image from "next/image";
import { useActionState } from "react";
import { signIn } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, undefined);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border-c bg-white p-10 text-center shadow-sm">
        <Image src="/logo.png" alt="Sunny Advertising" width={140} height={52} className="mx-auto mb-2 h-11 w-auto" />
        <p className="mb-8 border-b border-border-c pb-6 text-xs text-charcoal">Sunny Sphere · Internal use only</p>

        <form action={formAction} className="space-y-3 text-left">
          <div>
            <label className="mb-1 block text-xs font-semibold text-charcoal">Email</label>
            <input
              type="email"
              name="email"
              required
              autoFocus
              placeholder="you@sunnyadvertising.com.au"
              className="w-full rounded-lg border border-border-c bg-white px-3.5 py-2.5 text-sm outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-charcoal">Password</label>
            <input
              type="password"
              name="password"
              required
              placeholder="••••••••"
              className="w-full rounded-lg border border-border-c bg-white px-3.5 py-2.5 text-sm outline-none focus:border-gold"
            />
          </div>

          {state?.error && <p className="text-sm font-medium text-red-600">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 w-full rounded-lg bg-gold px-5 py-3 text-sm font-bold text-ink transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-xs text-charcoal">
          Access is invite-only. Ask an admin if you need an account.
        </p>
      </div>
    </div>
  );
}

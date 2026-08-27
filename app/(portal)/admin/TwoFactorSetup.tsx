"use client";

import { useState, useTransition } from "react";
import { enrollTotp, unenrollTotp, verifyTotpEnrollment } from "@/lib/actions/admin";
import { Button, Card, Input } from "@/components/ui";

type Setup = { factorId: string; qrCode: string; secret: string };

export function TwoFactorSetup({ hasTotp }: { hasTotp: boolean }) {
  const [enrolled, setEnrolled] = useState(hasTotp);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function startEnroll() {
    setError(null);
    startTransition(async () => {
      const result = await enrollTotp();
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setSetup(result as Setup);
      setCode("");
    });
  }

  function confirmEnroll() {
    if (!setup) return;
    if (code.trim().length !== 6) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await verifyTotpEnrollment(setup.factorId, code);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setEnrolled(true);
      setSetup(null);
      setCode("");
    });
  }

  function reset() {
    setError(null);
    startTransition(async () => {
      const result = await unenrollTotp();
      if (result?.error) {
        setError(result.error);
        return;
      }
      setEnrolled(false);
    });
  }

  return (
    <Card className="mb-4">
      <h3 className="text-sm font-semibold text-ink">Your two-factor authentication</h3>
      <p className="mt-1 text-xs text-charcoal">
        Removing someone below requires a live code from your authenticator app.
      </p>

      {enrolled && !setup && (
        <div className="mt-3 flex items-center gap-3">
          <span className="text-xs font-medium text-green-700">2FA is set up on this account.</span>
          <Button type="button" variant="ghost" onClick={reset} disabled={pending} className="text-xs">
            {pending ? "Resetting…" : "Reset 2FA"}
          </Button>
        </div>
      )}

      {!enrolled && !setup && (
        <Button type="button" onClick={startEnroll} disabled={pending} className="mt-3">
          {pending ? "Starting…" : "Set up 2FA"}
        </Button>
      )}

      {setup && (
        <div className="mt-3 space-y-3">
          <div
            className="h-40 w-40 [&_svg]:h-full [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: setup.qrCode }}
          />
          <p className="text-xs text-charcoal">
            Scan with an authenticator app (Google Authenticator, Authy, 1Password), or enter this key
            manually: <code className="rounded bg-black/5 px-1 py-0.5">{setup.secret}</code>
          </p>
          <div className="flex items-center gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6-digit code"
              className="w-32"
              maxLength={6}
            />
            <Button type="button" onClick={confirmEnroll} disabled={pending}>
              {pending ? "Confirming…" : "Confirm"}
            </Button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
    </Card>
  );
}

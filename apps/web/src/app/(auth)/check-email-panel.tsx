"use client";

import { useState, useTransition } from "react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resendConfirmation } from "./actions";

/**
 * Shown after sign-up (confirmation required before the account is usable)
 * and after a sign-in attempt on an unconfirmed account — the "Empty"/
 * pending-confirmation state app_spec.md calls for instead of leaving the
 * freelancer stuck with no feedback.
 */
export function CheckEmailPanel({ email, message }: { email?: string; message: string }) {
  const [isPending, startTransition] = useTransition();
  const [resent, setResent] = useState(false);

  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <MailCheck className="size-10 text-primary" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-medium">Check your email</p>
        <p className="text-sm text-muted-foreground">
          {message}
          {email ? (
            <>
              {" "}
              We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>.
            </>
          ) : null}
        </p>
      </div>
      {email ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending || resent}
          onClick={() => {
            startTransition(async () => {
              await resendConfirmation(email);
              setResent(true);
            });
          }}
        >
          {resent ? "Confirmation email sent" : isPending ? "Sending…" : "Resend confirmation email"}
        </Button>
      ) : null}
    </div>
  );
}

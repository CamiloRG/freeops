"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { resendConfirmation } from "./actions";

/**
 * Shown after sign-up (confirmation required before the account is usable)
 * and after a sign-in attempt on an unconfirmed account — the "Empty" state
 * pattern from the handoff (README "Empty / loading / progress" → "Empty:
 * h3 title, caption explanation, secondary underline CTA. No
 * illustration.") — the old `<MailCheck>` icon is dropped per the
 * handoff's "Assets" rule ("the system uses no illustrations, icons, or
 * images").
 */
export function CheckEmailPanel({ email, message }: { email?: string; message: string }) {
  const [isPending, startTransition] = useTransition();
  const [resent, setResent] = useState(false);

  return (
    <div className="flex flex-col gap-4 py-2">
      <div>
        <p className="text-h3 text-ink">Revisa tu correo</p>
        <p className="mt-2 max-w-measure text-caption text-ink-soft">
          {message}
          {email ? (
            <>
              {" "}
              Enviamos un enlace de confirmación a{" "}
              <span className="text-ink">{email}</span>.
            </>
          ) : null}
        </p>
      </div>
      {email ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="self-start"
          disabled={isPending || resent}
          onClick={() => {
            startTransition(async () => {
              await resendConfirmation(email);
              setResent(true);
            });
          }}
        >
          {resent
            ? "Correo de confirmación enviado"
            : isPending
              ? "Enviando…"
              : "Reenviar correo de confirmación"}
        </Button>
      ) : null}
    </div>
  );
}

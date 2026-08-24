"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signInWithOAuth } from "../actions";
import { initialAuthActionState } from "../action-state";
import { CheckEmailPanel } from "../check-email-panel";

const OAUTH_ERROR_COPY: Record<string, string> = {
  "oauth-denied": "Cancelaste el acceso con el proveedor.",
  "oauth-failed": "No pudimos completar el acceso. Intenta de nuevo.",
  "oauth-init-failed": "No pudimos iniciar el acceso. Intenta de nuevo.",
};

export function SignInForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "";
  const oauthError = searchParams.get("error");
  const [state, formAction, isPending] = useActionState(signIn, initialAuthActionState);

  if (state.status === "check-email") {
    return (
      <CheckEmailPanel
        email={state.email}
        message="Confirma tu correo para terminar de iniciar sesión."
      />
    );
  }

  return (
    <>
      <form action={formAction} className="flex flex-col" noValidate>
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <div className="group/field mt-[28px]">
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(state.fieldErrors?.email)}
            aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
            className="mt-1.5"
          />
          {state.fieldErrors?.email && (
            <p id="email-error" className="mt-1.5 font-mono text-[11px] text-danger">
              {state.fieldErrors.email}
            </p>
          )}
        </div>
        <div className="group/field mt-[22px]">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(state.fieldErrors?.password)}
            aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
            className="mt-1.5"
          />
          {state.fieldErrors?.password && (
            <p id="password-error" className="mt-1.5 font-mono text-[11px] text-danger">
              {state.fieldErrors.password}
            </p>
          )}
        </div>
        {state.formError && (
          <p className="mt-4 font-mono text-[11px] text-danger" role="alert">
            {state.formError}
          </p>
        )}
        {oauthError && (
          <p className="mt-4 font-mono text-[11px] text-danger" role="alert">
            {OAUTH_ERROR_COPY[oauthError] ?? OAUTH_ERROR_COPY["oauth-failed"]}
          </p>
        )}
        <Button type="submit" className="mt-[30px] w-full" disabled={isPending}>
          {isPending ? "Entrando…" : "Entrar"}
        </Button>
      </form>
      <div className="mt-[22px] flex items-center gap-3 text-ink-faint">
        <span className="h-px flex-1 bg-line-soft" aria-hidden="true" />
        <span className="font-mono text-[10px] tracking-[0.06em] uppercase">o continúa con</span>
        <span className="h-px flex-1 bg-line-soft" aria-hidden="true" />
      </div>
      <div className="mt-3 flex gap-4">
        <form action={signInWithOAuth.bind(null, "google", redirectTo)} className="flex-1">
          <Button type="submit" variant="secondary" size="sm" className="w-full justify-center">
            Google
          </Button>
        </form>
        <form action={signInWithOAuth.bind(null, "azure", redirectTo)} className="flex-1">
          <Button type="submit" variant="secondary" size="sm" className="w-full justify-center">
            Microsoft
          </Button>
        </form>
      </div>
    </>
  );
}

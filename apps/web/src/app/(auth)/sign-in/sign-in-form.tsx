"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "../actions";
import { initialAuthActionState } from "../action-state";
import { CheckEmailPanel } from "../check-email-panel";

export function SignInForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "";
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
        <Button type="submit" className="mt-[30px] w-full" disabled={isPending}>
          {isPending ? "Entrando…" : "Entrar"}
        </Button>
      </form>
      <div className="mt-[18px] flex gap-6 font-sans text-[11.5px] text-ink-muted">
        <span>Google · pronto</span>
        <span>Microsoft · pronto</span>
      </div>
    </>
  );
}

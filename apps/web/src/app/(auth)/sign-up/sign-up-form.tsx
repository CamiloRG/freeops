"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUp, signInWithOAuth } from "../actions";
import { initialAuthActionState } from "../action-state";
import { CheckEmailPanel } from "../check-email-panel";

export function SignUpForm() {
  const [state, formAction, isPending] = useActionState(signUp, initialAuthActionState);

  if (state.status === "check-email") {
    return (
      <CheckEmailPanel
        email={state.email}
        message="Confirma tu correo para activar tu cuenta de freeops."
      />
    );
  }

  return (
    <>
      <form action={formAction} className="flex flex-col" noValidate>
        <div className="group/field mt-[28px]">
          <Label htmlFor="fullName">Nombre completo</Label>
          <Input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            aria-invalid={Boolean(state.fieldErrors?.fullName)}
            aria-describedby={state.fieldErrors?.fullName ? "fullName-error" : undefined}
            className="mt-1.5"
          />
          {state.fieldErrors?.fullName && (
            <p id="fullName-error" className="mt-1.5 font-mono text-[11px] text-danger">
              {state.fieldErrors.fullName}
            </p>
          )}
        </div>
        <div className="group/field mt-[22px]">
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
            autoComplete="new-password"
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
          {isPending ? "Creando cuenta…" : "Crear cuenta"}
        </Button>
      </form>
      <div className="mt-[22px] flex items-center gap-3 text-ink-faint">
        <span className="h-px flex-1 bg-line-soft" aria-hidden="true" />
        <span className="font-mono text-[10px] tracking-[0.06em] uppercase">o continúa con</span>
        <span className="h-px flex-1 bg-line-soft" aria-hidden="true" />
      </div>
      <div className="mt-3 flex gap-4">
        <form action={signInWithOAuth.bind(null, "google", "/personal")} className="flex-1">
          <Button type="submit" variant="secondary" size="sm" className="w-full justify-center">
            Google
          </Button>
        </form>
        <form action={signInWithOAuth.bind(null, "azure", "/personal")} className="flex-1">
          <Button type="submit" variant="secondary" size="sm" className="w-full justify-center">
            Microsoft
          </Button>
        </form>
      </div>
    </>
  );
}

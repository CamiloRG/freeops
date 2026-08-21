"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialAuthActionState, signIn } from "../actions";
import { CheckEmailPanel } from "../check-email-panel";

export function SignInForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "";
  const [state, formAction, isPending] = useActionState(signIn, initialAuthActionState);

  if (state.status === "check-email") {
    return (
      <CheckEmailPanel
        email={state.email}
        message="Confirm your email address to finish signing in."
      />
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(state.fieldErrors?.email)}
          aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
        />
        {state.fieldErrors?.email && (
          <p id="email-error" className="text-xs text-destructive">
            {state.fieldErrors.email}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(state.fieldErrors?.password)}
          aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
        />
        {state.fieldErrors?.password && (
          <p id="password-error" className="text-xs text-destructive">
            {state.fieldErrors.password}
          </p>
        )}
      </div>
      {state.formError && (
        <p className="text-sm text-destructive" role="alert">
          {state.formError}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "../auth-shell";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Crear cuenta" };

/**
 * The handoff doesn't mock sign-up explicitly — extrapolated from the
 * "Sign in" mock: same `AuthShell` split panel and field style, with the
 * left panel's copy/stats swapped for a first-time-visitor context instead
 * of "welcome back" personal stats (there's no account data to show yet).
 * Deliberately avoided inventing social-proof numbers (user counts, etc.)
 * for the stats row — these three rows are product facts, not marketing
 * claims, matching the "don't fabricate new marketing claims" instruction.
 */
export default function SignUpPage() {
  return (
    <AuthShell
      leftHeadline="Tu operación freelance, ordenada desde el primer día."
      leftStats={[
        { label: "Configuración", value: "~10 min" },
        { label: "Tarjeta de crédito", value: "no requerida", accent: true },
        { label: "Cancelas", value: "cuando quieras" },
      ]}
    >
      <div className="w-full max-w-[320px]">
        <p className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">
          Crear cuenta
        </p>
        <h1 className="mt-2 text-h2 text-ink">Arma tu hub administrativo</h1>

        <SignUpForm />

        <p className="mt-[28px] text-[12px] text-ink-soft">
          ¿Ya tienes cuenta?{" "}
          <Link href="/sign-in" className="border-b border-b-accent text-accent">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}

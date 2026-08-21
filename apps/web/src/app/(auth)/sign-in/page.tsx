import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "../auth-shell";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function SignInPage() {
  return (
    <AuthShell
      leftHeadline="Tu mes administrativo, ya resuelto."
      leftStats={[
        { label: "Cuentas emitidas", value: "12" },
        { label: "PILA de agosto", value: "lista", accent: true },
        { label: "Por cobrar", value: "$4.2M" },
      ]}
    >
      <div className="w-full max-w-[320px]">
        <p className="font-mono text-label-mono tracking-[0.06em] text-ink-muted uppercase">
          Acceso
        </p>
        <h1 className="mt-2 text-h2 text-ink">Bienvenido de vuelta</h1>

        {/* useSearchParams (for the post-sign-in redirectTo param) requires
            a Suspense boundary in the App Router. */}
        <Suspense fallback={<div className="mt-10 h-48" aria-hidden="true" />}>
          <SignInForm />
        </Suspense>

        <p className="mt-[28px] text-[12px] text-ink-soft">
          ¿Sin cuenta?{" "}
          <Link href="/sign-up" className="border-b border-b-accent text-accent">
            Crear una
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}

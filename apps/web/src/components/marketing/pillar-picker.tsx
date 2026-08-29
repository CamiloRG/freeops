"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/ui/reveal";
import { Segmented, SegmentedItem } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";

const PILLARS = [
  {
    n: "01",
    title: "Presencia profesional",
    description:
      "Un perfil completo, marca para tus facturas y cuentas de cobro, una hoja de vida que se arma sola desde tu historial de proyectos, y un enlace para agendar que tus prospectos usan directo en tu calendario real.",
    features: [
      "Perfil, banca y datos tributarios en un solo lugar",
      "Logo y marca en cada documento generado",
      "Hoja de vida que importa tus proyectos terminados",
      "Enlace de agenda compartible (Gmail u Outlook)",
    ],
  },
  {
    n: "02",
    title: "Seguimiento del negocio",
    description:
      "Cada contrato, otrosí y cambio de alcance guardado contra el proyecto correcto, un kanban por proyecto para llevar el trabajo, y un pipeline de CRM simple que convierte un negocio cerrado en un proyecto automáticamente.",
    features: [
      "Contratos, otrosíes y cambios de alcance",
      "Kanban personalizable por proyecto",
      "Pipeline de CRM para oportunidades",
      "Cerrado-ganado crea el proyecto automáticamente",
    ],
  },
  {
    n: "03",
    title: "Finanzas y compliance",
    description:
      "Genera cuentas de cobro y facturas de forma nativa, persigue pagos en mora automáticamente, calcula lo que debes de PILA cada mes, y entrégale a tu contador un paquete en vez de una caja de recibos.",
    features: [
      "Cuentas de cobro y facturación",
      "Seguimiento automático de pagos en mora",
      "Cálculo mensual de PILA (IBC)",
      "Bóveda de documentos tributarios lista para tu contador",
    ],
  },
] as const;

// Pre-selected rather than blank (Smart Defaults): for most Colombian
// freelancers the recurring pain is chasing payments and PILA, not the
// other two pillars — so that's the default, not an empty picker. The user
// can change it, which is what turns this into a light IKEA-effect moment
// before they ever reach the sign-up form.
const DEFAULT_PILLAR = "03";

export function PillarPicker() {
  const [selected, setSelected] = useState<string>(DEFAULT_PILLAR);

  const ordered = useMemo(() => {
    const active = PILLARS.find((p) => p.n === selected);
    const rest = PILLARS.filter((p) => p.n !== selected);
    return active ? [active, ...rest] : PILLARS;
  }, [selected]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-body-sm text-ink-soft">¿Qué te quita más tiempo hoy?</span>
        <Segmented
          value={selected}
          onValueChange={(value) => {
            // Radix single-toggle emits "" on a re-click of the active item —
            // ignored so the picker never lands on a blank/unselected state.
            if (value) setSelected(value);
          }}
          aria-label="¿Qué te quita más tiempo hoy?"
        >
          {PILLARS.map((pillar) => (
            <SegmentedItem key={pillar.n} value={pillar.n}>
              {pillar.title}
            </SegmentedItem>
          ))}
        </Segmented>
      </div>

      <div className="mt-[40px] grid grid-cols-1 gap-5 md:grid-cols-3">
        {ordered.map((pillar) => {
          const isSelected = pillar.n === selected;
          return (
            <Reveal key={pillar.n} as="div">
              <Card
                className={cn(
                  "h-full",
                  isSelected && "border-accent bg-accent-tint/30"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex size-9 items-center justify-center rounded-tile bg-accent-tint font-mono text-[12px] font-medium text-accent-press">
                    {pillar.n}
                  </div>
                  {isSelected && <Badge>Tu prioridad</Badge>}
                </div>
                <h3 className="mt-4 text-h3 text-ink">{pillar.title}</h3>
                <p className="mt-2 text-body-sm text-ink-soft">{pillar.description}</p>
                <ul className="mt-4 flex flex-col gap-2">
                  {pillar.features.map((feature) => (
                    <li key={feature} className="text-body-sm text-ink">
                      <span className="mr-2 text-ink-muted">—</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                {isSelected && (
                  <div className="mt-4">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/sign-up">Empezar por aquí →</Link>
                    </Button>
                  </div>
                )}
              </Card>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}

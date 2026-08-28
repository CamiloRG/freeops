import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";

type SectionPlaceholderProps = {
  title: string;
  description: string;
  phase: string;
  screens: string[];
};

/**
 * Temporary landing content for a section not built yet — Finance
 * (Phases 7/9/10/12) and, as of the "Aero" nav rebuild, the new
 * Principal dashboard and every Configuraciones sub-page (Correo,
 * Calendario, BYOK relocation, live Temas customizer): all real features
 * shown in the new nav mocks that don't exist in the app yet, deliberately
 * left as an honest "coming soon" rather than faked — see the design
 * system migration's own notes on why.
 */
export function SectionPlaceholder({
  title,
  description,
  phase,
  screens,
}: SectionPlaceholderProps) {
  return (
    <div className="px-9 pt-[26px] pb-8">
      <PageHeader title={title} description={description} />
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-body-sm">Próximamente — {phase}</CardTitle>
          <Badge variant="secondary">Aún no construido</Badge>
        </CardHeader>
        <CardContent>
          <ul className="list-inside list-disc space-y-1.5 text-body-sm text-ink-soft">
            {screens.map((screen) => (
              <li key={screen}>{screen}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type SectionPlaceholderProps = {
  title: string;
  description: string;
  phase: string;
  screens: string[];
};

/**
 * Temporary landing content for a top-level section until its phase is
 * built out. Replaced screen-by-screen starting Phase 4.
 */
export function SectionPlaceholder({
  title,
  description,
  phase,
  screens,
}: SectionPlaceholderProps) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 md:px-8 md:py-16">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="mt-2 text-muted-foreground">{description}</p>
      </div>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Coming in {phase}</CardTitle>
          <Badge variant="secondary">Not built yet</Badge>
        </CardHeader>
        <CardContent>
          <ul className="list-inside list-disc space-y-1.5 text-sm text-muted-foreground">
            {screens.map((screen) => (
              <li key={screen}>{screen}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

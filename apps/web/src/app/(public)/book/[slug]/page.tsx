import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Public, unauthenticated booking page a prospect lands on (app_spec.md §4,
// §2.1 "Public Booking Page"). Real availability/booking flow — and the MCP
// calendar server behind it — lands in Phase 8. This route intentionally
// sits outside the (app) shell: no sidebar/nav chrome, since prospects never
// see the authenticated product.
export default async function PublicBookingPage({
  params,
}: PageProps<"/book/[slug]">) {
  const { slug } = await params;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">
            Booking page: {slug}
          </CardTitle>
          <CardDescription>
            Live availability and booking will be built in Phase 8, once the
            calendar MCP server exists. This route and its public/unauthenticated
            layout are wired up now so the shape is right from the start.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = { title: "Sign in" };

// TODO (Phase 3): wire to Supabase Auth (email/password + Google + Microsoft
// OAuth). Form below is visual-only — submitting does nothing yet.
export default function SignInPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Welcome back to FreeOps.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Button variant="outline" className="w-full" disabled>
            Continue with Google
          </Button>
          <Button variant="outline" className="w-full" disabled>
            Continue with Microsoft
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">or</span>
          <Separator className="flex-1" />
        </div>
        <form className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              disabled
            />
          </div>
          <Button type="submit" className="w-full" disabled>
            Sign in
          </Button>
        </form>
        <p className="text-center text-xs text-muted-foreground">
          Authentication isn&apos;t wired up yet — this screen is visual-only
          until Phase 3.
        </p>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className="ml-1 font-medium text-primary">
          Sign up
        </Link>
      </CardFooter>
    </Card>
  );
}

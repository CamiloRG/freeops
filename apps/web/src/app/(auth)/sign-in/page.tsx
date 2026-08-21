import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Welcome back to FreeOps.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Button variant="outline" className="w-full justify-between" disabled title="Coming soon">
            Continue with Google
            <Badge variant="secondary">Coming soon</Badge>
          </Button>
          <Button variant="outline" className="w-full justify-between" disabled title="Coming soon">
            Continue with Microsoft
            <Badge variant="secondary">Coming soon</Badge>
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">or</span>
          <Separator className="flex-1" />
        </div>
        {/* useSearchParams (for the post-sign-in redirectTo param) requires
            a Suspense boundary in the App Router. */}
        <Suspense fallback={<div className="h-48" aria-hidden="true" />}>
          <SignInForm />
        </Suspense>
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

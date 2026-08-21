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
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Sign up" };

export default function SignUpPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          Set up your FreeOps admin & finance hub.
        </CardDescription>
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
        <SignUpForm />
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="ml-1 font-medium text-primary">
          Sign in
        </Link>
      </CardFooter>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { profileUpdateSchema } from "@/lib/validation/personal";

interface ProfileFormValues {
  fullName: string;
  displayName: string;
  phone: string;
  city: string;
  country: string;
  headline: string;
  bio: string;
}

export function ProfileForm({ initial }: { initial: ProfileFormValues }) {
  const [values, setValues] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set<K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setStatus("idle");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = profileUpdateSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[String(issue.path[0])] = issue.message;
      }
      setErrors(fieldErrors);
      setStatus("error");
      return;
    }
    setErrors({});
    setStatus("saving");
    const res = await fetch("/api/v1/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    if (!res.ok) {
      setStatus("error");
      return;
    }
    setStatus("saved");
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Profile & personal data</CardTitle>
          <CardDescription>Your name and contact details, shown on generated documents.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                value={values.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                aria-invalid={!!errors.fullName}
              />
              {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                placeholder="Optional — shown instead of full name"
                value={values.displayName}
                onChange={(e) => set("displayName", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                placeholder="+57 300 000 0000"
                value={values.phone}
                onChange={(e) => set("phone", e.target.value)}
                aria-invalid={!!errors.phone}
              />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" value={values.city} onChange={(e) => set("city", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="headline">Headline</Label>
            <Input
              id="headline"
              placeholder="e.g. Full-stack developer & product consultant"
              value={values.headline}
              onChange={(e) => set("headline", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              rows={4}
              value={values.bio}
              onChange={(e) => set("bio", e.target.value)}
              aria-invalid={!!errors.bio}
            />
            {errors.bio && <p className="text-xs text-destructive">{errors.bio}</p>}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={status === "saving"}>
              {status === "saving" ? "Saving…" : "Save changes"}
            </Button>
            {status === "saved" && <span className="text-sm text-success">Saved.</span>}
            {status === "error" && Object.keys(errors).length === 0 && (
              <span className="text-sm text-destructive">Couldn&apos;t save — try again.</span>
            )}
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

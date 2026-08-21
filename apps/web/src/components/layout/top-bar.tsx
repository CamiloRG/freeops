import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountMenu } from "@/components/layout/account-menu";

/**
 * Global top bar: notification bell (email/WhatsApp notification log) +
 * account menu. No profile switcher — FreeOps is single-user per account
 * (app_spec.md §1). `userEmail` comes from the verified server-side
 * session in `(app)/layout.tsx` — never trust a client-supplied identity.
 */
export function TopBar({ userEmail }: { userEmail?: string }) {
  return (
    <header className="flex h-16 items-center justify-end gap-2 border-b border-border px-4 md:px-6">
      <Button variant="ghost" size="icon" aria-label="Notifications">
        <Bell className="size-5" aria-hidden="true" />
      </Button>
      <AccountMenu userEmail={userEmail} />
    </header>
  );
}

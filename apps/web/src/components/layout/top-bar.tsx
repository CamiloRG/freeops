import { Bell } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Global top bar: notification bell (email/WhatsApp notification log) +
 * account menu. No profile switcher — FreeOps is single-user per account
 * (app_spec.md §1). Real session data / sign-out wiring lands in Phase 3.
 */
export function TopBar() {
  return (
    <header className="flex h-16 items-center justify-end gap-2 border-b border-border px-4 md:px-6">
      <Button variant="ghost" size="icon" aria-label="Notifications">
        <Bell className="size-5" aria-hidden="true" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label="Account menu"
          >
            <Avatar className="size-8">
              <AvatarFallback>FL</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Your account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>Settings (Phase 3)</DropdownMenuItem>
          <DropdownMenuItem disabled>Sign out (Phase 3)</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

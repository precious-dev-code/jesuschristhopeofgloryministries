import { Link } from "@tanstack/react-router";
import { Baby, ClipboardList } from "lucide-react";

/**
 * Main menu shared across pages: Kids Check-In and Member Attendance.
 */
export function AppNav() {
  const base =
    "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors sm:text-sm";
  const active = "bg-primary text-primary-foreground shadow-sm";
  const inactive = "text-muted-foreground hover:text-foreground";

  return (
    <nav className="mt-3 flex gap-1 rounded-xl border border-border bg-input p-1">
      <Link
        to="/"
        className={base}
        activeOptions={{ exact: true }}
        activeProps={{ className: `${base} ${active}` }}
        inactiveProps={{ className: `${base} ${inactive}` }}
      >
        <Baby className="h-4 w-4" />
        Kids Check-In
      </Link>
      <Link
        to="/attendance"
        className={base}
        activeProps={{ className: `${base} ${active}` }}
        inactiveProps={{ className: `${base} ${inactive}` }}
      >
        <ClipboardList className="h-4 w-4" />
        Member Attendance
      </Link>
    </nav>
  );
}

import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Sparkles } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { useStaff } from "./AuthGuard";

export function AppHeader() {
  const { staff, setStaff } = useStaff();
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-30 border-b border-glass-border bg-background/40 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <div className="font-display text-base font-semibold">PlayHouse Cafe</div>
            <div className="text-[11px] text-muted-foreground">Billing System</div>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          {staff && (
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium">{staff.name}</div>
              <div className="text-[11px] text-muted-foreground">{staff.mobile}</div>
            </div>
          )}
          <ThemeToggle />
          {staff && (
            <button
              onClick={() => { setStaff(null); nav({ to: "/login" }); }}
              className="glass inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm transition hover:scale-105"
            >
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Logout</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

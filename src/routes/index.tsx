import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Users } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { RequireAuth } from "@/components/AuthGuard";
import { TableGrid } from "@/components/TableGrid";
import { HostStatus } from "@/components/HostStatus";
import { useTick } from "@/hooks/use-tick";
import { useEffect, useState } from "react";
import { sessionsApi } from "@/lib/sessions";
import type { Session } from "@/lib/types";
import { storage } from "@/lib/storage";
import { formatDuration } from "@/lib/billing";

export const Route = createFileRoute("/")({
  component: () => (<RequireAuth><Dashboard /></RequireAuth>),
});

function Dashboard() {
  const tick = useTick(1000);
  const [active, setActive] = useState<Session[]>([]);
  const [tables, setTables] = useState<string[]>(storage.getTables());
  
  useEffect(() => {
    const refresh = () => setActive(sessionsApi.active());
    const refreshTables = () => setTables(storage.getTables());
    refresh();
    window.addEventListener("ph_sessions_changed", refresh);
    window.addEventListener("ph_tables_changed", refreshTables);
    return () => {
      window.removeEventListener("ph_sessions_changed", refresh);
      window.removeEventListener("ph_tables_changed", refreshTables);
    };
  }, []);

  const totalGuests = active.reduce((a, s) => a + s.adults + s.kids + (s.kidsAbove10 || 0), 0);
  const tablesBusy = new Set(active.flatMap((s) => s.tableIds)).size;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">Live Tables</h1>
            <p className="text-sm text-muted-foreground">{tables.length} tables · Capacity 4 / table</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/history" className="glass inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition hover:scale-[1.02]">
              History
            </Link>
            <Link to="/new" className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg transition hover:scale-[1.02]" style={{ background: "var(--gradient-primary)" }}>
              <Plus className="h-4 w-4" /> New Session
            </Link>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Tables Busy" value={`${tablesBusy} / ${tables.length}`} delay="0.1s" />
          <Stat label="Tables Free" value={`${tables.length - tablesBusy}`} accent="success" delay="0.2s" />
          <Stat label="Active Sessions" value={String(active.length)} delay="0.3s" />
          <Stat label="Guests Inside" value={String(totalGuests)} icon={<Users className="h-4 w-4" />} delay="0.4s" />
        </div>

        <TableGrid tick={tick} />

        <HostStatus />

        {active.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-3 font-display text-lg font-semibold animate-reveal-up" style={{ animationDelay: '0.5s' }}>Active Sessions</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((s, i) => (
                <Link key={s.id} to="/session/$id" params={{ id: s.id }} className="glass rounded-2xl p-4 transition hover:scale-[1.01] animate-reveal-up" style={{ animationDelay: `${0.6 + i * 0.1}s` }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{s.customerName}</div>
                      <div className="text-xs text-muted-foreground">{s.customerMobile}</div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1">
                      {s.tableIds.map((t) => (
                        <span key={t} className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">{t}</span>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{s.adults}A · {s.kids}K (U10){s.kidsAbove10 ? ` · ${s.kidsAbove10}K (A10)` : ""}</span>
                    <span className="tabular-nums">{formatDuration(Date.now() - s.startedAt)} elapsed</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, accent, icon, delay }: { label: string; value: string; accent?: "success"; icon?: React.ReactNode; delay?: string }) {
  return (
    <div className="glass rounded-2xl p-4 animate-reveal-up" style={{ animationDelay: delay }}>
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        {icon}
      </div>
      <div className={`mt-1 font-display text-2xl font-bold tabular-nums ${accent === "success" ? "text-success" : ""}`}>{value}</div>
    </div>
  );
}

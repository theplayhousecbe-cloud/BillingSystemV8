import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Clock, Users, Plus } from "lucide-react";
import type { Session, TableId } from "@/lib/types";
import { storage } from "@/lib/storage";
import { sessionsApi } from "@/lib/sessions";
import { formatDuration } from "@/lib/billing";

interface Props { tick: number }

export function TableGrid({ tick }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [tables, setTables] = useState<string[]>(storage.getTables());
  useEffect(() => {
    const refresh = () => setSessions(sessionsApi.active());
    const refreshTables = () => setTables(storage.getTables());
    refresh();
    window.addEventListener("ph_sessions_changed", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("ph_tables_changed", refreshTables);
    return () => {
      window.removeEventListener("ph_sessions_changed", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("ph_tables_changed", refreshTables);
    };
  }, []);

  const tableMap = new Map<TableId, Session>();
  sessions.forEach((s) => s.tableIds.forEach((t) => tableMap.set(t, s)));

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-9">
      {tables.map((id) => {
        const s = tableMap.get(id);
        const occupied = !!s;
        const elapsed = s ? Date.now() - s.startedAt : 0;
        const planned = s ? s.plannedDurationMin * 60_000 : 0;
        const remaining = s ? Math.max(0, planned - elapsed) : 0;
        const card = (
          <div className={`glass relative overflow-hidden rounded-2xl p-4 transition group-hover:scale-[1.02] ${occupied ? "ring-1 ring-destructive/40" : "ring-1 ring-success/40"}`}>
            <div className="absolute right-3 top-3 flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${occupied ? "bg-destructive shadow-[0_0_12px_rgba(239,68,68,0.7)]" : "bg-success shadow-[0_0_12px_rgba(34,197,94,0.6)]"} animate-pulse`} />
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {occupied ? "Busy" : "Free"}
              </span>
            </div>
            <div className="font-display text-3xl font-bold leading-none">{id}</div>
            <div className="mt-3 space-y-1">
              {occupied ? (
                <>
                  <div className="truncate text-xs font-medium">{s!.customerName}</div>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Users className="h-3 w-3" /> {s!.adults + s!.kids} ppl
                  </div>
                  <div className="flex items-center gap-1 text-[11px] tabular-nums text-foreground">
                    <Clock className="h-3 w-3" /> {formatDuration(remaining)}
                  </div>
                </>
              ) : (
                <div className="text-[11px] text-muted-foreground">Tap to assign</div>
              )}
            </div>
          </div>
        );
        return s ? (
          <Link key={id} to="/session/$id" params={{ id: s.id }} className="group relative block" data-tick={tick}>{card}</Link>
        ) : (
          <Link key={id} to="/new" search={{ table: id }} className="group relative block" data-tick={tick}>{card}</Link>
        );
      })}
      <button type="button" onClick={() => {
        const newId = prompt("Enter new table ID:");
        if (newId && !tables.includes(newId.trim().toUpperCase())) {
          storage.setTables([...tables, newId.trim().toUpperCase()]);
        }
      }} className="glass group relative flex min-h-[120px] items-center justify-center rounded-2xl border-2 border-dashed border-border p-4 transition hover:scale-[1.02] text-muted-foreground hover:text-foreground">
        <div className="flex flex-col items-center gap-2">
          <Plus className="h-6 w-6" />
          <span className="text-xs font-medium">Add Table</span>
        </div>
      </button>
    </div>
  );
}

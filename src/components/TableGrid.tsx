import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Clock, Users, Plus, Trash2 } from "lucide-react";
import type { Session, TableId } from "@/lib/types";
import { storage } from "@/lib/storage";
import { sessionsApi } from "@/lib/sessions";
import { formatDuration } from "@/lib/billing";
import { toast } from "sonner";
import { MoveRight } from "lucide-react";

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

  const handleRemoveTable = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to remove Table ${id}?`)) {
      storage.setTables(tables.filter((t) => t !== id));
    }
  };

  const handleRenameTable = (e: React.MouseEvent, oldId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const newId = prompt(`Enter new name for Table ${oldId}:`, oldId);
    if (newId && newId.trim().toUpperCase() !== oldId) {
      const up = newId.trim().toUpperCase();
      if (tables.includes(up)) return toast.error("Table ID already exists");
      
      // Update tables list
      storage.setTables(tables.map(t => t === oldId ? up : t));
      
      // Update any active session using this table
      const sessions = sessionsApi.list();
      sessions.forEach(s => {
        if (s.status === "active" && s.tableIds.includes(oldId)) {
          sessionsApi.addTables(s.id, [up]);
          sessionsApi.removeTable(s.id, oldId);
        }
      });
      toast.success(`Table ${oldId} renamed to ${up}`);
    }
  };

  const handleMoveSession = (e: React.MouseEvent, sessionId: string, fromTable: string) => {
    e.preventDefault();
    e.stopPropagation();
    const free = sessionsApi.freeTables();
    if (free.length === 0) return toast.error("No free tables available to move to.");
    
    const target = prompt(`Move session from ${fromTable} to which table?\nAvailable: ${free.join(", ")}`);
    if (target && free.includes(target.trim().toUpperCase())) {
      const to = target.trim().toUpperCase();
      sessionsApi.addTables(sessionId, [to]);
      sessionsApi.removeTable(sessionId, fromTable);
      toast.success(`Moved session to Table ${to}`);
      window.dispatchEvent(new Event("ph_sessions_changed"));
    }
  };

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-9">
      {tables.map((id) => {
        const s = tableMap.get(id);
        const occupied = !!s;
        const now = s ? (s.endedAt ?? Date.now()) : Date.now();
        const elapsed = s ? now - s.startedAt : 0;
        const planned = s ? s.plannedDurationMin * 60_000 : 0;
        const remaining = s ? planned - elapsed : 0;
        const card = (
          <div 
            className={`glass relative overflow-hidden rounded-2xl p-4 transition group-hover:scale-[1.02] animate-reveal-up ${occupied ? "ring-1 ring-destructive/40" : "ring-1 ring-success/40"}`}
            style={{ animationDelay: `${0.1 + tables.indexOf(id) * 0.05}s` }}
          >
            {!occupied && (
              <button 
                onClick={(e) => handleRemoveTable(e, id)}
                className="absolute bottom-2 right-2 rounded-full p-1.5 text-muted-foreground/40 transition hover:bg-destructive/10 hover:text-destructive active:scale-90"
                title="Remove Table"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
            <div className="absolute right-3 top-3 flex items-center gap-1.5">
              <span className={`h-2 rounded-full w-2 ${occupied ? "bg-destructive shadow-[0_0_12px_var(--destructive)]" : "bg-success shadow-[0_0_12px_var(--success)]"} animate-pulse`} />
              <span className={`text-[10px] font-bold uppercase tracking-wider ${occupied ? "text-destructive" : "text-success"}`}>
                {occupied ? "Busy" : "Free"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <button 
                onClick={(e) => handleRenameTable(e, id)}
                className="font-display text-3xl font-bold leading-none hover:text-primary transition-colors"
                title="Rename Table"
              >
                {id}
              </button>
              {occupied && (
                <button
                  onClick={(e) => handleMoveSession(e, s!.id, id)}
                  className="rounded-full p-1.5 text-primary/40 transition hover:bg-primary/10 hover:text-primary active:scale-90"
                  title="Move to another table"
                >
                  <MoveRight className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="mt-3 space-y-1">
              {occupied ? (
                <>
                  <div className="truncate text-xs font-medium">{s!.customerName}</div>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Users className="h-3 w-3" /> {s!.adults + s!.kids} ppl
                  </div>
                  <div className="flex items-center gap-1 text-[11px] tabular-nums text-foreground">
                    <Clock className="h-3 w-3" /> {formatDuration(elapsed)}
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

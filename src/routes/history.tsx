import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { RequireAuth } from "@/components/AuthGuard";
import { useEffect, useState } from "react";
import { sessionsApi } from "@/lib/sessions";
import type { Session } from "@/lib/types";
import { computeBill } from "@/lib/billing";
import { ArrowLeft, Clock } from "lucide-react";

export const Route = createFileRoute("/history")({
  component: () => (<RequireAuth><HistoryPage /></RequireAuth>),
});

function HistoryPage() {
  const [completed, setCompleted] = useState<Session[]>([]);
  const [view, setView] = useState<"all" | "split">("all");
  
  useEffect(() => {
    const refresh = () => {
      const all = sessionsApi.list();
      setCompleted(all.filter((s) => s.status === "completed").sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0)));
    };
    refresh();
    window.addEventListener("ph_sessions_changed", refresh);
    return () => window.removeEventListener("ph_sessions_changed", refresh);
  }, []);

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center justify-between">
          <button onClick={() => window.history.back()} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex bg-muted/50 p-1 rounded-xl">
            <button 
              onClick={() => setView("all")}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${view === "all" ? "bg-white shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              All Sessions
            </button>
            <button 
              onClick={() => setView("split")}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${view === "split" ? "bg-white shadow-sm text-indigo-600" : "text-muted-foreground hover:text-foreground"}`}
            >
              Split Bills
            </button>
          </div>
          <div className="w-16"></div> {/* spacer for centering */}
        </div>

        {completed.length === 0 ? (
          <div className="glass mx-auto max-w-md rounded-2xl p-12 text-center text-muted-foreground">
            <Clock className="mx-auto mb-4 h-12 w-12 opacity-40" />
            <p className="text-lg font-semibold">No completed sessions yet</p>
            <p className="mt-1 text-sm">Past bills and records will appear here.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {completed
              .filter(s => view === "all" || (s.adults + s.kids + (s.kidsAbove10 || 0)) > 1)
              .map((s) => {
              const bill = computeBill(s, s.endedAt || Date.now());
              const durMs = (s.endedAt || Date.now()) - s.startedAt;
              return (
                <div className="glass flex flex-col justify-between rounded-2xl p-5 transition hover:scale-[1.02] hover:shadow-xl group">
                  <Link to="/bill/$id" params={{ id: s.id }}>
                    <div className="flex items-center justify-between">
                      <div className="font-display text-lg font-bold truncate">{s.customerName}</div>
                      {s.tableIds && s.tableIds.length > 0 && (
                        <div className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                          T: {s.tableIds.join(",")}
                        </div>
                      )}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {new Date(s.startedAt).toLocaleDateString()}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      <Clock className="mb-0.5 mr-1 inline-block h-3 w-3" />
                      {new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {" - "}
                      {s.endedAt ? new Date(s.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                      {" "}({Math.round(durMs / 60000)}m)
                    </div>
                    <div className="mt-4 flex items-end justify-between border-t border-border pt-3">
                      <div className="text-xs text-muted-foreground">{s.adults + s.kids + (s.kidsAbove10 || 0)} heads</div>
                      <div className="font-display text-xl font-bold text-success tabular-nums">₹{bill.total.toFixed(2)}</div>
                    </div>
                  </Link>
                  
                  <div className="mt-4 pt-3 border-t border-border/50 flex gap-2">
                    <Link 
                      to="/bill/$id" 
                      params={{ id: s.id }} 
                      className="flex-1 text-center py-2 rounded-lg bg-primary/5 text-primary text-[10px] font-bold hover:bg-primary/10 transition-colors"
                    >
                      Regular Bill
                    </Link>
                    <Link 
                      to="/split-bill/$id" 
                      params={{ id: s.id }} 
                      className="flex-1 text-center py-2 rounded-lg bg-indigo-50 text-indigo-600 text-[10px] font-bold hover:bg-indigo-100 transition-colors"
                    >
                      Split Bill
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

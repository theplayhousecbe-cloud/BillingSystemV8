import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock, Pencil, Plus, Receipt, UserMinus, UserPlus, Users, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { AppHeader } from "@/components/AppHeader";
import { RequireAuth } from "@/components/AuthGuard";
import { sessionsApi } from "@/lib/sessions";
import { MENU_ITEMS, type Person, type Session } from "@/lib/types";
import { computeBill, ensurePersons, formatDuration, summarisePersons } from "@/lib/billing";
import { useTick } from "@/hooks/use-tick";

export const Route = createFileRoute("/session/$id")({
  component: () => (<RequireAuth><SessionPage /></RequireAuth>),
});

function SessionPage() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  useTick(1000);
  const [session, setSession] = useState<Session | null>(null);
  const [editTimer, setEditTimer] = useState(false);
  const [addTable, setAddTable] = useState(false);

  const refresh = () => {
    const s = sessionsApi.list().find((x) => x.id === id);
    setSession(s ?? null);
  };
  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener("ph_sessions_changed", h);
    return () => window.removeEventListener("ph_sessions_changed", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!session) {
    return (
      <div className="min-h-screen"><AppHeader />
        <main className="mx-auto max-w-md px-4 py-12 text-center">
          <div className="glass rounded-2xl p-8">
            <p>Session not found.</p>
            <button onClick={() => nav({ to: "/" })} className="mt-4 text-primary underline">Back to dashboard</button>
          </div>
        </main>
      </div>
    );
  }

  const now = Date.now();
  const elapsed = now - session.startedAt;
  const planned = session.plannedDurationMin * 60_000;
  const remaining = planned - elapsed;
  const overtime = remaining < 0;
  const liveBill = computeBill(session, now);
  const personSummaries = summarisePersons(session, now);
  const persons = ensurePersons(session);
  const activePersons = persons.filter((p) => !p.leftAt);

  const completeSession = async () => {
    const bill = sessionsApi.complete(session.id);
    if (bill) {
      const formattedItems = bill.lines.map(l => ({
        name: l.label,
        qty: 1,
        price: l.amount,
        subtotal: l.amount
      }));
      // Mark as completed in the Kitchen/Billing orders table and attach the computed bill
      await supabase.from("orders").update({ 
        status: "completed",
        bill_items: formattedItems,
        bill_total: bill.total,
        bill_final: bill.total,
        bill_discount: 0
      }).eq("session_id", session.id);
      nav({ to: "/bill/$id", params: { id: session.id } });
    }
  };

  const handleAdd = (kind: "adult" | "kid") => {
    sessionsApi.addPerson(session.id, kind);
    toast.success(`${kind === "adult" ? "Adult" : "Kid"} added — joined now`);
  };
  const handleRemove = (p: Person) => {
    sessionsApi.removePerson(session.id, p.id);
    toast.success(`Person ${p.label} left at ${new Date().toLocaleTimeString()}`);
  };

  if (session.status === "completed") {
    return (
      <div className="min-h-screen"><AppHeader />
        <main className="mx-auto max-w-md px-4 py-12 text-center">
          <div className="glass rounded-2xl p-8">
            <p>This session is completed.</p>
            <button onClick={() => nav({ to: "/bill/$id", params: { id: session.id } })} className="mt-4 text-primary underline">View bill</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen"><AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <button onClick={() => nav({ to: "/" })} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </button>

        {activePersons.length > session.tableIds.length * 4 && (
          <div className="mb-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 text-amber-600 dark:text-amber-400">
            <div className="flex items-center gap-2 font-semibold">
              <span className="text-xl">⚠️</span> Overcrowded Table(s)
            </div>
            <p className="mt-1 text-sm">
              You have {activePersons.length} active persons but only {session.tableIds.length} table(s) allocated (capacity 4/table). 
              Please allocate an additional table.
            </p>
            <button 
              onClick={() => setAddTable(true)}
              className="mt-3 rounded-full bg-amber-500 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500"
            >
              Add Table Now
            </button>
          </div>
        )}

        <div className="glass-strong mb-6 grid gap-4 rounded-3xl p-6 sm:grid-cols-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Customer</div>
            <div className="font-display text-xl font-semibold">{session.customerName}</div>
            <div className="text-xs text-muted-foreground">{session.customerMobile}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {session.tableIds.map((t) => (
                <span key={t} className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">Table {t}</span>
              ))}
              <button 
                onClick={() => setAddTable(true)}
                className="inline-flex h-5 items-center justify-center rounded-md bg-muted px-2 text-xs font-bold text-muted-foreground transition hover:bg-primary hover:text-primary-foreground"
              >
                +
              </button>
            </div>
          </div>
          <div className="sm:text-center">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{overtime ? "Overtime" : "Time Remaining"}</div>
            <div className={`font-display text-4xl font-bold tabular-nums ${overtime ? "text-destructive" : ""}`}>
              {formatDuration(Math.abs(remaining))}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Started: <span className="tabular-nums">{new Date(session.startedAt).toLocaleTimeString()}</span> ·{" "}
              Now: <span className="tabular-nums">{new Date(now).toLocaleTimeString()}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Elapsed: <span className="tabular-nums">{formatDuration(elapsed)}</span> · Planned: <span className="tabular-nums">{session.plannedDurationMin}m</span>
            </div>
            <div className="mt-2 flex justify-center gap-2">
              <button onClick={() => setEditTimer(true)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-semibold transition hover:bg-muted">
                <Pencil className="h-3.5 w-3.5" /> Edit timer
              </button>
              <button
                onClick={() => { sessionsApi.extendSession(session.id, 60); toast.success("Extended +1 hour"); }}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> +1 hour
              </button>
            </div>
          </div>
          <div className="sm:text-right">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Live Bill</div>
            <div className="font-display text-3xl font-bold tabular-nums">₹{liveBill.total.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">First hr ₹{session.pricing.adultRate} · Then ₹{session.pricing.subsequentRate}/hr per head</div>
            <div className="mt-1 text-xs text-muted-foreground">{activePersons.length} active · {persons.length} total</div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* PERSONS — individual list */}
          <section className="glass rounded-2xl p-5 lg:col-span-2">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg font-semibold">Persons in Session</h2>
              <div className="ml-auto flex gap-2">
                <button onClick={() => handleAdd("adult")} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90">
                  <UserPlus className="h-3.5 w-3.5" /> Add Adult (₹{session.pricing.adultRate})
                </button>
                <button onClick={() => handleAdd("kid")} className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20">
                  <UserPlus className="h-3.5 w-3.5" /> Add Kid (₹{session.pricing.kidRate})
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-1.5 pr-2">Person</th>
                    <th className="py-1.5 pr-2">Type</th>
                    <th className="py-1.5 pr-2">Joined</th>
                    <th className="py-1.5 pr-2">Left</th>
                    <th className="py-1.5 pr-2 text-right">Time</th>
                    <th className="py-1.5 pr-2 text-right">Charge</th>
                    <th className="py-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {personSummaries.map((c) => (
                    <tr key={c.person.id} className="border-t border-border/60">
                      <td className="py-2 pr-2 font-display font-bold">Person {c.person.label}</td>
                      <td className="py-2 pr-2 text-xs">
                        <span className={`rounded-full px-2 py-0.5 ${c.person.kind === "adult" ? "bg-primary/15 text-primary" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"}`}>
                          {c.person.kind} · ₹{c.person.firstHourRate}/hr
                        </span>
                      </td>
                      <td className="py-2 pr-2 tabular-nums text-xs">{new Date(c.person.joinedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="py-2 pr-2 tabular-nums text-xs">
                        {c.person.leftAt
                          ? <span className="text-muted-foreground">{new Date(c.person.leftAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          : <span className="text-success">active</span>}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums">{formatDuration(c.presentMin * 60_000)}</td>
                      <td className="py-2 pr-2 text-right font-semibold tabular-nums">₹{c.total.toFixed(2)}</td>
                      <td className="py-2 text-right">
                        {!c.person.leftAt && (
                          <button onClick={() => handleRemove(c.person)} className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive transition hover:bg-destructive hover:text-destructive-foreground">
                            <UserMinus className="h-3 w-3" /> Left
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Each person is billed for THEIR own time — first 60 min @ their rate, then ₹{session.pricing.subsequentRate}/hr — pro-rated to the minute.
            </p>
          </section>

          <section className="glass rounded-2xl p-5">
            <div className="mb-3 flex items-center gap-2"><Receipt className="h-4 w-4 text-primary" /><h2 className="font-display text-lg font-semibold">Live Charges</h2></div>
            <div className="space-y-1.5 text-sm">
              {liveBill.lines.length === 0 && <div className="text-muted-foreground">No charges yet.</div>}
              {liveBill.lines.map((l, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{l.label}</span>
                  <span className="tabular-nums">₹{l.amount.toFixed(2)}</span>
                </div>
              ))}
              <div className="my-2 border-t border-border" />
              <div className="flex justify-between font-semibold">
                <span>Total</span><span className="tabular-nums">₹{liveBill.total.toFixed(2)}</span>
              </div>
            </div>
          </section>

          <MenuOrders session={session} />

          <section className="glass rounded-2xl p-5 lg:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />
                <h2 className="font-display text-lg font-semibold">Session Controls</h2>
              </div>
              <button onClick={completeSession} className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg transition hover:scale-[1.02]" style={{ background: "var(--gradient-primary)" }}>
                <Receipt className="h-4 w-4" /> End Session & Generate Bill
              </button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Ending the session closes any still-active persons at the current time and generates the final bill.</p>
          </section>
        </div>

        {editTimer && (
          <EditTimerModal
            startedAt={session.startedAt}
            endedAt={session.endedAt}
            now={now}
            onCancel={() => setEditTimer(false)}
            onSave={(newStart, newEnd) => {
              if (newStart > Date.now()) return toast.error("Start time can't be in the future");
              if (newEnd && newEnd < newStart) return toast.error("End time can't be before start time");
              sessionsApi.updateSessionTimes(session.id, newStart, newEnd);
              toast.success("Timer updated — bill recalculated");
              setEditTimer(false);
            }}
          />
        )}

        {addTable && (
          <AddTableModal 
            sessionId={session.id} 
            onClose={() => setAddTable(false)} 
          />
        )}
      </main>
    </div>
  );
}

function EditTimerModal({ startedAt, endedAt, now, onCancel, onSave }: { startedAt: number; endedAt?: number; now: number; onCancel: () => void; onSave: (start: number, end?: number) => void }) {
  const toLocalInput = (ms: number) => {
    const d = new Date(ms);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  const [startVal, setStartVal] = useState(toLocalInput(startedAt));
  const [endVal, setEndVal] = useState(endedAt ? toLocalInput(endedAt) : "");
  const [useEndTime, setUseEndTime] = useState(!!endedAt);

  const startMs = useMemo(() => new Date(startVal).getTime(), [startVal]);
  const endMs = useMemo(() => (useEndTime && endVal ? new Date(endVal).getTime() : undefined), [useEndTime, endVal]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
      <div className="glass-strong w-full max-w-sm rounded-3xl p-6 shadow-2xl">
        <h3 className="font-display text-xl font-bold">Edit Session Timer</h3>
        <p className="mt-1 text-sm text-muted-foreground">Adjust start and end times to recalculate the bill.</p>
        
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Start Time</label>
            <input
              type="datetime-local"
              step="1"
              value={startVal}
              onChange={(e) => setStartVal(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">End Time</label>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">{useEndTime ? "Enabled" : "Live"}</span>
                <button 
                  onClick={() => {
                    if (!useEndTime && !endVal) setEndVal(toLocalInput(Date.now()));
                    setUseEndTime(!useEndTime);
                  }}
                  className={`h-4 w-8 rounded-full p-0.5 transition-colors ${useEndTime ? "bg-primary" : "bg-muted"}`}
                >
                  <div className={`h-3 w-3 rounded-full bg-white transition-transform ${useEndTime ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </div>
            </div>
            <input
              type="datetime-local"
              step="1"
              disabled={!useEndTime}
              value={endVal}
              onChange={(e) => setEndVal(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <div>Original: <span className="font-medium tabular-nums text-foreground">{new Date(startedAt).toLocaleTimeString()}</span></div>
          <div>Real time: <span className="font-medium tabular-nums text-foreground">{new Date(now).toLocaleTimeString()}</span></div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onCancel} className="glass rounded-full px-5 py-2.5 text-sm font-medium">Cancel</button>
          <button
            onClick={() => onSave(startMs, endMs)}
            disabled={!Number.isFinite(startMs) || (useEndTime && !Number.isFinite(endMs))}
            className="rounded-full px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg transition hover:scale-[1.02] disabled:opacity-50"
            style={{ background: "var(--gradient-primary)" }}
          >Save</button>
        </div>
      </div>
    </div>
  );
}

function MenuOrders({ session }: { session: Session }) {
  const orders = session.menuOrders ?? {};
  const totalQty = Object.values(orders).reduce((a, b) => a + b, 0);
  const totalAmt = MENU_ITEMS.reduce((sum, m) => sum + (orders[m.id] ?? 0) * m.price, 0);
  const setQty = (itemId: string, qty: number) => {
    sessionsApi.updateMenuQty(session.id, itemId, Math.max(0, qty));
    window.dispatchEvent(new Event("ph_sessions_changed"));
  };

  return (
    <section className="glass rounded-2xl p-5 lg:col-span-2">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <UtensilsCrossed className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-semibold">Cafe Menu</h2>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{totalQty} item{totalQty === 1 ? "" : "s"} · ₹{totalAmt.toFixed(2)}</span>
          <button 
            onClick={() => {
              const itemsArr = Object.entries(orders).filter(([_, q]) => q > 0).map(([id, q]) => ({
                name: MENU_ITEMS.find(x => x.id === id)?.label || id,
                qty: q
              }));
              if (itemsArr.length === 0) return toast.error("No items to send");
              
              supabase.from("orders").insert({
                session_id: session.id,
                table_number: session.tableIds.join(", "),
                customer_count: session.adults + session.kids,
                items: itemsArr,
                created_by: "system"
              }).then(({ error }) => {
                if (error) toast.error("Failed to send: " + error.message);
                else toast.success("Sent to Kitchen!");
              });
            }}
            className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary hover:text-primary-foreground"
          >
            Send to Kitchen
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {MENU_ITEMS.map((m) => {
          const q = orders[m.id] ?? 0;
          return (
            <div key={m.id} className="glass rounded-xl p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{m.label}</div>
                  <div className="text-xs text-muted-foreground">₹{m.price}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setQty(m.id, q - 1)} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-muted">−</button>
                  <span className="w-6 text-center font-mono text-sm tabular-nums">{q}</span>
                  <button onClick={() => setQty(m.id, q + 1)} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-muted">+</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AddTableModal({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const freeTables = sessionsApi.freeTables();
  const [selected, setSelected] = useState<string[]>([]);
  
  const handleSave = () => {
    if (selected.length === 0) return onClose();
    sessionsApi.addTables(sessionId, selected);
    window.dispatchEvent(new Event("ph_sessions_changed"));
    window.dispatchEvent(new Event("ph_tables_changed"));
    toast.success(`Added table(s): ${selected.join(", ")}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
      <div className="glass-strong w-full max-w-sm rounded-3xl p-6 shadow-2xl">
        <h3 className="font-display text-xl font-bold">Add Table</h3>
        <p className="mt-1 text-sm text-muted-foreground">Select free tables to add to this session.</p>
        
        <div className="mt-4 max-h-60 overflow-y-auto">
          {freeTables.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No free tables available.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {freeTables.map(t => (
                <button
                  key={t}
                  onClick={() => setSelected(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                  className={`flex h-12 w-12 items-center justify-center rounded-xl font-display text-lg font-bold transition-all ${
                    selected.includes(t) ? "bg-primary text-primary-foreground shadow-md scale-105" : "bg-muted/50 text-foreground hover:bg-muted"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="glass rounded-full px-5 py-2.5 text-sm font-medium">Cancel</button>
          <button
            onClick={handleSave}
            disabled={selected.length === 0}
            className="rounded-full px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg transition hover:scale-[1.02] disabled:opacity-50"
            style={{ background: "var(--gradient-primary)" }}
          >Add</button>
        </div>
      </div>
    </div>
  );
}

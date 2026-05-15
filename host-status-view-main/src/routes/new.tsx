import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AppHeader } from "@/components/AppHeader";
import { RequireAuth, useStaff } from "@/components/AuthGuard";
import { TABLE_CAPACITY, MENU_ITEMS, type PricingPlan, type TableId } from "@/lib/types";
import { storage } from "@/lib/storage";
import { sessionsApi } from "@/lib/sessions";
import { formatDuration } from "@/lib/billing";
import { EMPLOYEES } from "@/lib/employees";

const searchSchema = z.object({ table: z.string().optional() });

export const Route = createFileRoute("/new")({
  validateSearch: (s) => searchSchema.parse(s),
  component: () => (<RequireAuth><NewSession /></RequireAuth>),
});

// Host roster is derived from the central employees list — role "host" only.
const DEFAULT_HOSTS = EMPLOYEES.filter((e) => e.role === "host").map((e) => e.username);

function NewSession() {
  const nav = useNavigate();
  const search = Route.useSearch();
  const { staff } = useStaff();

  const [allTables, setAllTables] = useState(() => storage.getTables());
  useEffect(() => {
    const h = () => setAllTables(storage.getTables());
    window.addEventListener("ph_tables_changed", h);
    return () => window.removeEventListener("ph_tables_changed", h);
  }, []);

  const [startedAt] = useState<number>(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => clearInterval(i);
  }, [startedAt]);

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [adults, setAdults] = useState(2);
  const [kids, setKids] = useState(0);
  // Per-member hourly rate for FIRST hour. Length always = adults + kids.
  const [memberRates, setMemberRates] = useState<number[]>(() => Array(2).fill(149));
  // Preset that gets applied to all members via the "Apply to all" button
  const [bulkPreset, setBulkPreset] = useState<"149" | "199" | "99" | "0" | "custom">("149");
  const [bulkCustom, setBulkCustom] = useState<number>(149);
  const [selectAllMenu, setSelectAllMenu] = useState(false);
  const [menuQty, setMenuQty] = useState<Record<string, number>>({});

  // Hosts
  const [hostRoster, setHostRoster] = useState<string[]>(() => {
    const me = staff?.name?.trim();
    return me && !DEFAULT_HOSTS.includes(me) ? [me, ...DEFAULT_HOSTS] : DEFAULT_HOSTS;
  });
  const [hosts, setHosts] = useState<string[]>(() => (staff?.name ? [staff.name] : []));
  const [newHost, setNewHost] = useState("");

  const occupied = useMemo(() => {
    const set = new Set<TableId>();
    sessionsApi.active().forEach((s) => s.tableIds.forEach((t) => set.add(t)));
    return set;
  }, []);

  // Hosts already attending an active session — useful for UI status but no longer a restriction.
  const busyHosts = useMemo(() => {
    const set = new Set<string>();
    sessionsApi.active().forEach((s) => {
      const names = (s.hosts && s.hosts.length > 0 ? s.hosts : [s.staffName]).filter(Boolean);
      names.forEach((n) => set.add(n.trim()));
    });
    return set;
  }, []);

  const totalPersons = adults + kids;

  // AUTO-SELECT TABLES based on totalPersons (minimum tables to fit everyone),
  // picked from the free tables in alphabetical order.
  const autoTables = useMemo<TableId[]>(() => {
    if (totalPersons < 1) return [];
    const need = Math.max(1, Math.ceil(totalPersons / TABLE_CAPACITY));
    const free = allTables.filter((t) => !occupied.has(t));
    // Honour the table that came in via ?table=… as a starting hint.
    const hinted = search.table && free.includes(search.table as TableId)
      ? [search.table as TableId, ...free.filter((t) => t !== search.table)]
      : free;
    return hinted.slice(0, need);
  }, [totalPersons, occupied, search.table, allTables]);

  const [tables, setTables] = useState<TableId[]>(autoTables);
  const [autoMode, setAutoMode] = useState(true);

  // Keep tables in sync with auto-suggestion until the user manually overrides.
  useEffect(() => {
    if (autoMode) setTables(autoTables);
  }, [autoMode, autoTables]);

  // Keep memberRates length in sync with adults + kids (preserve existing rates,
  // pad new entries with the most-recent rate or default 149)
  useEffect(() => {
    const need = Math.max(0, totalPersons);
    setMemberRates((prev) => {
      if (prev.length === need) return prev;
      if (prev.length > need) return prev.slice(0, need);
      const fill = prev[prev.length - 1] ?? 149;
      return [...prev, ...Array(need - prev.length).fill(fill)];
    });
  }, [totalPersons]);

  const capacity = tables.length * TABLE_CAPACITY;
  const ratesTotal = memberRates.reduce((a, b) => a + b, 0);

  const toggleTable = (t: TableId) => {
    if (occupied.has(t)) return;
    setAutoMode(false);
    setTables((prev) => {
      if (prev.includes(t)) return prev.filter((x) => x !== t);
      const need = Math.max(1, Math.ceil(totalPersons / TABLE_CAPACITY));
      if (prev.length >= need) {
        if (need === 1) return [t];
        return [...prev.slice(prev.length - need + 1), t];
      }
      return [...prev, t];
    });
  };

  const toggleHost = (h: string) => {
    setHosts((prev) => prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]);
  };
  const addHost = () => {
    const v = newHost.trim();
    if (!v) return;
    if (!hostRoster.includes(v)) setHostRoster((r) => [...r, v]);
    if (!hosts.includes(v)) setHosts((h) => [...h, v]);
    setNewHost("");
  };

  const setQty = (id: string, qty: number) => {
    setMenuQty((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  };
  const totalMenuQty = Object.values(menuQty).reduce((a, b) => a + b, 0);
  const totalMenuAmt = MENU_ITEMS.reduce((s, m) => s + (menuQty[m.id] ?? 0) * m.price, 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Customer name required");
    if (mobile.trim() && !/^\d{10}$/.test(mobile)) return toast.error("Valid 10-digit mobile required");
    if (totalPersons < 1) return toast.error("At least 1 person required");
    if (tables.length === 0) return toast.error("No free tables available");
    if (totalPersons > capacity) return toast.error(`Selected tables fit ${capacity} people max`);
    if (hosts.length === 0) return toast.error("Pick at least one host");
    if (memberRates.some((r) => r === undefined || r === null || r < 0 || isNaN(r))) return toast.error("Every member needs a valid rate");

    const isCafeOnly = memberRates.every((r) => r === 0);
    const adultRatesAvg = memberRates.length ? Math.round(ratesTotal / memberRates.length) : 149;
    const pricing: PricingPlan = {
      adultRate: adultRatesAvg, // legacy fallback
      kidRate: isCafeOnly ? 0 : 99,
      subsequentRate: isCafeOnly ? 0 : 99,
      custom: memberRates.some((r) => r !== 149 && r !== 199 && r !== 99 && r !== 0),
      selectAllMenu,
      menuItems: selectAllMenu ? MENU_ITEMS.map((m) => m.id) : Object.keys(menuQty),
      memberRates: [...memberRates],
    };

    const s = sessionsApi.create({
      customerName: name.trim().toUpperCase(),
      customerMobile: mobile,
      tableIds: tables,
      adults,
      kids,
      pricing,
      plannedDurationMin: 60,
      staffName: hosts[0] ?? staff?.name ?? "Unknown",
      hosts,
      startedAt,
    });
    // Seed pre-ordered menu items so they appear on the live bill immediately
    if (!selectAllMenu) {
      for (const [itemId, qty] of Object.entries(menuQty)) {
        sessionsApi.updateMenuQty(s.id, itemId, qty);
      }
    }

    // 🚨 Always send order to Kitchen App's 'orders' table via Supabase
    const itemsArr = selectAllMenu
      ? [{ name: "Full menu offered", qty: 1 }]
      : Object.entries(menuQty)
          .filter(([, qty]) => qty > 0)
          .map(([itemId, qty]) => {
            const m = MENU_ITEMS.find((x) => x.id === itemId);
            return { name: m?.label || itemId, qty };
          });

    import("@/lib/supabase").then(({ supabase }) => {
      supabase.from("orders").insert({
        session_id: s.id,
        table_number: tables.join(", "),
        customer_count: totalPersons,
        items: itemsArr,
      }).then(({ error }) => {
        if (error) console.error("Failed to send to kitchen:", error.message, error);
        else console.log("✅ Order sent to kitchen for table", tables.join(", "));
      });
    });

    toast.success("Session started — sent to kitchen counter");
    nav({ to: "/session/$id", params: { id: s.id } });
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <button onClick={() => nav({ to: "/" })} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="glass-strong sticky top-20 z-10 mb-6 flex items-center justify-between rounded-2xl px-5 py-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Session timer</div>
            <div className="font-display text-2xl font-bold tabular-nums">{formatDuration(elapsed)}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Started</div>
            <div className="text-sm font-medium">{new Date(startedAt).toLocaleTimeString()}</div>
          </div>
        </div>

        <form onSubmit={submit} className="grid gap-6 lg:grid-cols-2">
          <section className="glass space-y-4 rounded-2xl p-5">
            <h2 className="font-display text-lg font-semibold">Customer Details</h2>
            <Field label="Name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value.toUpperCase())}
                placeholder="CUSTOMER NAME"
                className="w-full bg-transparent uppercase outline-none placeholder:opacity-40"
                style={{ textTransform: "uppercase" }}
              />
            </Field>
            <Field label="Mobile">
              <input value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" placeholder="10-digit mobile" className="w-full bg-transparent outline-none" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Counter label="Adults" value={adults} onChange={(n) => { setAdults(n); setAutoMode(true); }} min={0} />
              <Counter label="Kids" value={kids} onChange={(n) => { setKids(n); setAutoMode(true); }} min={0} />
            </div>
            <div className="text-xs text-muted-foreground">Total: <span className="font-semibold text-foreground">{totalPersons} persons</span></div>
          </section>

          <section className="glass space-y-4 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Tables</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{tables.length} selected · fits {capacity}</span>
                {!autoMode && (
                  <button type="button" onClick={() => setAutoMode(true)} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium hover:bg-muted/70">Auto</button>
                )}
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {autoMode
                ? `Auto-selected based on ${totalPersons} ${totalPersons === 1 ? "person" : "people"} (4 / table). Tap to override.`
                : "Manual selection — tap Auto to reset."}
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-9 lg:grid-cols-3 xl:grid-cols-9">
              {allTables.map((t) => {
                const isOcc = occupied.has(t);
                const isSel = tables.includes(t);
                return (
                  <button
                    type="button"
                    key={t}
                    disabled={isOcc}
                    onClick={() => toggleTable(t)}
                    className={`relative aspect-square rounded-xl text-lg font-bold transition ${
                      isOcc ? "cursor-not-allowed bg-destructive/15 text-destructive/60 line-through" :
                      isSel ? "scale-[1.04] text-primary-foreground shadow-lg" : "glass hover:scale-105"
                    }`}
                    style={isSel ? { background: "var(--gradient-primary)" } : undefined}
                  >
                    {t}
                    {!isOcc && !isSel && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-success" />}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="glass space-y-4 rounded-2xl p-5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Hosts</h2>
              <span className="text-xs text-muted-foreground">{hosts.length} attending</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {hostRoster.map((h) => {
                const on = hosts.includes(h);
                const busy = busyHosts.has(h);
                return (
                  <button
                    type="button"
                    key={h}
                    onClick={() => toggleHost(h)}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                      on ? "text-primary-foreground shadow-md" : "glass hover:scale-[1.03]"
                    }`}
                    style={on ? { background: "var(--gradient-primary)" } : undefined}
                  >
                    {h}
                    {busy && <span className="ml-1 text-[10px] opacity-70 uppercase">(busy)</span>}
                    {on && <X className="ml-1 inline h-3 w-3" />}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={newHost}
                onChange={(e) => setNewHost(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addHost(); } }}
                placeholder="Add host name"
                className="glass flex-1 rounded-xl px-3 py-2 text-sm outline-none"
              />
              <button type="button" onClick={addHost} className="glass inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium hover:scale-[1.03]">
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
          </section>

          <section className="glass space-y-4 rounded-2xl p-5 lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="font-display text-lg font-semibold">Pricing Plan</h2>
              <span className="text-xs text-muted-foreground">
                Total first-hour: <span className="font-semibold text-foreground tabular-nums">₹{ratesTotal}</span>
                {totalPersons > 0 && <> · avg <span className="tabular-nums">₹{Math.round(ratesTotal / totalPersons)}</span>/person</>}
              </span>
            </div>

            {/* Apply-to-all preset row */}
            <div className="rounded-xl border border-border/60 bg-background/40 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Apply to all members
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(["149", "199", "99", "0"] as const).map((p) => {
                  const label = p === "0" ? "Cafe Only" : p === "99" ? "Gaming ₹99/hr" : `₹${p}/hr`;
                  return (
                  <label key={p} className={`glass flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    bulkPreset === p ? "text-primary-foreground shadow-md" : "hover:scale-[1.02]"
                  }`} style={bulkPreset === p ? { background: "var(--gradient-primary)" } : undefined}>
                    <input
                      type="radio"
                      name="bulkPreset"
                      checked={bulkPreset === p}
                      onChange={() => setBulkPreset(p)}
                      className="h-3.5 w-3.5 accent-[var(--color-primary)]"
                    />
                    {label}
                  </label>
                  );
                })}
                <label className={`glass flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  bulkPreset === "custom" ? "text-primary-foreground shadow-md" : "hover:scale-[1.02]"
                }`} style={bulkPreset === "custom" ? { background: "var(--gradient-primary)" } : undefined}>
                  <input
                    type="radio"
                    name="bulkPreset"
                    checked={bulkPreset === "custom"}
                    onChange={() => setBulkPreset("custom")}
                    className="h-3.5 w-3.5 accent-[var(--color-primary)]"
                  />
                  Custom ₹
                  <input
                    type="number"
                    min={0}
                    value={bulkCustom}
                    onChange={(e) => { setBulkPreset("custom"); setBulkCustom(Number(e.target.value)); }}
                    className="w-16 rounded-md bg-background/60 px-1.5 py-0.5 text-xs outline-none"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const v = bulkPreset === "custom" ? bulkCustom : Number(bulkPreset);
                    if (v === undefined || v === null || v < 0 || isNaN(v)) return toast.error("Pick a valid rate");
                    setMemberRates((prev) => prev.map(() => v));
                  }}
                  className="ml-auto inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow transition hover:scale-[1.02]"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  <Check className="h-3.5 w-3.5" /> Apply to all {totalPersons} member{totalPersons === 1 ? "" : "s"}
                </button>
              </div>
            </div>

            {/* Per-member rate rows */}
            <div className="grid gap-2 sm:grid-cols-2">
              {memberRates.map((rate, i) => {
                const isAdult = i < adults;
                const label = isAdult ? `Adult ${i + 1}` : `Kid ${i - adults + 1}`;
                return (
                  <div key={i} className="glass flex items-center justify-between gap-3 rounded-xl px-3 py-2">
                    <div className="text-sm">
                      <span className="font-semibold">{label}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {[149, 199, 99, 0].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setMemberRates((prev) => prev.map((r, idx) => (idx === i ? p : r)))}
                          className={`rounded-md px-2 py-1 text-xs font-bold transition ${
                            rate === p ? "text-primary-foreground shadow" : "bg-muted/50 hover:bg-muted"
                          }`}
                          style={rate === p ? { background: "var(--gradient-primary)" } : undefined}
                        >
                          {p === 0 ? "Cafe" : `₹${p}`}
                        </button>
                      ))}
                      <span className="ml-1 text-xs text-muted-foreground">or</span>
                      <span className="text-xs">₹</span>
                      <input
                        type="number"
                        min={0}
                        value={rate}
                        onChange={(e) =>
                          setMemberRates((prev) =>
                            prev.map((r, idx) => (idx === i ? Number(e.target.value) : r)),
                          )
                        }
                        className="glass w-16 rounded-md px-1.5 py-1 text-xs outline-none"
                      />
                    </div>
                  </div>
                );
              })}
              {memberRates.length === 0 && (
                <div className="text-xs text-muted-foreground">Add at least one adult or kid above to set rates.</div>
              )}
            </div>

            <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
              <strong className="text-foreground">Billing:</strong> Each member is charged their own first-hour rate
              (prorated to the minute). After the first hour, ₹99/person/hr applies, except for Cafe Only which is ₹0/hr.
            </div>
          </section>

          <section className="glass space-y-4 rounded-2xl p-5 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold">Menu</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {selectAllMenu ? "Full menu offered" : `${totalMenuQty} item${totalMenuQty === 1 ? "" : "s"} · ₹${totalMenuAmt.toFixed(2)}`}
                </span>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={selectAllMenu} onChange={(e) => setSelectAllMenu(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />
                  <span className="font-medium">Select All</span>
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {MENU_ITEMS.map((m) => {
                const qty = menuQty[m.id] ?? 0;
                const allMode = selectAllMenu;
                const active = allMode || qty > 0;
                return (
                  <div
                    key={m.id}
                    className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 transition ${
                      active ? "border-primary/40 bg-primary/5" : "border-border bg-background/40"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{m.label}</div>
                      <div className="text-[11px] tabular-nums text-muted-foreground">₹{m.price}</div>
                    </div>
                    {allMode ? (
                      <span className="rounded-md bg-primary/15 px-2 py-1 text-[10px] font-bold uppercase text-primary">All</span>
                    ) : qty === 0 ? (
                      <button
                        type="button"
                        onClick={() => setQty(m.id, 1)}
                        className="rounded-lg border border-primary/40 px-3 py-1 text-xs font-bold text-primary transition hover:bg-primary hover:text-primary-foreground"
                      >
                        ADD
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 rounded-lg px-1 py-0.5 text-primary-foreground shadow" style={{ background: "var(--gradient-primary)" }}>
                        <button type="button" onClick={() => setQty(m.id, qty - 1)} className="grid h-7 w-7 place-items-center rounded-md hover:bg-white/15" aria-label="decrease">
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-[1.25rem] text-center text-sm font-bold tabular-nums">{qty}</span>
                        <button type="button" onClick={() => setQty(m.id, qty + 1)} className="grid h-7 w-7 place-items-center rounded-md hover:bg-white/15" aria-label="increase">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {selectAllMenu
                ? "Customer will be offered the entire menu."
                : `${totalMenuQty} item(s) pre-ordered for this session.`}
            </div>
          </section>

          <div className="lg:col-span-2 flex justify-end gap-2">
            <button type="button" onClick={() => nav({ to: "/" })} className="glass rounded-full px-5 py-2.5 text-sm font-medium">Cancel</button>
            <button type="submit" className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg transition hover:scale-[1.02]" style={{ background: "var(--gradient-primary)" }}>
              <Check className="h-4 w-4" /> OK — Start Session
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <div className="glass flex items-center gap-2 rounded-xl px-3 py-2.5">{children}</div>
    </label>
  );
}

function Counter({ label, value, onChange, min = 0 }: { label: string; value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <div className="glass flex items-center justify-between rounded-xl px-2 py-1.5">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"><Minus className="h-4 w-4" /></button>
        <span className="font-display text-xl font-bold tabular-nums">{value}</span>
        <button type="button" onClick={() => onChange(value + 1)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"><Plus className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
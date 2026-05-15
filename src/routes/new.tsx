import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AppHeader } from "@/components/AppHeader";
import { RequireAuth, useStaff } from "@/components/AuthGuard";
import { TABLE_CAPACITY, MENU_ITEMS, PACKAGES, type PricingPlan, type TableId, type PackageId } from "@/lib/types";
import { storage } from "@/lib/storage";
import { sessionsApi } from "@/lib/sessions";
import { formatDuration } from "@/lib/billing";

const searchSchema = z.object({ table: z.string().optional() });

export const Route = createFileRoute("/new")({
  validateSearch: (s) => searchSchema.parse(s),
  component: () => (<RequireAuth><NewSession /></RequireAuth>),
});

import { EMPLOYEES } from "@/lib/employees";

// Default roster of cafe hosts (staff on floor).
const DEFAULT_HOSTS = EMPLOYEES.filter(e => e.role.toLowerCase() === "host").map(e => e.username);

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

  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [isManualStart, setIsManualStart] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => clearInterval(i);
  }, [startedAt]);

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [adults, setAdults] = useState(2);
  const [kids, setKids] = useState(0);
  const [kidsAbove10, setKidsAbove10] = useState(0);
  // Per-member selection (PackageId or custom number). Length always = adults + kids + kidsAbove10.
  const [memberSelections, setMemberSelections] = useState<Array<PackageId | number>>(() => Array(2).fill("games-food-149"));
  // Preset that gets applied to all members via the "Apply to all" button
  const [bulkPreset, setBulkPreset] = useState<PackageId | "custom">("games-food-149");
  const [bulkCustom, setBulkCustom] = useState<number>(149);
  const [selectAllMenu, setSelectAllMenu] = useState(false);
  const [menuQty, setMenuQty] = useState<Record<string, number>>({});

  const getRate = (sel: PackageId | number) => {
    if (typeof sel === "number") return sel;
    return PACKAGES.find((p) => p.id === sel)?.adultRate ?? 149;
  };

  const [hostRoster, setHostRoster] = useState<string[]>(() => {
    const me = staff?.name?.trim();
    // In "new session", we show all hosts. If the logged-in user is an admin (not in host list), we can add them to the selection options if they are currently hosting.
    const isHost = DEFAULT_HOSTS.includes(me || "");
    return me && !isHost ? [me, ...DEFAULT_HOSTS] : DEFAULT_HOSTS;
  });
  const [hosts, setHosts] = useState<string[]>(() => (staff?.name ? [staff.name] : []));
  const [newHost, setNewHost] = useState("");

  const occupied = useMemo(() => {
    const set = new Set<TableId>();
    sessionsApi.active().forEach((s) => s.tableIds.forEach((t) => set.add(t)));
    return set;
  }, []);

  // Hosts already attending an active session — useful for UI status but no longer a restriction.
  const hostCustomerMap = useMemo(() => {
    const map = new Map<string, number>();
    sessionsApi.active().forEach((s) => {
      const activePpl = s.persons ? s.persons.filter((p) => !p.leftAt).length : s.adults + s.kids + s.kidsAbove10;
      const hostNames = (s.hosts && s.hosts.length > 0 ? s.hosts : [s.staffName]).filter(Boolean);
      const share = hostNames.length > 0 ? activePpl / hostNames.length : activePpl;
      hostNames.forEach((n) => {
        const name = n.trim();
        map.set(name, (map.get(name) || 0) + share);
      });
    });
    return map;
  }, []);

  const totalAttendingCustomers = useMemo(() => {
    return Array.from(hostCustomerMap.values()).reduce((a, b) => a + b, 0);
  }, [hostCustomerMap]);

  const totalPersons = adults + kids + kidsAbove10;

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

  const [tables, setTables] = useState<TableId[]>(() => {
    const free = allTables.filter((t) => !occupied.has(t));
    if (search.table && free.includes(search.table as TableId)) return [search.table as TableId];
    return [];
  });
  const [autoMode, setAutoMode] = useState(false);



  // Keep memberSelections length in sync with adults + kids
  useEffect(() => {
    const need = Math.max(0, totalPersons);
    setMemberSelections((prev) => {
      if (prev.length === need) return prev;
      if (prev.length > need) return prev.slice(0, need);
      const fill = prev[prev.length - 1] ?? "games-food-149";
      return [...prev, ...Array(need - prev.length).fill(fill)];
    });
  }, [totalPersons]);

  const memberRates = memberSelections.map(getRate);

  const capacity = tables.length * TABLE_CAPACITY;
  const ratesTotal = memberRates.reduce((a, b) => a + b, 0);

  const toggleTable = (t: TableId) => {
    if (occupied.has(t)) return;
    setAutoMode(false);
    setTables((prev) => {
      if (prev.includes(t)) return prev.filter((x) => x !== t);
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
    if (hosts.length === 0) return toast.error("Pick at least one host");
    if (memberRates.some((r) => r === undefined || r === null || r < 0 || isNaN(r))) return toast.error("Every member needs a valid rate");

    const isCafeOnly = memberRates.every((r) => r === 0);
    const adultRatesAvg = memberRates.length ? Math.round(ratesTotal / memberRates.length) : 149;
    const pricing: PricingPlan = {
      adultRate: adultRatesAvg,
      kidRate: isCafeOnly ? 0 : 99,
      kidRateAbove10: isCafeOnly ? 0 : 149,
      subsequentRate: isCafeOnly ? 0 : 99,
      custom: memberSelections.some((s) => typeof s === "number"),
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
      kidsAbove10,
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

        <div className="glass-strong sticky top-20 z-10 mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Session timer</div>
            <div className="font-display text-2xl font-bold tabular-nums">{formatDuration(elapsed)}</div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Started</div>
              {isManualStart ? (
                <input
                  type="datetime-local"
                  step="1"
                  value={new Date(startedAt - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 19)}
                  onChange={(e) => setStartedAt(new Date(e.target.value).getTime())}
                  className="bg-transparent text-sm font-medium outline-none"
                />
              ) : (
                <div className="text-sm font-medium">{new Date(startedAt).toLocaleTimeString()}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsManualStart(!isManualStart)}
              className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase transition ${isManualStart ? "bg-primary text-primary-foreground" : "glass text-muted-foreground"}`}
            >
              {isManualStart ? "Manual" : "Auto"}
            </button>
          </div>
        </div>

        <form onSubmit={submit} className="grid gap-6 lg:grid-cols-2">
          <section className="glass space-y-4 rounded-2xl p-5">
            <h2 className="font-display text-lg font-semibold">Customer Details</h2>
            <Field label="Name" id="customer-name">
              <input
                id="customer-name"
                name="customer-name"
                value={name}
                onChange={(e) => setName(e.target.value.toUpperCase())}
                placeholder="CUSTOMER NAME"
                className="w-full bg-transparent uppercase outline-none placeholder:opacity-40"
                style={{ textTransform: "uppercase" }}
              />
            </Field>
            <Field label="Mobile" id="customer-mobile">
              <input
                id="customer-mobile"
                name="customer-mobile"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                inputMode="numeric"
                placeholder="10-digit mobile"
                className="w-full bg-transparent outline-none"
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Counter label="Adults" value={adults} onChange={(n) => { setAdults(n); setAutoMode(true); }} min={0} />
              <Counter label="Kids <10" value={kids} onChange={(n) => { setKids(n); setAutoMode(true); }} min={0} />
              <Counter label="Kids >10" value={kidsAbove10} onChange={(n) => { setKidsAbove10(n); setAutoMode(true); }} min={0} />
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Total: <span className="font-semibold text-foreground">{totalPersons} persons</span>
              </div>
              <button
                type="button"
                onClick={() => { setAdults(2); setKids(0); setKidsAbove10(0); setAutoMode(true); }}
                className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition hover:border-destructive hover:text-destructive"
              >
                Reset
              </button>
            </div>
          </section>

          <section className="glass space-y-4 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Tables</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{tables.length} selected</span>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Select tables for this session. Tap a table to select/deselect.
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
              <span className="text-xs text-muted-foreground">{totalAttendingCustomers.toFixed(1)} attending</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {hostRoster.map((h) => {
                const on = hosts.includes(h);
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
                    {hostCustomerMap.has(h) && (
                      <span className="ml-1 text-[10px] opacity-70 uppercase">
                        ({Number(hostCustomerMap.get(h)).toLocaleString(undefined, { maximumFractionDigits: 1 })} attending)
                      </span>
                    )}
                    {on && <X className="ml-1 inline h-3 w-3" />}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <input
                id="new-host-name"
                name="new-host-name"
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
            <div className="rounded-2xl border border-border/40 bg-white/40 p-4 shadow-sm backdrop-blur-md">
              <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">
                Apply to all members
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {PACKAGES.map((p) => (
                  <label key={p.id} className={`flex cursor-pointer items-center gap-3 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                    bulkPreset === p.id 
                      ? "border-transparent text-white shadow-lg scale-[1.02]" 
                      : "border-border/50 bg-white hover:border-primary/30 hover:shadow-sm"
                  }`} style={bulkPreset === p.id ? { background: "var(--gradient-primary)" } : undefined}>
                    <input
                      type="radio"
                      name="bulkPreset"
                      checked={bulkPreset === p.id}
                      onChange={() => {
                        setBulkPreset(p.id);
                        setMemberSelections((prev) => prev.map(() => p.id));
                      }}
                      className="hidden"
                    />
                    <div className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                      bulkPreset === p.id ? "border-white bg-white/20" : "border-muted-foreground/30"
                    }`}>
                      {bulkPreset === p.id && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                    {p.name}
                  </label>
                ))}
                <label className={`flex cursor-pointer items-center gap-3 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                  bulkPreset === "custom" 
                    ? "border-transparent text-white shadow-lg scale-[1.02]" 
                    : "border-border/50 bg-white hover:border-primary/30 hover:shadow-sm"
                }`} style={bulkPreset === "custom" ? { background: "var(--gradient-primary)" } : undefined}>
                  <input
                    type="radio"
                    name="bulkPreset"
                    checked={bulkPreset === "custom"}
                    onChange={() => setBulkPreset("custom")}
                    className="hidden"
                  />
                  <div className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                    bulkPreset === "custom" ? "border-white bg-white/20" : "border-muted-foreground/30"
                  }`}>
                    {bulkPreset === "custom" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                  <span className="flex items-center gap-1 leading-none">
                    Custom <span className="text-xs opacity-80 translate-y-[0.5px]">₹</span>
                  </span>
                  <input
                    id="bulk-custom-rate"
                    name="bulk-custom-rate"
                    type="number"
                    min={0}
                    value={bulkCustom}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setBulkPreset("custom");
                      setBulkCustom(val);
                      setMemberSelections((prev) => prev.map(() => val));
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className={`w-16 rounded-md px-1.5 py-0.5 text-xs outline-none transition-colors ${
                      bulkPreset === "custom" ? "bg-white/20 text-white" : "bg-muted/50"
                    }`}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const v = bulkPreset === "custom" ? bulkCustom : bulkPreset;
                    setMemberSelections((prev) => prev.map(() => v));
                    toast.info(`Applied to all ${totalPersons} members`);
                  }}
                  className="ml-auto inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold text-white shadow-lg transition-all hover:scale-[1.04] active:scale-95"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  <Check className="h-4 w-4" /> Apply All
                </button>
              </div>
            </div>

            {/* Per-member rate rows */}
            <div className="grid gap-3 sm:grid-cols-2">
              {memberSelections.map((selection, i) => {
                const isAdult = i < adults;
                const label = i < adults 
                  ? `Adult ${i + 1}` 
                  : i < adults + kids 
                    ? `Kid <10 (${i - adults + 1})` 
                    : `Kid >10 (${i - adults - kids + 1})`;
                const currentRate = getRate(selection);
                return (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-sm border border-border/40">
                    <div className="text-sm">
                      <span className="font-bold text-foreground/80">{label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {PACKAGES.map((pkg) => {
                        let label = `₹${pkg.adultRate}`;
                        if (pkg.id === "cafe-only") label = "Cafe";
                        if (pkg.id === "kids-food-99") label = "Kids ₹99";
                        if (pkg.id === "games-only-99") label = "Games ₹99";
                        if (pkg.id === "games-food-149") label = "149+Food";

                        const isActive = selection === pkg.id;

                        return (
                          <button
                            key={pkg.id}
                            type="button"
                            onClick={() => setMemberSelections((prev) => prev.map((s, idx) => (idx === i ? pkg.id : s)))}
                            className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-all duration-200 ${
                              isActive ? "text-white shadow-md scale-105" : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
                            }`}
                            style={isActive ? { background: "var(--gradient-primary)" } : undefined}
                            title={pkg.name}
                          >
                            {label}
                          </button>
                        );
                      })}
                      <span className="mx-0.5 text-[10px] font-medium text-muted-foreground/60">or</span>
                      <div className="flex items-center gap-0.5">
                        <span className="text-[11px] font-bold text-muted-foreground/80 translate-y-[0.5px]">₹</span>
                        <input
                          type="number"
                          min={0}
                          value={currentRate}
                          onChange={(e) =>
                            setMemberSelections((prev) =>
                              prev.map((s, idx) => (idx === i ? Number(e.target.value) : s)),
                            )
                          }
                          className="w-14 rounded-full bg-secondary/30 px-2 py-1 text-[11px] font-bold outline-none border border-transparent focus:border-primary/30"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              {memberSelections.length === 0 && (
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

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <div className="glass flex items-center gap-2 rounded-xl px-3 py-2.5">{children}</div>
    </label>
  );
}

function Counter({ label, value, onChange, min = 0, max }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  const atMax = max !== undefined && value >= max;
  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <div className="glass flex items-center justify-between rounded-xl px-2 py-1.5">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"><Minus className="h-4 w-4" /></button>
        <span className="font-display text-xl font-bold tabular-nums">{value}</span>
        <button
          type="button"
          onClick={() => { if (!atMax) onChange(value + 1); }}
          disabled={atMax}
          className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

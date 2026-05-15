import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Users, Clock, User, Phone, TableProperties } from "lucide-react";
import { sessionsApi } from "@/lib/sessions";
import { storage } from "@/lib/storage";
import { toast } from "sonner";

const DEFAULT_HOSTS = ["Praveenbalaji", "Vijayakumar", "Phebe"];

export function NewSessionForm() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/new" }) as { table?: string };

  const tables = storage.getTables();
  const [customerName, setCustomerName] = useState("");
  const [mobile, setMobile] = useState("");
  const [adults, setAdults] = useState(1);
  const [kids, setKids] = useState(0);
  const [plannedDurationMin, setPlannedDurationMin] = useState(60);
  const [selectedTable, setSelectedTable] = useState(search.table ?? tables[0] ?? "");
  const [selectedHosts, setSelectedHosts] = useState<string[]>([]);
  const [error, setError] = useState("");

  const toggleHost = (name: string) => {
    setSelectedHosts((prev) =>
      prev.includes(name) ? prev.filter((h) => h !== name) : [...prev, name]
    );
  };

  const handleSubmit = () => {
    if (!customerName.trim()) {
      setError("Customer name is required.");
      window.alert("Customer name is missing! Please enter the customer's name.");
      toast.error("Customer name is required.");
      return;
    }
    if (!selectedTable) {
      setError("Please select a table.");
      toast.error("Please select a table.");
      return;
    }
    if (selectedHosts.length === 0) {
      setError("Please assign at least one host.");
      toast.error("Please assign at least one host.");
      return;
    }

    sessionsApi.create({
      customerName: customerName.trim().toUpperCase(),
      customerMobile: mobile,
      adults,
      kids,
      plannedDurationMin,
      tableIds: [selectedTable],
      hosts: selectedHosts,
      staffName: selectedHosts[0],
      startedAt: Date.now(),
      pricing: {
        adultRate: 149,
        kidRate: 99,
        subsequentRate: 99,
        custom: false,
        selectAllMenu: false,
        memberRates: Array(adults + kids).fill(149).map((_, i) => i < adults ? 149 : 99),
      },
    });

    navigate({ to: "/" });
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">New Session</h1>
        <p className="text-sm text-muted-foreground">Assign a table and start billing</p>
      </div>

      <div className="space-y-5">
        {/* Customer Name */}
        <div className="glass rounded-2xl p-4 space-y-1.5">
          <label htmlFor="customerName" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <User className="h-3.5 w-3.5" /> Customer Name
          </label>
          <input
            id="customerName"
            name="customerName"
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value.toUpperCase())}
            placeholder="CUSTOMER NAME"
            className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/50 uppercase"
            style={{ textTransform: "uppercase" }}
          />
        </div>

        {/* Mobile */}
        <div className="glass rounded-2xl p-4 space-y-1.5">
          <label htmlFor="mobile" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Phone className="h-3.5 w-3.5" /> Mobile
          </label>
          <input
            id="mobile"
            name="mobile"
            type="tel"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="9876543210"
            className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/50"
          />
        </div>

        {/* Adults & Kids */}
        <div className="glass rounded-2xl p-4 space-y-3">
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> Guests
          </label>
          <div className="flex gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Adults</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setAdults(Math.max(1, adults - 1))} className="glass h-8 w-8 rounded-full text-lg font-bold flex items-center justify-center">−</button>
                <span className="w-6 text-center font-semibold">{adults}</span>
                <button onClick={() => setAdults(adults + 1)} className="glass h-8 w-8 rounded-full text-lg font-bold flex items-center justify-center">+</button>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Kids</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setKids(Math.max(0, kids - 1))} className="glass h-8 w-8 rounded-full text-lg font-bold flex items-center justify-center">−</button>
                <span className="w-6 text-center font-semibold">{kids}</span>
                <button onClick={() => setKids(kids + 1)} className="glass h-8 w-8 rounded-full text-lg font-bold flex items-center justify-center">+</button>
              </div>
            </div>
          </div>
        </div>

        {/* Duration */}
        <div className="glass rounded-2xl p-4 space-y-2">
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Planned Duration
          </label>
          <div className="flex flex-wrap gap-2">
            {[30, 60, 90, 120].map((min) => (
              <button
                key={min}
                onClick={() => setPlannedDurationMin(min)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  plannedDurationMin === min
                    ? "bg-primary text-primary-foreground"
                    : "glass text-muted-foreground hover:text-foreground"
                }`}
              >
                {min} min
              </button>
            ))}
            <input
              id="plannedDurationMin"
              name="plannedDurationMin"
              type="number"
              min={1}
              value={plannedDurationMin}
              onChange={(e) => setPlannedDurationMin(Number(e.target.value))}
              className="w-20 rounded-full bg-transparent px-3 py-1 text-xs font-semibold outline-none ring-1 ring-border"
              placeholder="Custom"
            />
          </div>
        </div>

        {/* Table */}
        <div className="glass rounded-2xl p-4 space-y-2">
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <TableProperties className="h-3.5 w-3.5" /> Table
          </label>
          <div className="flex flex-wrap gap-2">
            {tables.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedTable(t)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  selectedTable === t
                    ? "bg-primary text-primary-foreground"
                    : "glass text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Hosts */}
        <div className="glass rounded-2xl p-4 space-y-2">
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <User className="h-3.5 w-3.5" /> Assign Hosts
          </label>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_HOSTS.map((h) => (
              <button
                key={h}
                onClick={() => toggleHost(h)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  selectedHosts.includes(h)
                    ? "bg-primary text-primary-foreground"
                    : "glass text-muted-foreground hover:text-foreground"
                }`}
              >
                {h}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-destructive font-medium">{error}</p>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          className="w-full rounded-2xl py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 active:scale-[0.98]"
          style={{ background: "var(--gradient-primary)" }}
        >
          Start Session
        </button>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { UserCheck, UserX, Plus, X } from "lucide-react";
import { sessionsApi } from "@/lib/sessions";
import type { Session } from "@/lib/types";
import { EMPLOYEES } from "@/lib/employees";

// Derived from the central employees list — only staff with the Host role appear here.
const DEFAULT_HOSTS = EMPLOYEES.filter((e) => e.role === "host").map((e) => e.username);
import { storage } from "@/lib/storage";

interface HostInfo {
  name: string;
  busy: boolean;
  tables: string[];
  customers: string[];
  customerCount: number;
}

export function HostStatus() {
  const [active, setActive] = useState<Session[]>([]);
  const [customHosts, setCustomHosts] = useState<string[]>(storage.getHosts());
  const [hiddenHosts, setHiddenHosts] = useState<string[]>(() => {
    return JSON.parse(localStorage.getItem("ph_hidden_hosts") || "[]");
  });

  useEffect(() => {
    const refresh = () => setActive(sessionsApi.active());
    refresh();
    const handleHostsChanged = () => setCustomHosts(storage.getHosts());
    const handleHiddenChanged = () => setHiddenHosts(JSON.parse(localStorage.getItem("ph_hidden_hosts") || "[]"));
    
    window.addEventListener("ph_sessions_changed", refresh);
    window.addEventListener("ph_hosts_changed", handleHostsChanged);
    window.addEventListener("ph_hidden_hosts_changed", handleHiddenChanged);
    return () => {
      window.removeEventListener("ph_sessions_changed", refresh);
      window.removeEventListener("ph_hosts_changed", handleHostsChanged);
      window.removeEventListener("ph_hidden_hosts_changed", handleHiddenChanged);
    };
  }, []);

  const allHosts = useMemo(() => {
    return Array.from(new Set([...DEFAULT_HOSTS, ...customHosts])).filter((h) => !hiddenHosts.includes(h));
  }, [customHosts, hiddenHosts]);

  const removeHost = (name: string) => {
    if (window.confirm(`Remove ${name} from the floor?`)) {
      if (customHosts.includes(name)) {
        const next = customHosts.filter((h) => h !== name);
        storage.setHosts(next);
        setCustomHosts(next);
      }
      if (DEFAULT_HOSTS.includes(name)) {
        const next = [...hiddenHosts, name];
        localStorage.setItem("ph_hidden_hosts", JSON.stringify(next));
        setHiddenHosts(next);
        window.dispatchEvent(new CustomEvent("ph_hidden_hosts_changed"));
      }
    }
  };

  const hosts: HostInfo[] = useMemo(() => {
    const map = new Map<string, HostInfo>();
    // Seed roster with defaults so they always appear (as free if not assigned).
    allHosts.forEach((n) =>
      map.set(n, { name: n, busy: false, tables: [], customers: [], customerCount: 0 }),
    );
    // Fold in any host currently attending an active session.
    for (const s of active) {
      const names = (s.hosts && s.hosts.length > 0 ? s.hosts : [s.staffName]).filter(Boolean);
      for (const raw of names) {
        const name = raw.trim();
        if (!name) continue;
        const existing = map.get(name) ?? { name, busy: false, tables: [], customers: [], customerCount: 0 };
        existing.busy = true;
        existing.tables.push(...s.tableIds);
        existing.customers.push(s.customerName);
        existing.customerCount += s.persons ? s.persons.filter(p => !p.leftAt).length : (s.adults + s.kids);
        map.set(name, existing);
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.busy !== b.busy) return a.busy ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [active]);

  const busyCount = hosts.filter((h) => h.busy).length;
  const freeCount = hosts.length - busyCount;

  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold">Hosts</h2>
          <p className="text-xs text-muted-foreground">
            Who's on the floor right now
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 font-medium text-primary">
            <UserCheck className="h-3.5 w-3.5" /> {busyCount} busy
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 font-medium text-success">
            <UserX className="h-3.5 w-3.5" /> {freeCount} free
          </span>
          <button
            onClick={() => {
              const name = window.prompt("Enter new host name:");
              if (name?.trim()) {
                const current = storage.getHosts();
                if (!current.includes(name.trim())) {
                  storage.setHosts([...current, name.trim()]);
                }
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-border/50 px-3 py-1 font-medium hover:bg-border transition"
          >
            <Plus className="h-3.5 w-3.5" /> Add Host
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {hosts.map((h) => (
          <div
            key={h.name}
            className={`glass rounded-2xl p-4 transition ${
              h.busy ? "ring-1 ring-primary/40" : "opacity-90"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
                    h.busy
                      ? "bg-primary/20 text-primary"
                      : "bg-success/20 text-success"
                  }`}
                >
                  {h.name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-semibold leading-tight">{h.name}</div>
                  <div
                    className={`text-[11px] font-medium ${
                      h.busy ? "text-primary" : "text-success"
                    }`}
                  >
                    {h.busy ? `${h.customerCount} attending` : "Free"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    h.busy ? "bg-primary animate-pulse" : "bg-success"
                  }`}
                />
                {!h.busy && (
                  <button
                    onClick={() => removeHost(h.name)}
                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition"
                    title="Remove host"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {h.busy && (
              <div className="mt-3 space-y-1.5">
                <div className="flex flex-wrap gap-1">
                  {Array.from(new Set(h.tables)).map((t) => (
                    <span
                      key={t}
                      className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[11px] font-semibold text-primary"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {Array.from(new Set(h.customers)).join(", ")}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

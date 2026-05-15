// Local persistence layer. Supabase provides live sync; localStorage is the local cache.
import type { Session, Staff } from "./types";
import { supabase } from "./supabase";

const KEYS = {
  staff: "ph_staff",
  sessions: "ph_sessions",
  theme: "ph_theme",
  tables: "ph_tables",
  hosts: "ph_hosts",
};

// ──────────────────────────────────────────────
// Supabase Sync logic for all app data
// ──────────────────────────────────────────────
const SYNC_KEYS = ["sessions", "tables", "hosts"] as const;

if (typeof window !== "undefined") {
  // 1. Initial fetch of all keys
  supabase
    .from("app_data")
    .select("*")
    .in("id", SYNC_KEYS)
    .then(
      ({ data, error }) => {
        if (error) {
          console.error("Supabase initial fetch failed:", error.message);
          return;
        }
        data?.forEach((row) => {
          const key = row.id as (typeof SYNC_KEYS)[number];
          if (row.data?.list) {
            // Only overwrite if remote data is newer or local is empty
            const localRaw = localStorage.getItem(`ph_${key}`);
            if (!localRaw) {
              localStorage.setItem(`ph_${key}`, JSON.stringify(row.data.list));
              window.dispatchEvent(new CustomEvent(`ph_${key}_changed`));
            }
          }
        });
      },
      (err: any) => {
        console.error("Unhandled error during Supabase sync:", err);
      }
    );

  // 2. Realtime subscription for all app data
  supabase
    .channel("app_data_all")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "app_data",
      },
      (payload: any) => {
        const id = payload.new?.id as (typeof SYNC_KEYS)[number];
        const newData = payload.new?.data;
        if (SYNC_KEYS.includes(id) && newData?.list) {
          localStorage.setItem(`ph_${id}`, JSON.stringify(newData.list));
          window.dispatchEvent(new CustomEvent(`ph_${id}_changed`));
        }
      }
    )
    .subscribe();
}

export const storage = {
  getStaff(): Staff | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(KEYS.staff);
    return raw ? JSON.parse(raw) : null;
  },
  setStaff(s: Staff | null) {
    if (s) localStorage.setItem(KEYS.staff, JSON.stringify(s));
    else localStorage.removeItem(KEYS.staff);
  },
  getSessions(): Session[] {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(KEYS.sessions);
    return raw ? JSON.parse(raw) : [];
  },
  setSessions(list: Session[]) {
    localStorage.setItem(KEYS.sessions, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("ph_sessions_changed"));
    this.syncToSupabase("sessions", list);
  },
  getTheme(): "light" | "dark" {
    if (typeof window === "undefined") return "light";
    return (localStorage.getItem(KEYS.theme) as "light" | "dark") || "light";
  },
  setTheme(t: "light" | "dark") {
    localStorage.setItem(KEYS.theme, t);
  },
  getTables(): string[] {
    if (typeof window === "undefined") return ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
    const raw = localStorage.getItem(KEYS.tables);
    return raw ? JSON.parse(raw) : ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
  },
  setTables(list: string[]) {
    localStorage.setItem(KEYS.tables, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("ph_tables_changed"));
    this.syncToSupabase("tables", list);
  },
  getHosts(): string[] {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(KEYS.hosts);
    return raw ? JSON.parse(raw) : [];
  },
  setHosts(list: string[]) {
    localStorage.setItem(KEYS.hosts, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("ph_hosts_changed"));
    this.syncToSupabase("hosts", list);
  },
  // Private helper for Supabase sync
  syncToSupabase(id: string, list: any[]) {
    try {
      supabase
        .from("app_data")
        .upsert(
          { id, data: { list }, updated_at: new Date().toISOString() },
          { onConflict: "id" }
        )
        .then(({ error }) => {
          if (error) console.error(`Supabase sync error (${id}):`, error.message);
        });
    } catch (error) {
      console.error(`Supabase sync failed (${id}):`, error);
    }
  },
};

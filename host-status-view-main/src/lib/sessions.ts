import { storage } from "./storage";
import { type Person, type PricingPlan, type Session, type TableId } from "./types";
import { syncRegistration, syncBill } from "@/server/sheets.functions";
import { computeBill, ensurePersons } from "./billing";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function nextLabel(existing: Person[]): string {
  const used = new Set(existing.map((p) => p.label));
  for (let i = 0; i < 26; i++) {
    const l = String.fromCharCode(65 + i);
    if (!used.has(l)) return l;
  }
  // overflow: AA, AB…
  for (let i = 0; i < 26; i++)
    for (let j = 0; j < 26; j++) {
      const l = String.fromCharCode(65 + i) + String.fromCharCode(65 + j);
      if (!used.has(l)) return l;
    }
  return "?";
}

function activeCount(persons: Person[]) {
  return persons.filter((p) => !p.leftAt).length;
}

export const sessionsApi = {
  list(): Session[] {
    return storage.getSessions();
  },
  active(): Session[] {
    return storage.getSessions().filter((s) => s.status === "active");
  },
  byTable(t: TableId): Session | undefined {
    return storage.getSessions().find((s) => s.status === "active" && s.tableIds.includes(t));
  },

  create(input: {
    customerName: string;
    customerMobile: string;
    tableIds: TableId[];
    adults: number;
    kids: number;
    pricing: PricingPlan;
    plannedDurationMin: number;
    staffName: string;
    startedAt: number;
    hosts?: string[];
  }): Session {
    // Build persons[] up front from adults + kids + memberRates.
    const persons: Person[] = [];
    const rates = input.pricing.memberRates ?? [];
    for (let i = 0; i < input.adults; i++) {
      persons.push({
        id: uid(),
        label: String.fromCharCode(65 + i),
        kind: "adult",
        joinedAt: input.startedAt,
        firstHourRate: rates[i] ?? input.pricing.adultRate,
      });
    }
    for (let j = 0; j < input.kids; j++) {
      const i = input.adults + j;
      persons.push({
        id: uid(),
        label: String.fromCharCode(65 + i),
        kind: "kid",
        joinedAt: input.startedAt,
        firstHourRate: rates[i] ?? input.pricing.kidRate,
      });
    }

    const s: Session = {
      id: uid(),
      ...input,
      status: "active",
      history: [{ at: input.startedAt, adults: input.adults, kids: input.kids }],
      persons,
    };
    const all = storage.getSessions();
    all.push(s);
    storage.setSessions(all);
    syncRegistration({ session: s }).catch(() => {});
    return s;
  },

  // NEW — add a single person. Joins NOW (or at provided ts). Auto-labelled.
  addPerson(id: string, kind: "adult" | "kid" = "adult", joinedAt: number = Date.now()) {
    const all = storage.getSessions();
    const s = all.find((x) => x.id === id);
    if (!s) return;
    const persons = ensurePersons(s).slice();
    const label = nextLabel(persons);
    const firstHourRate = kind === "adult" ? s.pricing.adultRate : s.pricing.kidRate;
    persons.push({ id: uid(), label, kind, joinedAt, firstHourRate });
    s.persons = persons;
    if (kind === "adult") s.adults = persons.filter((p) => !p.leftAt && p.kind === "adult").length;
    else s.kids = persons.filter((p) => !p.leftAt && p.kind === "kid").length;
    s.history.push({ at: joinedAt, adults: s.adults, kids: s.kids });
    storage.setSessions(all);
  },

  // NEW — mark a specific person as left.
  removePerson(id: string, personId: string, leftAt: number = Date.now()) {
    const all = storage.getSessions();
    const s = all.find((x) => x.id === id);
    if (!s) return;
    const persons = ensurePersons(s).slice();
    const p = persons.find((x) => x.id === personId);
    if (!p || p.leftAt) return;
    p.leftAt = leftAt;
    s.persons = persons;
    s.adults = persons.filter((x) => !x.leftAt && x.kind === "adult").length;
    s.kids = persons.filter((x) => !x.leftAt && x.kind === "kid").length;
    s.history.push({ at: leftAt, adults: s.adults, kids: s.kids });
    storage.setSessions(all);
  },

  // NEW — edit the session start/end times. Persons are shifted/clamped.
  updateSessionTimes(id: string, newStart: number, newEnd?: number) {
    const all = storage.getSessions();
    const s = all.find((x) => x.id === id);
    if (!s) return;
    const oldStart = s.startedAt;
    const persons = ensurePersons(s).slice();
    persons.forEach((p) => {
      if (p.joinedAt === oldStart) p.joinedAt = newStart;
      if (p.joinedAt < newStart) p.joinedAt = newStart;
      if (newEnd) {
        if (p.leftAt && p.leftAt > newEnd) p.leftAt = newEnd;
        if (p.joinedAt > newEnd) p.joinedAt = newEnd;
      }
    });
    s.persons = persons;
    s.startedAt = newStart;
    s.history = s.history.map((h) => (h.at === oldStart ? { ...h, at: newStart } : h));
    s.endedAt = newEnd;
    storage.setSessions(all);
  },

  // Legacy — kept for backward compat with old UI; routes to add/remove.
  updatePersons(id: string, adults: number, kids: number) {
    const all = storage.getSessions();
    const s = all.find((x) => x.id === id);
    if (!s) return;
    const persons = ensurePersons(s).slice();
    const now = Date.now();
    const curAdults = persons.filter((p) => !p.leftAt && p.kind === "adult");
    const curKids = persons.filter((p) => !p.leftAt && p.kind === "kid");
    // adults
    while (curAdults.length > adults) {
      const last = curAdults.pop()!;
      const ref = persons.find((p) => p.id === last.id)!;
      ref.leftAt = now;
    }
    while (curAdults.length < adults) {
      const label = nextLabel(persons);
      const np: Person = { id: uid(), label, kind: "adult", joinedAt: now, firstHourRate: s.pricing.adultRate };
      persons.push(np); curAdults.push(np);
    }
    // kids
    while (curKids.length > kids) {
      const last = curKids.pop()!;
      const ref = persons.find((p) => p.id === last.id)!;
      ref.leftAt = now;
    }
    while (curKids.length < kids) {
      const label = nextLabel(persons);
      const np: Person = { id: uid(), label, kind: "kid", joinedAt: now, firstHourRate: s.pricing.kidRate };
      persons.push(np); curKids.push(np);
    }
    s.persons = persons;
    s.adults = adults; s.kids = kids;
    s.history.push({ at: now, adults, kids });
    storage.setSessions(all);
  },

  updateMenuQty(id: string, itemId: string, qty: number) {
    const all = storage.getSessions();
    const s = all.find((x) => x.id === id);
    if (!s) return;
    const orders = { ...(s.menuOrders ?? {}) };
    if (qty <= 0) delete orders[itemId];
    else orders[itemId] = qty;
    s.menuOrders = orders;
    storage.setSessions(all);
  },
  extendSession(id: string, addMinutes: number = 60) {
    const all = storage.getSessions();
    const s = all.find((x) => x.id === id);
    if (!s) return;
    s.plannedDurationMin = (s.plannedDurationMin ?? 60) + addMinutes;
    storage.setSessions(all);
  },
  addTables(id: string, tables: TableId[]) {
    const all = storage.getSessions();
    const s = all.find((x) => x.id === id);
    if (!s) return;
    const set = new Set([...s.tableIds, ...tables]);
    s.tableIds = Array.from(set);
    storage.setSessions(all);
  },
  freeTables(): TableId[] {
    const taken = new Set<TableId>();
    storage.getSessions().filter((s) => s.status === "active").forEach((s) => s.tableIds.forEach((t) => taken.add(t)));
    return storage.getTables().filter((t) => !taken.has(t));
  },
  complete(id: string) {
    const all = storage.getSessions();
    const s = all.find((x) => x.id === id);
    if (!s) return null;
    const endedAt = Date.now();
    s.status = "completed";
    s.endedAt = endedAt;
    // close any still-active persons at end time
    const persons = ensurePersons(s).slice();
    persons.forEach((p) => { if (!p.leftAt) p.leftAt = endedAt; });
    s.persons = persons;
    storage.setSessions(all);
    const bill = computeBill(s, endedAt);
    syncBill({ bill, session: s }).catch(() => {});
    return bill;
  },
};

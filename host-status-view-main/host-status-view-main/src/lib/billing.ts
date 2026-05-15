// Billing engine — per-person rule.
// Every person has their own joinedAt (and optional leftAt). For each person:
//   • first 60 minutes of THEIR presence is billed at their `firstHourRate`
//   • every minute beyond that is billed at the session's `subsequentRate`
// All amounts are pro-rated to the MINUTE only (seconds are always truncated).
//
// If a session has no `persons` array (legacy data), we synthesise one from
// `adults` + `kids` + `pricing.memberRates` so old sessions still bill correctly.

import type { Bill, BillLine, Person, Session } from "./types";
import { MENU_ITEMS } from "./types";

const MS_PER_MIN = 60_000;
const MS_PER_HOUR = 3_600_000;
const round = (n: number) => Math.round(n * 100) / 100;

/** Truncate ms down to the nearest whole minute (drop seconds entirely) */
function floorToMinutes(ms: number): number {
  return Math.floor(ms / MS_PER_MIN) * MS_PER_MIN;
}

/** Format ms as "Xh Ym" — no seconds ever shown */
function fmtDuration(ms: number): string {
  const totalMin = Math.floor(ms / MS_PER_MIN);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || parts.length === 0) parts.push(`${m}m`);
  return parts.join(" ");
}

export function ensurePersons(s: Session): Person[] {
  if (s.persons && s.persons.length) return s.persons;
  const persons: Person[] = [];
  const rates = s.pricing.memberRates ?? [];
  for (let i = 0; i < s.adults; i++) {
    persons.push({
      id: `p-${i}`,
      label: String.fromCharCode(65 + i),
      kind: "adult",
      joinedAt: s.startedAt,
      firstHourRate: rates[i] ?? s.pricing.adultRate,
    });
  }
  for (let j = 0; j < s.kids; j++) {
    const i = s.adults + j;
    persons.push({
      id: `p-${i}`,
      label: String.fromCharCode(65 + i),
      kind: "kid",
      joinedAt: s.startedAt,
      firstHourRate: rates[i] ?? s.pricing.kidRate,
    });
  }
  return persons;
}

export interface PersonCharge {
  person: Person;
  presentMs: number;       // ms present, floored to whole minutes
  presentMin: number;      // whole minutes present
  firstHourMs: number;     // ms billed at first-hour rate (max 60 min)
  extraMs: number;         // ms billed at subsequent rate
  firstHourMin: number;    // whole minutes in first hour
  extraMin: number;        // whole minutes beyond first hour
  firstHourAmt: number;
  extraAmt: number;
  total: number;
}

export function chargeForPerson(p: Person, sessionEnd: number, subsequentRate: number): PersonCharge {
  const end = Math.min(p.leftAt ?? sessionEnd, sessionEnd);
  const rawMs = Math.max(0, end - p.joinedAt);

  // ✅ Drop seconds — only count whole minutes
  const presentMs = floorToMinutes(rawMs);

  // Split at exactly 60 minutes
  const firstHourMs = Math.min(MS_PER_HOUR, presentMs);
  const extraMs = Math.max(0, presentMs - MS_PER_HOUR);

  // Amounts: based on whole minutes only
  const firstHourAmt = round((firstHourMs / MS_PER_HOUR) * p.firstHourRate);
  // If first hour is free (Cafe Only), subsequent hours are also free.
  const rateForExtra = p.firstHourRate === 0 ? 0 : subsequentRate;
  const extraAmt = round((extraMs / MS_PER_HOUR) * rateForExtra);

  const presentMin = presentMs / MS_PER_MIN;
  const firstHourMin = firstHourMs / MS_PER_MIN;
  const extraMin = extraMs / MS_PER_MIN;

  return {
    person: p,
    presentMs,
    presentMin,
    firstHourMs,
    extraMs,
    firstHourMin,
    extraMin,
    firstHourAmt,
    extraAmt,
    total: round(firstHourAmt + extraAmt),
  };
}

export function computeBill(s: Session, endedAt: number = Date.now()): Bill {
  const persons = ensurePersons(s);
  const sessionEnd = Math.min(endedAt, s.endedAt ?? endedAt);
  const subsequent = s.pricing.subsequentRate ?? 99;

  const lines: BillLine[] = [];
  const charges = persons.map((p) => chargeForPerson(p, sessionEnd, subsequent));

  for (const c of charges) {
    if (c.presentMs <= 0) continue;

    const qty = c.presentMs / MS_PER_HOUR; // fractional hours (minutes only, no seconds)

    // ✅ Label shows "Xh Ym" — seconds never appear
    const desc =
      c.extraMs > 0
        ? `Person ${c.person.label} (1h@₹${c.person.firstHourRate} + ${fmtDuration(c.extraMs)}@₹${subsequent})`
        : `Person ${c.person.label} (${fmtDuration(c.presentMs)}@₹${c.person.firstHourRate})`;

    lines.push({
      label: desc,
      qty,
      rate: c.extraMs > 0 ? subsequent : c.person.firstHourRate,
      amount: c.total,
    });
  }

  if (s.menuOrders) {
    for (const [itemId, qty] of Object.entries(s.menuOrders)) {
      if (!qty || qty <= 0) continue;
      const item = MENU_ITEMS.find((m) => m.id === itemId);
      if (!item) continue;
      lines.push({
        label: item.label,
        qty,
        rate: item.price,
        amount: round(qty * item.price),
      });
    }
  }

  const subtotal = round(lines.reduce((a, l) => a + l.amount, 0));
  const totalMs = Math.max(0, floorToMinutes(sessionEnd) - floorToMinutes(s.startedAt));

  return {
    sessionId: s.id,
    customerName: s.customerName,
    customerMobile: s.customerMobile,
    tables: s.tableIds,
    startedAt: s.startedAt,
    endedAt: sessionEnd,
    durationMin: round(totalMs / MS_PER_MIN),
    lines,
    subtotal,
    total: subtotal,
  };
}

/** Live timer display — still shows HH:MM:SS for the running clock only */
export function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/** Bill display — only shows HH:MM */
export function formatDurationMin(ms: number) {
  // Use floor to match billing calculation (no pro-rating of partial seconds)
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

// Helper exported for UI summaries
export function summarisePersons(s: Session, now: number = Date.now()) {
  const persons = ensurePersons(s);
  const subsequent = s.pricing.subsequentRate ?? 99;
  return persons.map((p) => ({
    ...chargeForPerson(p, Math.min(now, s.endedAt ?? now), subsequent),
    active: !p.leftAt,
  }));
}
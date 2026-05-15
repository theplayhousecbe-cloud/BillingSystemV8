export type TableId = string;
export const DEFAULT_TABLE_IDS: TableId[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
export const TABLE_CAPACITY = 100;

export interface Staff {
  name: string;
  mobile: string;
  loggedInAt: number;
  role: string;
  access?: string;
}

export type AdultRate = 149 | 99 | number;
export type PackageId = "games-food-149" | "kids-food-99" | "games-only-99" | "cafe-only" | "custom";

export interface PricingPlan {
  packageId?: PackageId;
  packageName?: string;
  adultRate: number;
  kidRate: number; // legacy/default (below 10)
  kidRateAbove10: number;
  subsequentRate: number;
  custom: boolean;
  selectAllMenu: boolean;
  menuItems?: string[];
  memberRates?: number[];
}

export const PACKAGES: { id: PackageId; name: string; adultRate: number; kidRate: number; subsequentRate: number; description: string }[] = [
  { id: "games-food-149", name: "1st. 149 Package (Games + Food)", adultRate: 149, kidRate: 149, subsequentRate: 99, description: "1hr games + food included" },
  { id: "kids-food-99", name: "2). 99 Kids Package (Games + Food)", adultRate: 99, kidRate: 99, subsequentRate: 99, description: "1hr games + food for kids" },
  { id: "games-only-99", name: "3). 99 Games Only (No Food)", adultRate: 99, kidRate: 99, subsequentRate: 99, description: "1hr games only, no food" },
  { id: "cafe-only", name: "4). Cafe Only (No Time Charge)", adultRate: 0, kidRate: 0, subsequentRate: 0, description: "Only menu bill, no time charge" },
];

// NEW — individual person tracked across the whole session.
// `label` is auto-assigned ("A", "B", "C"...) and is stable for the life of the session.
// `joinedAt` is when this specific person joined the session.
// `leftAt` (optional) is when they left; if absent they are still present.
// `firstHourRate` is what THIS person pays for their first 60 minutes.
// After the first 60 minutes everyone is billed at the session's `subsequentRate`.
export interface Person {
  id: string;
  label: string;        // "A", "B", "C" …
  kind: "adult" | "kid" | "kid_above_10";
  joinedAt: number;
  leftAt?: number;
  firstHourRate: number;
  pausedMs?: number;
}

export interface Session {
  id: string;
  customerName: string;
  customerMobile: string;
  tableIds: TableId[];
  adults: number;        // legacy snapshot at start
  kids: number;          // legacy snapshot at start (below 10)
  kidsAbove10: number;   // NEW snapshot at start
  pricing: PricingPlan;
  startedAt: number;     // ms epoch — EDITABLE
  plannedDurationMin: number;
  endedAt?: number;
  status: "active" | "completed";
  staffName: string;
  hosts?: string[];
  history: Array<{ at: number; adults: number; kids: number }>; // legacy
  persons?: Person[];    // NEW source of truth
  menuOrders?: Record<string, number>;
  sentOrders?: Record<string, number>;
  pausedMs?: number;
}

export const MENU_ITEMS: { id: string; label: string; price: number }[] = [
  { id: "tea", label: "Tea", price: 30 },
  { id: "coffee", label: "Coffee", price: 50 },
  { id: "cold-coffee", label: "Cold Coffee", price: 90 },
  { id: "maggi", label: "Maggi", price: 80 },
  { id: "sandwich", label: "Sandwich", price: 110 },
  { id: "burger", label: "Burger", price: 130 },
  { id: "fries", label: "French Fries", price: 100 },
  { id: "pizza", label: "Pizza", price: 220 },
  { id: "pasta", label: "Pasta", price: 180 },
  { id: "shake", label: "Milkshake", price: 120 },
  { id: "mojito", label: "Mojito", price: 110 },
  { id: "water", label: "Water Bottle", price: 20 },
];

export interface BillLine {
  label: string;
  qty: number;
  rate: number;
  amount: number;
  qtyLabel?: string;
  rateLabel?: string;
  subLabel?: string;
}
export interface Bill {
  sessionId: string;
  customerName: string;
  customerMobile: string;
  tables: TableId[];
  startedAt: number;
  endedAt: number;
  durationMin: number;
  lines: BillLine[];
  subtotal: number;
  total: number;
}

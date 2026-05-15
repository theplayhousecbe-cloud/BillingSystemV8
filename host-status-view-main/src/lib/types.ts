export type TableId = string;
export const DEFAULT_TABLE_IDS: TableId[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
export const TABLE_CAPACITY = 4;

export interface Staff {
  id: string;
  name: string;
  role: string;
  mobile: string;
  loggedInAt: number;
}

export interface Game {
  id: string;
  name: string;
  category: string;
  max_players: number;
  status: 'available' | 'in-use';
  created_at: string;
}

export interface AttendanceBreak {
  type: string;
  start: string;
  end?: string;
  duration?: number;
}

export interface Attendance {
  id: string;
  staff_id: string;
  date: string;
  clock_in: string;
  clock_out?: string;
  late_mins: number;
  breaks: AttendanceBreak[];
  force_stops: AttendanceBreak[];
  created_at: string;
}

export interface StockLog {
  id: string;
  cook_id: string;
  date: string;
  items: Array<{ item_name: string; quantity: number; unit: string }>;
  created_at: string;
}

export interface DamageReport {
  id: string;
  cook_id: string;
  photo_url?: string;
  description: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  admin_note?: string;
  created_at: string;
}

export interface Task {
  id: string;
  assigned_to: string;
  title: string;
  description: string;
  deadline: string;
  priority: 'Low' | 'Medium' | 'High';
  status: 'To Do' | 'In Progress' | 'Done';
  delivery_url?: string;
  rating?: number;
  created_at: string;
}

export type AdultRate = 149 | 199 | number;
export interface PricingPlan {
  adultRate: number;
  kidRate: number;
  subsequentRate: number;
  custom: boolean;
  selectAllMenu: boolean;
  menuItems?: string[];
  memberRates?: number[];
}

// NEW — individual person tracked across the whole session.
// `label` is auto-assigned ("A", "B", "C"...) and is stable for the life of the session.
// `joinedAt` is when this specific person joined the session.
// `leftAt` (optional) is when they left; if absent they are still present.
// `firstHourRate` is what THIS person pays for their first 60 minutes.
// After the first 60 minutes everyone is billed at the session's `subsequentRate`.
export interface Person {
  id: string;
  label: string;        // "A", "B", "C" …
  kind: "adult" | "kid";
  joinedAt: number;
  leftAt?: number;
  firstHourRate: number;
}

export interface Session {
  id: string;
  customerName: string;
  customerMobile: string;
  tableIds: TableId[];
  adults: number;        // legacy snapshot at start
  kids: number;          // legacy snapshot at start
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

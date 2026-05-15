import { z } from "zod";
import { supabase } from "../lib/supabase";

const sessionSchema = z.object({
  id: z.string(),
  customerName: z.string(),
  customerMobile: z.string(),
  tableIds: z.array(z.string()),
  adults: z.number(),
  kids: z.number(),
  pricing: z.object({
    adultRate: z.number(),
    kidRate: z.number(),
    subsequentRate: z.number(),
    custom: z.boolean(),
    selectAllMenu: z.boolean(),
  }),
  startedAt: z.number(),
  plannedDurationMin: z.number(),
  endedAt: z.number().optional(),
  status: z.enum(["active", "completed"]),
  staffName: z.string(),
  history: z.array(z.object({ at: z.number(), adults: z.number(), kids: z.number() })),
});

/** Legacy stub — kept for backwards compatibility so callers don't break. */
export const initSheet = async () => {
  return { spreadsheetId: "supabase-mode" };
};

export const syncRegistration = async (input: { session: z.infer<typeof sessionSchema> }) => {
  const s = sessionSchema.parse(input.session);

  const { error } = await supabase.from("registrations").insert({
    id: s.id,
    customer_name: s.customerName,
    customer_mobile: s.customerMobile,
    tables: s.tableIds.join(", "),
    adults: s.adults,
    kids: s.kids,
    adult_rate: s.pricing.adultRate,
    kid_rate: s.pricing.kidRate,
    subsequent_rate: s.pricing.subsequentRate,
    staff_name: s.staffName,
    created_at: new Date().toISOString(),
  });

  if (error) console.error("Supabase registration sync failed:", error);
  return { ok: !error };
};

export const syncBill = async (input: {
  bill: {
    sessionId: string;
    customerName: string;
    customerMobile: string;
    tables: string[];
    startedAt: number;
    endedAt: number;
    durationMin: number;
    subtotal: number;
    total: number;
  };
  session: z.infer<typeof sessionSchema>;
}) => {
  const b = input.bill;

  const { error } = await supabase.from("bills").insert({
    session_id: b.sessionId,
    customer_name: b.customerName,
    customer_mobile: b.customerMobile,
    tables: b.tables.join(", "),
    started_at: new Date(b.startedAt).toISOString(),
    ended_at: new Date(b.endedAt).toISOString(),
    duration_min: b.durationMin,
    subtotal: b.subtotal,
    total: b.total,
    created_at: new Date().toISOString(),
  });

  if (error) console.error("Supabase bill sync failed:", error);
  return { ok: !error };
};

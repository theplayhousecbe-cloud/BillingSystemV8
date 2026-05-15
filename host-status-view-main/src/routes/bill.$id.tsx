import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { AppHeader } from "@/components/AppHeader";
import { RequireAuth } from "@/components/AuthGuard";
import { sessionsApi } from "@/lib/sessions";
import { computeBill, formatDurationMin, ensurePersons } from "@/lib/billing";

export const Route = createFileRoute("/bill/$id")({
  component: () => (<RequireAuth><BillPage /></RequireAuth>),
});

const CAFE_NAME = "The PlayHouse";
const CAFE_TAGLINE = "Board Game Cafe";
const CAFE_ADDRESS_LINE_1 = "First Floor, Standard Towers";
const CAFE_ADDRESS_LINE_2 = "288 A, Periyar Nagar";
const CAFE_ADDRESS_LINE_3 = "Coimbatore, Tamil Nadu 641004";

// Pricing — ₹149/head for the first hour, ₹99/head per additional hour (pro-rated by minute).
const FIRST_HOUR_RATE = 149;
const EXTRA_HOUR_RATE = 99;

type BillLine = { label: string; qty: number; rate: number; amount: number };


function BillPage() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const session = useMemo(() => sessionsApi.list().find((s) => s.id === id), [id]);

  if (!session) {
    return (
      <div className="min-h-screen"><AppHeader />
        <main className="mx-auto max-w-md px-4 py-12 text-center"><div className="glass rounded-2xl p-8">
          <p>Bill not found.</p>
          <button onClick={() => nav({ to: "/" })} className="mt-4 text-primary underline">Dashboard</button>
        </div></main>
      </div>
    );
  }

  const endedAt = session.endedAt ?? Date.now();
  const bill = computeBill(session, endedAt);
  const allPersons = ensurePersons(session);
  const totalAdults = allPersons.filter((p) => p.kind === "adult").length;
  const totalKids = allPersons.filter((p) => p.kind === "kid").length;

  const qrPayload = JSON.stringify({
    cafe: CAFE_NAME,
    bill: bill.sessionId,
    total: bill.total,
    tables: bill.tables,
    at: new Date(endedAt).toISOString(),
  });

  return (
    <div className="min-h-screen">
      {/* Print styles tuned for TVS RP3200 Lite (80mm thermal roll, ~72mm printable).
          Compact, ultra-bold and well-spaced for thermal-head legibility. */}
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 0; }
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body * { visibility: hidden !important; }
          #thermal-receipt, #thermal-receipt * { visibility: visible !important; }
          #thermal-receipt, #thermal-receipt * {
            color: #000 !important;
            background: transparent !important;
            border-color: #000 !important;
            opacity: 1 !important;
            text-shadow: 0 0 0 #000, 0.02em 0 0 #000;
          }
          #thermal-receipt {
            position: absolute; left: 0; top: 0;
            width: 72mm; padding: 2mm;
            background: #fff !important;
            font-family: "Courier New", ui-monospace, monospace;
            font-size: 13px; line-height: 1.5; font-weight: 900 !important;
            letter-spacing: 0.4px;
          }
          #thermal-receipt .t-center { text-align: center; }
          #thermal-receipt .t-row { display: flex; justify-content: space-between; gap: 6px; }
          #thermal-receipt .t-bold { font-weight: 900; }
          #thermal-receipt .t-lg { font-size: 15px; font-weight: 900; letter-spacing: 1px; }
          #thermal-receipt .t-xs { font-size: 11px !important; font-weight: 800 !important; letter-spacing: 0.4px; }
          #thermal-receipt .t-divider { border-top: 1px dashed #000; margin: 4px 0; }
          #thermal-receipt .t-solid { border-top: 1.5px solid #000; margin: 4px 0; }
          #thermal-receipt table { width: 100%; border-collapse: collapse; font-size: 11.5px; font-weight: 800; }
          #thermal-receipt th, #thermal-receipt td { padding: 2px 1px; vertical-align: top; font-size: 11.5px !important; letter-spacing: 0.3px; }
          #thermal-receipt dl, #thermal-receipt dt, #thermal-receipt dd { font-size: 11.5px !important; font-weight: 800 !important; letter-spacing: 0.3px; line-height: 1.55; }
          #thermal-receipt .t-qr { display: flex; justify-content: center; margin-top: 4px; }
          #thermal-receipt .t-qr svg { width: 18mm !important; height: 18mm !important; }
          #thermal-receipt .t-total { font-size: 14px; font-weight: 900; letter-spacing: 0.6px; }
        }
      `}</style>

      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-6 sm:py-8">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <button onClick={() => nav({ to: "/" })} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </button>
          <button onClick={() => window.print()} className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium">
            <Printer className="h-4 w-4" /> Print
          </button>
        </div>

        <article id="thermal-receipt" className="glass-strong mx-auto w-full max-w-[300px] rounded-3xl p-4 sm:p-5 font-bold text-foreground">
          <header className="t-center text-center">
            <div className="t-lg font-display text-base font-black tracking-wide sm:text-lg">{CAFE_NAME}</div>
            <div className="t-xs text-[11px] font-bold uppercase tracking-widest">
              {CAFE_TAGLINE}
            </div>
            <div className="t-xs mt-1 text-[11px] font-bold leading-snug">
              {CAFE_ADDRESS_LINE_1}<br />
              {CAFE_ADDRESS_LINE_2}<br />
              {CAFE_ADDRESS_LINE_3}
            </div>
            <div className="t-xs mt-1 text-[11px] font-bold">Official Bill / Receipt</div>
          </header>

          <div className="t-divider my-2 border-t border-dashed border-border" />

          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px] font-bold leading-relaxed">
            <dt>Bill ID</dt><dd className="text-right font-mono text-[11px] break-all">{bill.sessionId}</dd>
            <dt>Customer</dt><dd className="text-right">{bill.customerName}</dd>
            <dt>Mobile</dt><dd className="text-right">{bill.customerMobile}</dd>
            <dt>Table(s)</dt><dd className="text-right">{bill.tables.join(", ") || "—"}</dd>
            <dt>Persons</dt><dd className="text-right">{totalAdults} adult{totalAdults!==1?"s":""}{totalKids>0?` + ${totalKids} kid${totalKids!==1?"s":""}`:""}</dd>
            <dt>In time</dt><dd className="text-right">{new Date(bill.startedAt).toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}</dd>
            <dt>Out time</dt><dd className="text-right">{new Date(bill.endedAt).toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}</dd>
            <dt>Duration</dt><dd className="text-right tabular-nums">{formatDurationMin(bill.endedAt - bill.startedAt)}</dd>
          </dl>

          <div className="t-divider my-2 border-t border-dashed border-border" />

          <table className="w-full text-[12px] font-bold">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide">
                <th className="pb-1">Item</th>
                <th className="pb-1 pl-2 text-right">Qty</th>
                <th className="pb-1 pl-2 text-right">Rate</th>
                <th className="pb-1 pl-2 text-right">Amt</th>
              </tr>
            </thead>
            <tbody>
              {bill.lines.map((l, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-1 pr-1">{l.label}</td>
                  <td className="py-1 pl-2 text-right tabular-nums">{l.qty.toFixed(2)}</td>
                  <td className="py-1 pl-2 text-right tabular-nums">₹{l.rate}</td>
                  <td className="py-1 pl-2 text-right tabular-nums">₹{l.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="t-solid my-2 border-t border-border" />
          <div className="t-row t-total flex justify-between text-sm font-extrabold">
            <span>TOTAL</span><span className="tabular-nums">₹{bill.total.toFixed(2)}</span>
          </div>

          <div className="t-qr mt-2 flex flex-col items-center gap-1 rounded-2xl bg-muted/40 p-2 print:bg-white">
            <QRCodeSVG value={qrPayload} size={70} bgColor="#ffffff" fgColor="#000000" level="M" />
            <div className="t-xs text-[11px] font-bold">Scan to verify · {bill.sessionId}</div>
          </div>

          <p className="t-center mt-2 text-center text-[11px] font-bold">
            Thank you for visiting {CAFE_NAME}
          </p>
        </article>
      </main>
    </div>
  );
}

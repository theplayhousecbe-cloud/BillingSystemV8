import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { AppHeader } from "@/components/AppHeader";
import { RequireAuth } from "@/components/AuthGuard";
import { sessionsApi } from "@/lib/sessions";
import { computeBill, formatDuration, formatDurationMin, ensurePersons, chargeForPerson, fmtDuration } from "@/lib/billing";

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




function BillPage() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const session = useMemo(() => sessionsApi.list().find((s) => s.id === id), [id]);

  if (!session) {
    return (
      <div className="min-h-screen bg-background/50 animate-fade-in">
        <AppHeader />
        <main className="mx-auto max-w-md px-4 py-24 text-center">
          <div className="glass rounded-3xl p-12 shadow-2xl">
            <p className="text-lg font-medium text-muted-foreground">Bill not found.</p>
            <button 
              onClick={() => nav({ to: "/" })} 
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2 font-semibold text-primary-foreground transition-transform hover:scale-105 active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" /> Return to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  const endedAt = session.endedAt ?? Date.now();
  const bill = computeBill(session, endedAt);
  const allPersons = ensurePersons(session);
  
  // Categorize lines
  const gamingLines = bill.lines.filter(l => l.label.startsWith("Person "));
  const cafeLines = bill.lines.filter(l => !l.label.startsWith("Person "));
  
  const gamingSubtotal = gamingLines.reduce((sum, l) => sum + l.amount, 0);
  const cafeSubtotal = cafeLines.reduce((sum, l) => sum + l.amount, 0);

  const qrPayload = JSON.stringify({
    cafe: CAFE_NAME,
    bill: bill.sessionId,
    total: bill.total,
    tables: bill.tables,
    at: new Date(endedAt).toISOString(),
  });

  const formatDate = (date: number) => {
    return new Date(date).toLocaleString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    }).toUpperCase();
  };

  const formatTime = (date: number) => {
    return new Date(date).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    }).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] selection:bg-primary/20 pb-20">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
        
        body {
          font-family: 'Outfit', sans-serif;
        }

        @media print {
          @page { size: 80mm auto; margin: 0; }
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body * { visibility: hidden !important; }
          #thermal-receipt, #thermal-receipt * { 
            visibility: visible !important; 
            color: #000 !important; 
            background: transparent !important;
            box-shadow: none !important;
            border: none !important;
            /* Thicken text for thermal heads by doubling the render */
            text-shadow: 0 0 0 #000, 0.2px 0 0 #000;
          }
          #thermal-receipt {
            position: absolute; left: 0; top: 0;
            width: 72mm; padding: 2mm 4mm 25mm 4mm;
            background: #fff !important;
            border-radius: 0 !important;
            font-size: 13px;
            font-weight: 800;
            line-height: 1.2;
          }
          .receipt-gradient-border { display: none !important; }
          .print-hidden { display: none !important; }
          .left-badge { border: 1px solid #000 !important; color: #000 !important; }
          .grand-total-box { background: #eee !important; color: #000 !important; border: 2px solid #000 !important; }
          .icon-circle { border: 1px solid #000 !important; color: #000 !important; }
        }

        .receipt-gradient-border {
          position: absolute;
          inset: 0;
          border-radius: 2.5rem;
          padding: 4px;
          background: linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%);
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask-composite: exclude;
          pointer-events: none;
        }

        .dotted-line {
          border-top: 2px dotted #e2e8f0;
          width: 100%;
          margin: 1.5rem 0;
        }

        .left-badge {
          background: #fee2e2;
          color: #ef4444;
          font-size: 10px;
          padding: 1px 6px;
          border-radius: 99px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          margin-left: 8px;
        }

        .icon-circle {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 800;
          border: 1.5px solid currentColor;
        }
      `}</style>

      <AppHeader />
      
      <main className="mx-auto max-w-2xl px-4 py-8 animate-reveal-up">
        <div className="mb-8 flex items-center justify-between print-hidden">
          <button 
            onClick={() => nav({ to: "/" })} 
            className="group flex items-center gap-3 text-sm font-bold text-slate-500 transition-colors hover:text-indigo-600"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm transition-colors group-hover:bg-indigo-50">
              <ArrowLeft className="h-4 w-4" />
            </div>
            Back to Dashboard
          </button>
          
          <button 
            onClick={() => window.print()} 
            className="flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-95"
          >
            <Printer className="h-4 w-4" /> 
            Print Receipt
          </button>
        </div>

        <article 
          id="thermal-receipt" 
          className="relative mx-auto w-full max-w-[440px] overflow-hidden rounded-[2.5rem] bg-white p-8 shadow-xl sm:p-10 text-slate-800"
        >
          <div className="receipt-gradient-border" />

          {/* Header */}
          <header className="flex flex-col items-center text-center pb-6">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-100">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/50">
                <span className="text-xl">★</span>
              </div>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 leading-none">
              {CAFE_NAME}
            </h1>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.3em] text-indigo-600">
              {CAFE_TAGLINE}
            </p>
            
            <div className="mt-4 space-y-0.5 text-[11px] font-medium text-slate-500">
              <p>{CAFE_ADDRESS_LINE_1}</p>
              <p>{CAFE_ADDRESS_LINE_2}</p>
              <p>{CAFE_ADDRESS_LINE_3}</p>
            </div>
            
            <div className="mt-5 inline-flex rounded-full bg-indigo-50 px-5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-indigo-600 border border-indigo-100">
              Official Bill / Receipt
            </div>
          </header>

          <div className="dotted-line" />

          {/* Basic Info */}
          <div className="space-y-2.5 text-[12px] font-semibold text-slate-600">
            <div className="flex justify-between items-center">
              <span className="uppercase tracking-wider opacity-60">Bill ID</span>
              <span className="font-mono text-slate-400">{bill.sessionId}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="uppercase tracking-wider opacity-60">Customer</span>
              <span className="text-slate-900 font-extrabold uppercase">{bill.customerName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="uppercase tracking-wider opacity-60">Table(s)</span>
              <span className="text-slate-900 font-extrabold">Table {bill.tables.join(", ") || "—"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="uppercase tracking-wider opacity-60">Session</span>
              <span className="text-slate-900 font-extrabold">
                {formatTime(bill.startedAt)} - {formatTime(bill.endedAt)} ({formatDurationMin(bill.endedAt - bill.startedAt)})
              </span>
            </div>
          </div>

          <div className="dotted-line" />

          {/* Gaming Charges */}
          <section>
            <div className="flex justify-between items-end mb-4">
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-indigo-600 leading-none">Gaming Charges</h3>
                <p className="text-[9px] font-medium text-slate-400 mt-1">Full session + early departures</p>
              </div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter flex gap-8">
                <span>Time</span>
                <span>Rate</span>
                <span>Amount</span>
              </div>
            </div>

            <div className="space-y-4">
              {allPersons.map((p, idx) => {
                const charge = chargeForPerson(p, endedAt, session.pricing.subsequentRate);
                const hasLeft = p.leftAt && p.leftAt < endedAt;
                const colors = ["text-blue-500", "text-purple-500", "text-emerald-500", "text-amber-500", "text-rose-500", "text-indigo-500"];
                const colorClass = colors[idx % colors.length];

                return (
                  <div key={p.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className={`icon-circle ${colorClass}`}>
                        {p.label}
                      </div>
                      <div>
                        <div className="text-[13px] font-bold text-slate-800 flex items-center">
                          {idx === 0 ? bill.customerName : `Guest ${p.label}`}
                          <span className="ml-1 opacity-40 font-medium">({fmtDuration(charge.presentMs)})</span>
                          {hasLeft && (
                            <span className="left-badge">Left {formatTime(p.leftAt!)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-6 text-[13px] font-bold tabular-nums">
                      <span className="w-12 text-right text-slate-900">₹{charge.total.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-4 flex justify-between items-center pt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Gaming subtotal</span>
              <span className="text-[14px] font-black text-slate-900">₹{gamingSubtotal.toFixed(2)}</span>
            </div>
          </section>

          <div className="dotted-line" />

          {/* Cafe Items */}
          {cafeLines.length > 0 && (
            <section>
              <div className="mb-4">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-emerald-600 leading-none">Cafe Menu Items</h3>
                <p className="text-[9px] font-medium text-slate-400 mt-1">Food & beverages ordered during session</p>
              </div>

              <div className="space-y-3">
                {cafeLines.map((l, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
                        {l.label.toLowerCase().includes("coffee") || l.label.toLowerCase().includes("tea") ? "☕" : "🍱"}
                      </div>
                      <span className="text-[13px] font-bold text-slate-800">{l.label}</span>
                    </div>
                    <div className="flex items-center gap-4 text-[12px] font-bold tabular-nums">
                      <span className="text-slate-400">x{l.qty}</span>
                      <span className="w-12 text-right text-slate-900">₹{l.amount.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex justify-between items-center pt-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Cafe subtotal</span>
                <span className="text-[14px] font-black text-slate-900">₹{cafeSubtotal.toFixed(2)}</span>
              </div>
              <div className="dotted-line" />
            </section>
          )}

          {/* Bill Summary */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Bill Summary</h3>
            <div className="space-y-2 text-[13px] font-bold">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Gaming charges ({allPersons.length} persons)</span>
                <span className="text-slate-900">₹{gamingSubtotal.toFixed(2)}</span>
              </div>
              {cafeSubtotal > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Cafe items ({cafeLines.length} items)</span>
                  <span className="text-slate-900">₹{cafeSubtotal.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Grand Total Box */}
            <div className="grand-total-box mt-6 rounded-2xl bg-indigo-50/50 p-6 flex items-center justify-between border border-indigo-100">
              <div>
                <span className="text-[13px] font-black uppercase tracking-widest text-indigo-600 block leading-tight">Grand Total</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">All charges included</span>
              </div>
              <span className="text-[32px] font-black tabular-nums text-slate-900 leading-none">
                ₹{bill.total.toFixed(2)}
              </span>
            </div>
          </section>

          {/* Footer Info */}
          <div className="mt-8 flex justify-center text-[10px] font-bold text-slate-400 gap-4">
            <div className="flex items-center gap-1.5">
              <span className="opacity-50">Gaming:</span>
              <span className="text-slate-500">₹{FIRST_HOUR_RATE}/1st hr, ₹{EXTRA_HOUR_RATE}/hr after</span>
            </div>
            <div className="w-px h-3 bg-slate-200" />
            <div className="flex items-center gap-1.5">
              <span className="opacity-50">Each person:</span>
              <span className="text-slate-500">own clock</span>
            </div>
          </div>

          {/* QR Section */}
          <div className="mt-10 flex flex-col items-center">
            <div className="rounded-3xl border border-slate-100 bg-slate-50/50 p-6 flex flex-col items-center w-full">
              <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100">
                <QRCodeSVG 
                  value={qrPayload} 
                  size={100} 
                  bgColor="#ffffff" 
                  fgColor="#1e293b" 
                  level="M" 
                  includeMargin={false}
                />
              </div>
              <div className="mt-4 text-center">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  Scan to verify
                </p>
                <p className="font-mono text-[10px] font-bold text-slate-300 mt-1">
                  {bill.sessionId}
                </p>
              </div>
            </div>
          </div>

          <footer className="mt-10 text-center pb-4">
            <p className="text-[13px] font-bold text-slate-800">Thank you for visiting The PlayHouse! 👾</p>
            <p className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-widest">Come back and play again soon</p>
          </footer>
        </article>
      </main>
    </div>
  );
}


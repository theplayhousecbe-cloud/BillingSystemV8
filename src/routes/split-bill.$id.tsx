import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowLeft, Printer, User, Users, Clock, CreditCard } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { RequireAuth } from "@/components/AuthGuard";
import { sessionsApi } from "@/lib/sessions";
import { ensurePersons, chargeForPerson, fmtDuration, formatDurationMin } from "@/lib/billing";

export const Route = createFileRoute("/split-bill/$id")({
  component: () => (<RequireAuth><SplitBillPage /></RequireAuth>),
});

const CAFE_NAME = "The PlayHouse";
const CAFE_TAGLINE = "BOARD GAME CAFE";
const CAFE_ADDRESS_LINE_1 = "First Floor, Standard Towers, 288A Periyar Nagar";
const CAFE_ADDRESS_LINE_2 = "Coimbatore, Tamil Nadu 641004";

function SplitBillPage() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const session = useMemo(() => sessionsApi.list().find((s) => s.id === id), [id]);

  if (!session) {
    return (
      <div className="min-h-screen bg-background/50">
        <AppHeader />
        <main className="mx-auto max-w-md px-4 py-24 text-center">
          <div className="glass rounded-3xl p-12 shadow-2xl">
            <p className="text-lg font-medium text-muted-foreground">Bill not found.</p>
            <button onClick={() => nav({ to: "/history" })} className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2 font-semibold text-primary-foreground">
              <ArrowLeft className="h-4 w-4" /> Return to History
            </button>
          </div>
        </main>
      </div>
    );
  }

  const endedAt = session.endedAt ?? Date.now();
  const allPersons = ensurePersons(session);
  const subsequentRate = session.pricing.subsequentRate ?? 99;

  const formatTime = (date: number) => {
    return new Date(date).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    }).toUpperCase();
  };

  const formatDate = (date: number) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  // Grouping
  const fullSessionPersons = allPersons.filter(p => !p.leftAt || p.leftAt >= endedAt);
  const leftEarlyPersons = allPersons.filter(p => p.leftAt && p.leftAt < endedAt);

  const gamingTotal = allPersons.reduce((sum, p) => sum + chargeForPerson(p, endedAt, subsequentRate).total, 0);

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-20 selection:bg-indigo-100">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
        body { font-family: 'Outfit', sans-serif; }
        
        @media print {
          @page { size: auto; margin: 0; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .bill-container { box-shadow: none !important; border: none !important; width: 100% !important; max-width: none !important; margin: 0 !important; }
        }

        .bill-card {
          background: white;
          border-radius: 1.5rem;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
          overflow: hidden;
          position: relative;
        }

        .bill-header-gradient {
          height: 5px;
          background: linear-gradient(to right, #6366f1, #d946ef, #f43f5e);
          width: 100%;
        }

        .item-row {
          display: grid;
          grid-template-columns: 1fr 60px 80px 90px;
          gap: 8px;
          align-items: center;
          padding: 6px 0;
        }

        .icon-letter {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 800;
          border: 1.5px solid currentColor;
        }

        .badge-official {
          background: #eff6ff;
          color: #2563eb;
          border: 1px solid #dbeafe;
          padding: 4px 16px;
          border-radius: 99px;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
      `}</style>

      <AppHeader />

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between no-print">
          <button onClick={() => nav({ to: "/history" })} className="group flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to History
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:scale-105 active:scale-95 transition-all">
            <Printer className="h-4 w-4" /> Print Bill
          </button>
        </div>

        <div className="bill-card bill-container mx-auto max-w-[480px]">
          <div className="bill-header-gradient" />
          
          <div className="p-8 sm:p-10">
            {/* Header */}
            <header className="text-center mb-10">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/50">
                  <span className="text-xl">★</span>
                </div>
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">The PlayHouse</h1>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">BOARD GAME CAFE</p>
              
              <div className="mt-4 text-[10px] font-bold text-slate-400 space-y-0.5 max-w-[200px] mx-auto">
                <p>First Floor, Standard Towers, 288A Periyar Nagar</p>
                <p>Coimbatore, Tamil Nadu 641004</p>
              </div>

              <div className="mt-6 inline-block">
                <span className="badge-official">Official Bill / Receipt</span>
              </div>
            </header>

            {/* Bill Info */}
            <div className="space-y-2 border-t border-slate-100 pt-6 pb-6 text-[12px] font-bold">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 uppercase tracking-widest font-black text-[10px]">Bill ID</span>
                <span className="font-mono text-slate-400">{session.id.slice(-10)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 uppercase tracking-widest font-black text-[10px]">Customer</span>
                <span className="text-slate-900 uppercase font-black">{session.customerName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 uppercase tracking-widest font-black text-[10px]">Mobile</span>
                <span className="text-slate-900">{session.customerMobile || "1234567890"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 uppercase tracking-widest font-black text-[10px]">Table(s)</span>
                <span className="text-slate-900 font-black">Table {session.tableIds.join(", ") || "—"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 uppercase tracking-widest font-black text-[10px]">Persons</span>
                <span className="text-slate-900 font-black">
                  {allPersons.length} guests ({fullSessionPersons.length} full - {leftEarlyPersons.length} left early)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 uppercase tracking-widest font-black text-[10px]">Session in</span>
                <span className="text-slate-900">{formatDate(session.startedAt)}, {formatTime(session.startedAt)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 uppercase tracking-widest font-black text-[10px]">Session out</span>
                <span className="text-slate-900">{formatDate(endedAt)}, {formatTime(endedAt)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 uppercase tracking-widest font-black text-[10px]">Duration</span>
                <span className="text-blue-600 font-black">{formatDurationMin(endedAt - session.startedAt)}</span>
              </div>
            </div>

            {/* Table Header */}
            <div className="item-row mt-4 border-y border-slate-100 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <span>Item</span>
              <span className="text-center">Time</span>
              <span className="text-center">Rate</span>
              <span className="text-right">Amount</span>
            </div>

            {/* Full Session Group */}
            {fullSessionPersons.length > 0 && (
              <div className="mt-6">
                <div className="mb-4">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-indigo-600">Full Session - {fullSessionPersons.length} Persons</h3>
                  <p className="text-[9px] font-bold text-slate-400">{formatTime(session.startedAt)} - {formatTime(endedAt)}</p>
                </div>
                
                <div className="space-y-8">
                  {fullSessionPersons.map((p, idx) => (
                    <PersonBreakdown key={p.id} p={p} endedAt={endedAt} subsequentRate={subsequentRate} index={idx} customerName={session.customerName} />
                  ))}
                </div>
              </div>
            )}

            {/* Left Early Group */}
            {leftEarlyPersons.length > 0 && (
              <div className="mt-10 border-t border-slate-100 pt-8">
                <div className="mb-4">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-rose-500">Left Early - {leftEarlyPersons.length} Persons</h3>
                  <p className="text-[9px] font-bold text-slate-400">Individually billed at checkout</p>
                </div>
                
                <div className="space-y-8">
                  {leftEarlyPersons.map((p, idx) => (
                    <PersonBreakdown key={p.id} p={p} endedAt={endedAt} subsequentRate={subsequentRate} index={idx + fullSessionPersons.length} customerName={session.customerName} />
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 flex justify-between items-center border-t border-slate-100 pt-6">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Gaming subtotal</span>
              <span className="text-xl font-black text-slate-900">₹{gamingTotal.toFixed(2)}</span>
            </div>

            {/* Summary Section */}
            <div className="mt-12">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-6">Per Person Summary</h3>
              <div className="space-y-4">
                {allPersons.map((p, idx) => {
                  const charge = chargeForPerson(p, endedAt, subsequentRate);
                  const hasLeft = p.leftAt && p.leftAt < endedAt;
                  return (
                    <div key={p.id} className="flex justify-between text-[13px] font-bold items-center">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-800 min-w-[50px]">{idx === 0 ? session.customerName : p.label.length === 1 ? `Guest ${p.label}` : p.label}</span>
                        <span className="text-[11px] text-slate-400 font-medium">{formatTime(p.joinedAt)} — {formatTime(p.leftAt || endedAt)} · {fmtDuration(charge.presentMs)}</span>
                        {hasLeft && (
                          <span className="bg-rose-100 text-rose-500 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">Left early</span>
                        )}
                      </div>
                      <span className="text-slate-900 font-black text-lg">₹{charge.total.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Grand Total */}
            <div className="mt-10 rounded-2xl bg-indigo-50/50 p-8 flex justify-between items-center border border-indigo-100/50">
              <div>
                <span className="text-[13px] font-black uppercase tracking-[0.3em] text-indigo-600 block leading-tight">Grand Total</span>
              </div>
              <span className="text-[44px] font-black tabular-nums text-slate-900 leading-none">₹{gamingTotal.toFixed(2)}</span>
            </div>

            {/* Rate Footer */}
            <div className="mt-10 flex justify-center gap-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-t border-slate-50 pt-8">
              <span>1st hour: <span className="text-slate-900">₹149 flat</span></span>
              <span>2nd hr+: <span className="text-slate-900">₹99/hr pro-rated/min</span></span>
              <span>Early out: <span className="text-slate-900">own clock</span></span>
            </div>

            <footer className="mt-10 text-center pb-4">
              <p className="text-base font-black text-slate-900 tracking-tight">Thank you for visiting The PlayHouse! 👾</p>
              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-[0.3em]">Come back and play again soon</p>
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
}

function PersonBreakdown({ p, endedAt, subsequentRate, index, customerName }: { p: any, endedAt: number, subsequentRate: number, index: number, customerName: string }) {
  const charge = chargeForPerson(p, endedAt, subsequentRate);
  const colors = ["text-indigo-600", "text-purple-600", "text-emerald-600", "text-amber-600", "text-rose-600", "text-sky-600"];
  const colorClass = colors[index % colors.length];

  const formatTime = (date: number) => {
    return new Date(date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase();
  };

  const end = Math.min(p.leftAt ?? endedAt, endedAt);
  
  // Breakdown into hourly chunks
  const rows = [];
  
  const formatDur = (min: number) => {
    if (min === 60) return "1h";
    return `${min}m`;
  };

  // 1st hour
  rows.push({
    label: "1st hour",
    subLabel: index === 0 ? customerName : `Guest ${p.label}`,
    timeRange: `${formatTime(p.joinedAt)} - ${formatTime(Math.min(end, p.joinedAt + 3600000))} · 1st hour`,
    duration: formatDur(charge.firstHourMin),
    rate: `₹${p.firstHourRate}/hr`,
    amount: charge.firstHourAmt,
    icon: <div className={`icon-letter ${colorClass} bg-white shadow-sm`}>{p.label}</div>
  });

  // Extra hours
  if (charge.extraMin > 0) {
    let remainingMin = charge.extraMin;
    let hourCount = 2;
    while (remainingMin > 0) {
      const chunkMin = Math.min(60, remainingMin);
      rows.push({
        label: `${hourCount}${hourCount === 2 ? 'nd' : hourCount === 3 ? 'rd' : 'th'} hour — extended`,
        subLabel: index === 0 ? customerName : `Guest ${p.label}`,
        duration: formatDur(chunkMin),
        rate: `₹${subsequentRate}/hr`,
        amount: (chunkMin / 60) * subsequentRate,
        icon: (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 text-amber-500 border border-amber-200">
            <Clock className="h-3 w-3" />
          </div>
        )
      });
      remainingMin -= chunkMin;
      hourCount++;
    }
  }

  return (
    <div className="group">
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-4 items-start">
            <div className="mt-1">{r.icon}</div>
            <div className="flex-1">
              <div className="item-row text-[11px] font-bold">
                <div className="flex flex-col">
                  <span className="text-slate-900">{index === 0 && i === 0 ? customerName : i === 0 ? `Guest ${p.label}` : r.label}</span>
                  {i === 0 && <span className="text-[9px] text-slate-400 font-medium">{r.timeRange}</span>}
                  {i > 0 && <span className="text-[9px] text-slate-400 font-medium">{index === 0 ? customerName : `Guest ${p.label}`}</span>}
                </div>
                <span className="text-center text-slate-600">{r.duration}</span>
                <span className="text-center text-slate-400">{r.rate}</span>
                <span className="text-right text-slate-900 font-black">₹{r.amount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        ))}
        <div className="flex justify-between items-end ml-11 pt-2 border-t border-slate-50">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
            {index === 0 ? customerName : `Guest ${p.label}`} total ({fmtDuration(charge.presentMs)})
          </span>
          <span className="text-[13px] font-black text-slate-900">₹{charge.total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

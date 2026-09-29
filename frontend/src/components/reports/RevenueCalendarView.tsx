import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  IndianRupee,
  Receipt,
  CheckCircle2,
  ArrowUpRight,
  TrendingUp,
  Layers,
  Wrench,
  Clock,
  Printer,
  Sparkles,
  Info
} from 'lucide-react';
import { formatINR } from '../../lib/formatters';

export interface DayInvoice {
  id: number;
  invoice_number: string;
  job_card_id?: number;
  job_card_number?: string;
  customer_name: string;
  customer_phone?: string;
  vehicle_reg?: string;
  vehicle_model?: string;
  parts_total: number;
  labour_total: number;
  other_charges_total: number;
  discount?: number;
  tax_total?: number;
  grand_total: number;
  amount_paid: number;
  balance_due: number;
  payment_status: string;
}

export interface DayPayment {
  id: number;
  amount: number;
  method: string;
  reference?: string;
  invoice_id?: number;
  invoice_number?: string;
  is_reversal: boolean;
  time_str?: string;
}

export interface DailyBreakdownItem {
  date: string; // YYYY-MM-DD
  formatted_date: string;
  day_name: string;
  invoiced_revenue_paise: number;
  parts_paise: number;
  labour_paise: number;
  other_paise: number;
  discount_paise: number;
  tax_paise: number;
  invoice_count: number;
  collections_paise: number;
  invoices: DayInvoice[];
  payments: DayPayment[];
}

interface Props {
  dailyBreakdown: Record<string, DailyBreakdownItem>;
  onNavigateToInvoice?: (invoiceId: number) => void;
}

export const RevenueCalendarView: React.FC<Props> = ({
  dailyBreakdown = {},
  onNavigateToInvoice,
}) => {
  // Determine initial month & year based on most recent activity or current date
  const initialDate = useMemo(() => {
    const dates = Object.keys(dailyBreakdown).sort();
    if (dates.length > 0) {
      // Pick the latest active date
      const latest = dates[dates.length - 1];
      const [y, m, d] = latest.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  }, [dailyBreakdown]);

  const [currentDate, setCurrentDate] = useState<Date>(initialDate);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // Format month name (e.g. September 2026)
  const monthLabel = currentDate.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });

  // Calculate most recent date with activity in this month to default select
  const activeDatesInMonth = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return Object.keys(dailyBreakdown)
      .filter((d) => d.startsWith(prefix))
      .sort();
  }, [dailyBreakdown, year, month]);

  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const matches = Object.keys(dailyBreakdown)
      .filter((d) => d.startsWith(prefix))
      .sort();
    return matches.length > 0 ? matches[matches.length - 1] : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  });

  // Days in current month
  const totalDays = new Date(year, month + 1, 0).getDate();
  // 0 = Sun, 1 = Mon, ...
  const firstDayIndex = new Date(year, month, 1).getDay();

  // Navigation handlers
  const handlePrevMonth = () => {
    const prev = new Date(year, month - 1, 1);
    setCurrentDate(prev);
    const prefix = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    const matches = Object.keys(dailyBreakdown).filter((d) => d.startsWith(prefix)).sort();
    if (matches.length > 0) {
      setSelectedDateStr(matches[matches.length - 1]);
    } else {
      setSelectedDateStr(`${prefix}-01`);
    }
  };

  const handleNextMonth = () => {
    const next = new Date(year, month + 1, 1);
    setCurrentDate(next);
    const prefix = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    const matches = Object.keys(dailyBreakdown).filter((d) => d.startsWith(prefix)).sort();
    if (matches.length > 0) {
      setSelectedDateStr(matches[matches.length - 1]);
    } else {
      setSelectedDateStr(`${prefix}-01`);
    }
  };

  const handleJumpToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setSelectedDateStr(todayStr);
  };

  // Month-level totals
  const monthTotals = useMemo(() => {
    let invoiced = 0;
    let collections = 0;
    let invoicesCount = 0;
    let parts = 0;
    let labour = 0;

    activeDatesInMonth.forEach((dateKey) => {
      const item = dailyBreakdown[dateKey];
      if (item) {
        invoiced += item.invoiced_revenue_paise || 0;
        collections += item.collections_paise || 0;
        invoicesCount += item.invoice_count || 0;
        parts += item.parts_paise || 0;
        labour += item.labour_paise || 0;
      }
    });

    return {
      invoiced,
      collections,
      invoicesCount,
      parts,
      labour,
      activeDays: activeDatesInMonth.length,
    };
  }, [activeDatesInMonth, dailyBreakdown]);

  // Selected Day data
  const selectedDayData = dailyBreakdown[selectedDateStr];

  // Formatted date string for selected day
  const formattedSelectedDate = useMemo(() => {
    try {
      const [y, m, d] = selectedDateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return selectedDateStr;
    }
  }, [selectedDateStr]);

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-xl border border-workshop-border shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-50 text-brand rounded-lg">
              <CalendarIcon className="w-5 h-5" />
            </span>
            <h3 className="font-display font-bold text-xl md:text-2xl text-workshop-text tracking-tight">
              Chartered Accountant &amp; Daily Revenue Calendar
            </h3>
          </div>
          <p className="text-xs text-workshop-muted mt-1">
            Click on any day in the monthly calendar to inspect its sales register, cash collections, and invoice ledger.
          </p>
        </div>

        {/* Month Navigation Controls */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={handlePrevMonth}
            className="p-2 bg-gray-50 hover:bg-gray-100 border border-workshop-border rounded-lg text-workshop-text transition cursor-pointer"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <div className="font-bold text-sm font-display text-workshop-text px-3 py-1.5 bg-gray-50 border border-workshop-border rounded-lg min-w-[150px] text-center">
            {monthLabel}
          </div>

          <button
            onClick={handleNextMonth}
            className="p-2 bg-gray-50 hover:bg-gray-100 border border-workshop-border rounded-lg text-workshop-text transition cursor-pointer"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={handleJumpToToday}
            className="px-3 py-1.5 text-xs font-semibold text-brand hover:bg-blue-50 border border-brand/30 rounded-lg transition cursor-pointer ml-1"
          >
            Today
          </button>
        </div>
      </div>

      {/* Month Highlights Mini-Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white rounded-xl border border-workshop-border shadow-2xs">
          <span className="text-[11px] font-bold text-workshop-muted uppercase tracking-wider">
            Month Invoiced
          </span>
          <div className="mt-1 font-display font-bold text-xl text-brand-deep">
            {formatINR(monthTotals.invoiced)}
          </div>
          <div className="text-[10px] text-workshop-muted mt-0.5">
            {monthTotals.invoicesCount} finalized invoices
          </div>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-workshop-border shadow-2xs">
          <span className="text-[11px] font-bold text-workshop-muted uppercase tracking-wider">
            Month Collections
          </span>
          <div className="mt-1 font-display font-bold text-xl text-workshop-green">
            {formatINR(monthTotals.collections)}
          </div>
          <div className="text-[10px] text-workshop-muted mt-0.5">
            Cash &amp; digital receipts
          </div>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-workshop-border shadow-2xs">
          <span className="text-[11px] font-bold text-workshop-muted uppercase tracking-wider">
            Parts vs Labour
          </span>
          <div className="mt-1 text-xs font-mono font-bold text-workshop-text">
            P: <span className="text-sky-700">{formatINR(monthTotals.parts)}</span>
          </div>
          <div className="text-[10px] text-workshop-muted font-mono mt-0.5">
            L: <span className="text-indigo-700 font-bold">{formatINR(monthTotals.labour)}</span>
          </div>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-workshop-border shadow-2xs">
          <span className="text-[11px] font-bold text-workshop-muted uppercase tracking-wider">
            Active Billing Days
          </span>
          <div className="mt-1 font-display font-bold text-xl text-workshop-text">
            {monthTotals.activeDays} <span className="text-xs font-sans text-workshop-muted font-normal">days with activity</span>
          </div>
          <div className="text-[10px] text-workshop-muted mt-0.5">
            Out of {totalDays} calendar days
          </div>
        </div>
      </div>

      {/* Main Split: Calendar Grid on Left, Day Details on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: 7-Column Calendar Grid (7 cols on lg) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-workshop-border overflow-hidden shadow-2xs">
          
          <div className="p-3.5 border-b border-workshop-border flex items-center justify-between bg-gray-50/50">
            <span className="text-xs font-bold text-workshop-muted uppercase tracking-wider flex items-center gap-1.5">
              <CalendarIcon className="w-3.5 h-3.5 text-brand" /> {monthLabel}
            </span>
            <div className="flex items-center gap-3 text-[11px] text-workshop-muted">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" /> Invoiced
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" /> Collected
              </span>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 border-b border-workshop-border bg-[#F8FAFC] text-center text-xs font-bold text-workshop-muted py-2">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 divide-x divide-y divide-workshop-border-soft">
            {/* Blank cells for days before the 1st */}
            {Array.from({ length: firstDayIndex }).map((_, idx) => (
              <div key={`blank-${idx}`} className="h-20 sm:h-24 bg-gray-50/40 opacity-40" />
            ))}

            {/* Days of Month */}
            {Array.from({ length: totalDays }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const dayData = dailyBreakdown[dateKey];
              const isSelected = selectedDateStr === dateKey;
              const isToday = dateKey === todayStr;
              const hasInvoiced = dayData && dayData.invoiced_revenue_paise > 0;
              const hasCollections = dayData && dayData.collections_paise > 0;

              return (
                <div
                  key={dateKey}
                  onClick={() => setSelectedDateStr(dateKey)}
                  className={`h-20 sm:h-24 p-1.5 sm:p-2 transition flex flex-col justify-between cursor-pointer relative group ${
                    isSelected
                      ? 'bg-blue-50/80 ring-2 ring-brand ring-inset z-10'
                      : hasInvoiced
                      ? 'bg-white hover:bg-blue-50/30'
                      : hasCollections
                      ? 'bg-emerald-50/20 hover:bg-emerald-50/40'
                      : 'bg-white hover:bg-gray-50/80'
                  }`}
                >
                  {/* Top: Day Number & Badges */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center ${
                        isToday
                          ? 'bg-brand text-white font-bold'
                          : isSelected
                          ? 'text-brand font-bold'
                          : 'text-workshop-text'
                      }`}
                    >
                      {dayNum}
                    </span>

                    {/* Small Activity Dot */}
                    {hasInvoiced && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-blue-600"
                        title={`${dayData.invoice_count} invoice(s)`}
                      />
                    )}
                  </div>

                  {/* Middle / Bottom: Daily Revenue Pills */}
                  <div className="space-y-1">
                    {hasInvoiced && (
                      <div className="px-1.5 py-0.5 bg-blue-100/90 text-blue-900 rounded font-mono font-bold text-[10px] sm:text-[11px] truncate shadow-2xs">
                        {formatINR(dayData.invoiced_revenue_paise)}
                      </div>
                    )}

                    {hasCollections && !hasInvoiced && (
                      <div className="px-1.5 py-0.5 bg-emerald-100/90 text-emerald-900 rounded font-mono font-bold text-[10px] truncate">
                        +{formatINR(dayData.collections_paise)}
                      </div>
                    )}

                    {hasInvoiced && hasCollections && dayData.collections_paise !== dayData.invoiced_revenue_paise && (
                      <div className="text-[9px] text-workshop-muted font-mono truncate px-0.5">
                        Col: {formatINR(dayData.collections_paise)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Active Days Selector Pills */}
          {activeDatesInMonth.length > 0 && (
            <div className="p-3 border-t border-workshop-border bg-gray-50/60 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-workshop-muted pr-1">Jump to day:</span>
              {activeDatesInMonth.map((dKey) => {
                const dayNum = parseInt(dKey.split('-')[2], 10);
                const isSelected = selectedDateStr === dKey;
                return (
                  <button
                    key={dKey}
                    onClick={() => setSelectedDateStr(dKey)}
                    className={`px-2 py-0.5 rounded text-xs font-mono font-semibold transition cursor-pointer ${
                      isSelected
                        ? 'bg-brand text-white shadow-2xs'
                        : 'bg-white border border-workshop-border text-workshop-text hover:bg-gray-100'
                    }`}
                  >
                    Day {dayNum}
                  </button>
                );
              })}
            </div>
          )}

        </div>

        {/* Right Column: Day Detail & CA Audit Panel (5 cols on lg) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-workshop-border overflow-hidden shadow-2xs space-y-4">
          
          {/* Header of selected date */}
          <div className="p-4 border-b border-workshop-border bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold tracking-wider uppercase text-brand bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/60">
                CA Audit &amp; Day Reconciliation
              </span>
              <h4 className="font-display font-bold text-base md:text-lg text-workshop-text mt-1">
                {formattedSelectedDate}
              </h4>
            </div>

            <div className="font-mono text-xs font-semibold text-workshop-muted bg-white px-2.5 py-1 rounded border border-workshop-border">
              {selectedDateStr}
            </div>
          </div>

          {/* If Day has data */}
          {selectedDayData ? (
            <div className="p-4 pt-0 space-y-5">
              
              {/* Day Key Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                  <span className="text-[10px] font-bold text-brand uppercase tracking-wider">
                    Invoiced Sales
                  </span>
                  <div className="mt-1 font-mono font-bold text-lg text-brand-deep">
                    {formatINR(selectedDayData.invoiced_revenue_paise)}
                  </div>
                  <div className="text-[11px] text-workshop-muted mt-0.5">
                    {selectedDayData.invoice_count} finalized bill(s)
                  </div>
                </div>

                <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                  <span className="text-[10px] font-bold text-workshop-green uppercase tracking-wider">
                    Cash Inflow / Receipts
                  </span>
                  <div className="mt-1 font-mono font-bold text-lg text-workshop-green">
                    {formatINR(selectedDayData.collections_paise)}
                  </div>
                  <div className="text-[11px] text-workshop-muted mt-0.5">
                    {selectedDayData.payments.length} payment record(s)
                  </div>
                </div>
              </div>

              {/* Day Parts vs Labour breakdown */}
              {selectedDayData.invoiced_revenue_paise > 0 && (
                <div className="p-3 bg-gray-50 rounded-lg border border-workshop-border-soft text-xs space-y-1.5">
                  <div className="font-semibold text-workshop-text text-[11px] uppercase tracking-wider mb-1">
                    Day Revenue Composition
                  </div>
                  <div className="flex justify-between">
                    <span className="text-workshop-muted flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-sky-700" /> Parts &amp; Consumables
                    </span>
                    <span className="font-mono font-semibold text-workshop-text">
                      {formatINR(selectedDayData.parts_paise)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-workshop-muted flex items-center gap-1">
                      <Wrench className="w-3.5 h-3.5 text-indigo-700" /> Labour &amp; Services
                    </span>
                    <span className="font-mono font-semibold text-workshop-text">
                      {formatINR(selectedDayData.labour_paise)}
                    </span>
                  </div>
                  {selectedDayData.other_paise > 0 && (
                    <div className="flex justify-between">
                      <span className="text-workshop-muted">Other Charges</span>
                      <span className="font-mono font-semibold text-workshop-text">
                        {formatINR(selectedDayData.other_paise)}
                      </span>
                    </div>
                  )}
                  {selectedDayData.discount_paise > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span>Discount</span>
                      <span className="font-mono font-semibold">
                        -{formatINR(selectedDayData.discount_paise)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Invoices List on this Day */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-xs text-workshop-text uppercase tracking-wider flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-brand" />
                    Invoices Finalized ({selectedDayData.invoices.length})
                  </h5>
                </div>

                {selectedDayData.invoices.length === 0 ? (
                  <div className="text-xs text-workshop-muted py-2 bg-gray-50 p-3 rounded-lg border border-workshop-border-soft">
                    No new invoices finalized on this day. (Collections may have arrived for prior invoices).
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedDayData.invoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="p-3 bg-gray-50/80 hover:bg-blue-50/40 rounded-xl border border-workshop-border transition space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-mono font-bold text-xs text-brand-deep">
                              {inv.invoice_number}
                            </span>
                            <div className="text-xs font-semibold text-workshop-text mt-0.5">
                              {inv.customer_name}
                            </div>
                            <div className="text-[11px] text-workshop-muted font-mono">
                              {inv.vehicle_reg} &bull; {inv.vehicle_model}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="font-mono font-bold text-sm text-workshop-text">
                              {formatINR(inv.grand_total)}
                            </div>
                            <span
                              className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-semibold ${
                                inv.payment_status === 'PAID'
                                  ? 'bg-workshop-green-bg text-workshop-green'
                                  : inv.payment_status === 'PARTIALLY_PAID'
                                  ? 'bg-workshop-amber-bg text-workshop-amber'
                                  : 'bg-workshop-red-bg text-workshop-red'
                              }`}
                            >
                              {inv.payment_status}
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-workshop-border-soft flex items-center justify-between text-xs">
                          <div className="text-[11px] text-workshop-muted font-mono">
                            Paid: <span className="font-semibold text-workshop-green">{formatINR(inv.amount_paid)}</span>
                            {inv.balance_due > 0 && (
                              <span className="ml-2 text-workshop-red font-semibold">
                                Due: {formatINR(inv.balance_due)}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => onNavigateToInvoice && onNavigateToInvoice(inv.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:text-brand-deep cursor-pointer"
                          >
                            Open Invoice <ArrowUpRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment Receipts on this Day */}
              {selectedDayData.payments.length > 0 && (
                <div className="space-y-2.5 pt-2 border-t border-workshop-border-soft">
                  <h5 className="font-bold text-xs text-workshop-text uppercase tracking-wider flex items-center gap-1.5">
                    <IndianRupee className="w-3.5 h-3.5 text-workshop-green" />
                    Cash &amp; Digital Receipts on this Date ({selectedDayData.payments.length})
                  </h5>

                  <div className="space-y-1.5">
                    {selectedDayData.payments.map((p) => (
                      <div
                        key={p.id}
                        className="p-2.5 bg-gray-50 rounded-lg border border-workshop-border-soft flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-mono font-bold text-workshop-text">
                            {formatINR(p.amount)}
                          </div>
                          <div className="text-[11px] text-workshop-muted">
                            {p.method} &bull; {p.invoice_number || 'General Receipt'}
                            {p.reference && ` (${p.reference})`}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-mono text-workshop-muted">
                            {p.time_str}
                          </span>
                          {p.is_reversal && (
                            <span className="block text-[10px] text-workshop-red font-bold">
                              REVERSED
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          ) : (
            /* Empty State for Date with no activity */
            <div className="p-8 text-center space-y-3">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-workshop-muted">
                <Info className="w-6 h-6" />
              </div>
              <h5 className="font-semibold text-sm text-workshop-text">
                No Transactions Recorded
              </h5>
              <p className="text-xs text-workshop-muted max-w-xs mx-auto">
                No invoices were finalized and no payments were recorded on {formattedSelectedDate}.
              </p>
              {activeDatesInMonth.length > 0 && (
                <div className="pt-2">
                  <span className="text-xs text-workshop-muted block mb-2 font-medium">
                    Try checking one of these active days:
                  </span>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {activeDatesInMonth.map((d) => (
                      <button
                        key={d}
                        onClick={() => setSelectedDateStr(d)}
                        className="px-2.5 py-1 bg-blue-50 text-brand rounded-lg text-xs font-semibold hover:bg-brand hover:text-white transition cursor-pointer"
                      >
                        {d.split('-')[2]} {monthLabel.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

      </div>

    </div>
  );
};

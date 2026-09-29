import React, { useState, useEffect } from 'react';
import {
  Calendar,
  IndianRupee,
  Clock,
  MessageCircle,
  TrendingUp,
  Layers,
  Wrench,
  CheckCircle2,
  Search,
  Filter,
  RefreshCw,
  ArrowUpRight,
  Receipt,
  FileSpreadsheet,
  CalendarDays,
  LayoutGrid,
  ChevronDown,
  Sparkles,
  Percent,
  ShieldCheck
} from 'lucide-react';
import { apiRequest, downloadReportFile } from '../lib/api';
import { formatINR } from '../lib/formatters';
import { useAuth } from '../context/AuthContext';
import { WhatsAppPreviewModal } from '../components/common/WhatsAppPreviewModal';
import { buildPaymentReminderMessage } from '../lib/whatsapp';
import { RevenueCalendarView } from '../components/reports/RevenueCalendarView';

interface Props {
  initialTab?: 'REVENUE' | 'CALENDAR' | 'DAILY' | 'RECEIVABLES';
  onNavigate?: (page: string, id?: number) => void;
}

export const ReportsPage: React.FC<Props> = ({ initialTab = 'REVENUE', onNavigate }) => {
  const { workshop } = useAuth();
  const [activeTab, setActiveTab] = useState<'REVENUE' | 'CALENDAR' | 'DAILY' | 'RECEIVABLES'>(initialTab);
  
  // Data states
  const [revenueData, setRevenueData] = useState<any>(null);
  const [dailyData, setDailyData] = useState<any>(null);
  const [receivables, setReceivables] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // CA Export state
  const [caExportMenuOpen, setCaExportMenuOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  // Toggle calendar view within revenue tab
  const [showCalendarInRevenue, setShowCalendarInRevenue] = useState(true);

  // Filters for Revenue tab
  const [dateFilter, setDateFilter] = useState<'ALL' | 'THIS_MONTH' | 'LAST_30'>('ALL');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PARTIALLY_PAID' | 'UNPAID'>('ALL');

  const handleExportCA = async (type: 'audit-pack' | 'sales-xlsx' | 'sales-csv' | 'daybook-xlsx' | 'daybook-csv') => {
    try {
      setExporting(type);
      const now = new Date();
      const monthParam = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      let queryParam = `month=${monthParam}`;

      if (type === 'audit-pack') {
        await downloadReportFile(`/reports/export/ca-audit-pack?${queryParam}`, `CA_Audit_Pack_${monthParam}.xlsx`);
      } else if (type === 'sales-xlsx') {
        await downloadReportFile(`/reports/export/sales-register?format=xlsx&${queryParam}`, `Sales_Register_${monthParam}.xlsx`);
      } else if (type === 'sales-csv') {
        await downloadReportFile(`/reports/export/sales-register?format=csv&${queryParam}`, `Sales_Register_${monthParam}.csv`);
      } else if (type === 'daybook-xlsx') {
        await downloadReportFile(`/reports/export/day-book?format=xlsx&${queryParam}`, `Day_Book_${monthParam}.xlsx`);
      } else if (type === 'daybook-csv') {
        await downloadReportFile(`/reports/export/day-book?format=csv&${queryParam}`, `Day_Book_${monthParam}.csv`);
      }
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(null);
      setCaExportMenuOpen(false);
    }
  };

  // WhatsApp reminder state
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [selectedReceivable, setSelectedReceivable] = useState<any>(null);
  const [whatsAppMessage, setWhatsAppMessage] = useState('');

  const handleRemindWhatsApp = (r: any) => {
    setSelectedReceivable(r);
    const msg = buildPaymentReminderMessage({
      customerName: r.customer_name,
      vehicleReg: r.vehicle_reg,
      invoiceNo: r.invoice_number,
      balanceDuePaise: r.balance_due,
      daysOverdue: r.days_overdue,
      workshop
    });
    setWhatsAppMessage(msg);
    setShowWhatsAppModal(true);
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      
      let revUrl = '/reports/revenue-overview';
      if (dateFilter === 'THIS_MONTH') {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        revUrl += `?start_date=${start}`;
      } else if (dateFilter === 'LAST_30') {
        const past = new Date();
        past.setDate(past.getDate() - 30);
        const start = past.toISOString().split('T')[0];
        revUrl += `?start_date=${start}`;
      }

      const [rRev, dRes, rRes] = await Promise.all([
        apiRequest(revUrl),
        apiRequest('/reports/daily-summary'),
        apiRequest('/reports/outstanding-receivables'),
      ]);
      setRevenueData(rRev);
      setDailyData(dRes);
      setReceivables(rRes);
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [dateFilter]);

  // Sync tab if prop changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Filtered invoices in revenue tab
  const filteredRevenueInvoices = (revenueData?.invoices || []).filter((inv: any) => {
    const matchesSearch =
      !invoiceSearch ||
      inv.invoice_number?.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
      inv.customer_name?.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
      inv.vehicle_reg?.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
      inv.vehicle_model?.toLowerCase().includes(invoiceSearch.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' || inv.payment_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl md:text-3xl text-workshop-text tracking-tight">
            Financial &amp; Workshop Reports
          </h2>
          <p className="text-sm text-workshop-muted">
            All-time revenue breakdown, daily accounting calendar, parts &amp; labour distribution, and aged receivables.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {/* Export for CA Button with Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setCaExportMenuOpen(!caExportMenuOpen)}
              disabled={exporting !== null}
              className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs transition cursor-pointer"
              title="Export formatted reports for Tally Prime, Zoho Books, Marg ERP, or MS Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{exporting ? 'Generating...' : 'Export for CA (.xlsx / .csv)'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${caExportMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {caExportMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-workshop-border py-2 z-50 animate-in fade-in slide-in-from-top-1">
                <div className="px-3 py-1.5 border-b border-workshop-border-soft">
                  <div className="text-[11px] font-bold text-workshop-muted uppercase tracking-wider">
                    CA Tax &amp; Audit Exports
                  </div>
                  <div className="text-[10px] text-workshop-muted">
                    Compatible with Tally Prime, Zoho Books, Marg ERP &amp; Excel
                  </div>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => handleExportCA('audit-pack')}
                    className="w-full text-left px-3 py-2 hover:bg-emerald-50/60 flex items-center justify-between text-xs transition cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-workshop-text flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        Complete CA Audit Pack
                      </div>
                      <div className="text-[10px] text-workshop-muted">Multi-sheet .xlsx (Sales, Collections, GST, Margins)</div>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">.XLSX</span>
                  </button>

                  <div className="h-px bg-workshop-border-soft my-1" />

                  <button
                    onClick={() => handleExportCA('sales-xlsx')}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50/60 flex items-center justify-between text-xs transition cursor-pointer"
                  >
                    <div>
                      <div className="font-semibold text-workshop-text">Sales Register (Excel)</div>
                      <div className="text-[10px] text-workshop-muted">Invoices with GSTIN, HSN/SAC &amp; Tax split</div>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">.XLSX</span>
                  </button>

                  <button
                    onClick={() => handleExportCA('sales-csv')}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center justify-between text-xs transition cursor-pointer"
                  >
                    <div>
                      <div className="font-semibold text-workshop-text">Sales Register (CSV)</div>
                      <div className="text-[10px] text-workshop-muted">For Tally / Marg / Zoho Books direct import</div>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">.CSV</span>
                  </button>

                  <div className="h-px bg-workshop-border-soft my-1" />

                  <button
                    onClick={() => handleExportCA('daybook-xlsx')}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50/60 flex items-center justify-between text-xs transition cursor-pointer"
                  >
                    <div>
                      <div className="font-semibold text-workshop-text">Day Book (Excel)</div>
                      <div className="text-[10px] text-workshop-muted">Daily cash inflow &amp; payment receipts ledger</div>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">.XLSX</span>
                  </button>

                  <button
                    onClick={() => handleExportCA('daybook-csv')}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center justify-between text-xs transition cursor-pointer"
                  >
                    <div>
                      <div className="font-semibold text-workshop-text">Day Book (CSV)</div>
                      <div className="text-[10px] text-workshop-muted">Standard daily receipts journal</div>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">.CSV</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={fetchReports}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-gray-50 border border-workshop-border rounded-lg text-xs font-semibold text-workshop-text shadow-2xs transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand' : 'text-workshop-muted'}`} />
            Refresh Data
          </button>
        </div>
      </div>

      {/* 4 Main Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-workshop-border pb-3">
        <button
          onClick={() => setActiveTab('REVENUE')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
            activeTab === 'REVENUE'
              ? 'bg-brand text-white shadow-xs'
              : 'bg-white text-workshop-muted hover:bg-gray-100 hover:text-workshop-text'
          }`}
        >
          <TrendingUp className="w-4 h-4" /> Total Revenue &amp; Breakdown
        </button>
        <button
          onClick={() => setActiveTab('CALENDAR')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
            activeTab === 'CALENDAR'
              ? 'bg-brand text-white shadow-xs'
              : 'bg-white text-workshop-muted hover:bg-gray-100 hover:text-workshop-text'
          }`}
        >
          <CalendarDays className="w-4 h-4" /> Revenue Calendar (CA Audit)
        </button>
        <button
          onClick={() => setActiveTab('DAILY')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
            activeTab === 'DAILY'
              ? 'bg-brand text-white shadow-xs'
              : 'bg-white text-workshop-muted hover:bg-gray-100 hover:text-workshop-text'
          }`}
        >
          <Calendar className="w-4 h-4" /> Daily Workshop Summary
        </button>
        <button
          onClick={() => setActiveTab('RECEIVABLES')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
            activeTab === 'RECEIVABLES'
              ? 'bg-brand text-white shadow-xs'
              : 'bg-white text-workshop-muted hover:bg-gray-100 hover:text-workshop-text'
          }`}
        >
          <Clock className="w-4 h-4" /> Outstanding Receivables ({receivables?.invoices?.length || 0})
        </button>
      </div>

      {loading && !revenueData ? (
        <div className="py-16 text-center text-sm text-workshop-muted animate-pulse">
          Loading report data...
        </div>
      ) : activeTab === 'REVENUE' && revenueData ? (
        <div className="space-y-6">
          
          {/* Controls Bar: Periods + Calendar Quick Button */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-workshop-border shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-workshop-muted uppercase tracking-wider pl-1">
                Period:
              </span>
              <div className="flex gap-1.5 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setDateFilter('ALL')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                    dateFilter === 'ALL'
                      ? 'bg-white text-brand shadow-2xs'
                      : 'text-workshop-muted hover:text-workshop-text'
                  }`}
                >
                  All-Time Total
                </button>
                <button
                  onClick={() => setDateFilter('THIS_MONTH')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                    dateFilter === 'THIS_MONTH'
                      ? 'bg-white text-brand shadow-2xs'
                      : 'text-workshop-muted hover:text-workshop-text'
                  }`}
                >
                  This Month
                </button>
                <button
                  onClick={() => setDateFilter('LAST_30')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                    dateFilter === 'LAST_30'
                      ? 'bg-white text-brand shadow-2xs'
                      : 'text-workshop-muted hover:text-workshop-text'
                  }`}
                >
                  Last 30 Days
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCalendarInRevenue(!showCalendarInRevenue)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  showCalendarInRevenue
                    ? 'bg-blue-50 text-brand border-brand/40 shadow-2xs'
                    : 'bg-white text-workshop-text border-workshop-border hover:bg-gray-50'
                }`}
                title="Toggle Monthly Calendar View in this section"
              >
                <CalendarDays className="w-3.5 h-3.5" />
                {showCalendarInRevenue ? 'Calendar View Active' : 'Show Calendar View'}
              </button>

              <div className="text-xs text-workshop-muted hidden sm:block">
                <span className="font-semibold text-workshop-text">{revenueData.summary.finalized_count} finalized invoices</span>
              </div>
            </div>
          </div>

          {/* 4 Main Revenue KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* 1. Total Invoiced Revenue */}
            <div className="p-5 bg-white rounded-xl border border-workshop-border shadow-2xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-workshop-muted uppercase tracking-wider">Total Revenue</span>
                <span className="p-1.5 bg-blue-50 text-brand rounded-lg"><TrendingUp className="w-4 h-4" /></span>
              </div>
              <div className="mt-3 font-display font-bold text-2xl md:text-3xl text-workshop-text tracking-tight">
                {formatINR(revenueData.summary.total_revenue_paise)}
              </div>
              <div className="mt-2 text-xs text-workshop-muted flex items-center justify-between">
                <span>Avg ticket: <strong className="text-workshop-text font-mono">{formatINR(revenueData.summary.average_ticket_paise)}</strong></span>
                <span className="text-[11px] bg-blue-50 text-brand font-semibold px-2 py-0.5 rounded">Net Accrual</span>
              </div>
            </div>

            {/* 2. Parts Revenue */}
            <div className="p-5 bg-white rounded-xl border border-workshop-border shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-workshop-muted uppercase tracking-wider">Parts Revenue</span>
                <span className="p-1.5 bg-sky-50 text-sky-700 rounded-lg"><Layers className="w-4 h-4" /></span>
              </div>
              <div className="mt-3 font-display font-bold text-2xl md:text-3xl text-sky-800 tracking-tight">
                {formatINR(revenueData.summary.parts_total_paise)}
              </div>
              <div className="mt-2 text-xs text-workshop-muted flex items-center justify-between">
                <span>Share: <strong className="text-sky-700">{revenueData.breakdown.parts_percent}%</strong></span>
                <span className="text-[11px] text-workshop-muted">Components &amp; consumables</span>
              </div>
            </div>

            {/* 3. Labour Revenue */}
            <div className="p-5 bg-white rounded-xl border border-workshop-border shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-workshop-muted uppercase tracking-wider">Labour Revenue</span>
                <span className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg"><Wrench className="w-4 h-4" /></span>
              </div>
              <div className="mt-3 font-display font-bold text-2xl md:text-3xl text-indigo-800 tracking-tight">
                {formatINR(revenueData.summary.labour_total_paise)}
              </div>
              <div className="mt-2 text-xs text-workshop-muted flex items-center justify-between">
                <span>Share: <strong className="text-indigo-700">{revenueData.breakdown.labour_percent}%</strong></span>
                <span className="text-[11px] text-workshop-muted">Service &amp; repair charges</span>
              </div>
            </div>

            {/* 4. Cash Inflow & Receivables */}
            <div className="p-5 bg-white rounded-xl border border-workshop-border shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-workshop-muted uppercase tracking-wider">Collections &amp; Due</span>
                <span className="p-1.5 bg-green-50 text-green-700 rounded-lg"><IndianRupee className="w-4 h-4" /></span>
              </div>
              <div className="mt-3 font-display font-bold text-2xl md:text-3xl text-workshop-green tracking-tight">
                {formatINR(revenueData.summary.total_collected_paise)}
              </div>
              <div className="mt-2 text-xs flex items-center justify-between">
                <span className="text-workshop-muted">
                  Due: <strong className="text-workshop-red font-mono">{formatINR(revenueData.summary.total_outstanding_paise)}</strong>
                </span>
                <span className="text-[11px] font-semibold text-workshop-green bg-workshop-green-bg px-2 py-0.5 rounded">
                  {revenueData.summary.collection_rate_percent}% Collected
                </span>
              </div>
            </div>

          </div>

          {/* CA Enhancements: Gross Profit & Margins + GST Engine Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* 1. Gross Profit & Margin Card */}
            <div className="p-5 bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/30 rounded-xl border border-emerald-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Gross Margin &amp; Profitability Tracking
                </span>
                <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {(revenueData.summary.gross_margin_percent || 0).toFixed(1)}% Gross Margin
                </span>
              </div>

              <div className="pt-1">
                <div className="font-display font-bold text-2xl md:text-3xl text-emerald-800 tracking-tight">
                  {formatINR(revenueData.summary.gross_profit_paise || 0)}
                </div>
                <p className="text-[11px] text-emerald-900/80 font-medium mt-0.5">
                  Net Profit (Taxable Invoiced Sales &minus; Wholesale Cost &minus; Technician Labor)
                </p>
              </div>

              <div className="pt-2 border-t border-emerald-100 grid grid-cols-3 gap-2 text-xs">
                <div className="p-2 bg-white/80 rounded-lg border border-emerald-100/80">
                  <span className="text-[10px] text-workshop-muted uppercase block font-semibold">Total Cost</span>
                  <span className="font-mono font-bold text-workshop-text">{formatINR(revenueData.summary.total_cost_paise || 0)}</span>
                </div>
                <div className="p-2 bg-white/80 rounded-lg border border-emerald-100/80">
                  <span className="text-[10px] text-workshop-muted uppercase block font-semibold">Parts Cost</span>
                  <span className="font-mono font-bold text-sky-700">{formatINR(revenueData.summary.profit_summary?.parts_cost_paise || 0)}</span>
                </div>
                <div className="p-2 bg-white/80 rounded-lg border border-emerald-100/80">
                  <span className="text-[10px] text-workshop-muted uppercase block font-semibold">Labour Cost</span>
                  <span className="font-mono font-bold text-indigo-700">{formatINR(revenueData.summary.profit_summary?.labour_cost_paise || 0)}</span>
                </div>
              </div>
            </div>

            {/* 2. Comprehensive GST Engine Card */}
            <div className="p-5 bg-gradient-to-br from-purple-50/70 via-white to-purple-50/30 rounded-xl border border-purple-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                  Comprehensive GST Register (CGST, SGST, IGST)
                </span>
                <span className="text-xs font-bold bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full border border-purple-200">
                  GSTR-1 Ready
                </span>
              </div>

              <div className="pt-1">
                <div className="font-display font-bold text-2xl md:text-3xl text-purple-800 tracking-tight">
                  {formatINR(revenueData.summary.gst_summary?.total_gst_paise || revenueData.summary.tax_total_paise || 0)}
                </div>
                <p className="text-[11px] text-purple-900/80 font-medium mt-0.5">
                  Total GST Collected across {revenueData.summary.finalized_count} invoices (Taxable: {formatINR(revenueData.summary.gst_summary?.taxable_amount_paise || revenueData.summary.taxable_amount_paise || 0)})
                </p>
              </div>

              <div className="pt-2 border-t border-purple-100 grid grid-cols-3 gap-2 text-xs">
                <div className="p-2 bg-white/80 rounded-lg border border-purple-100/80">
                  <span className="text-[10px] text-workshop-muted uppercase block font-semibold">Intra-State CGST</span>
                  <span className="font-mono font-bold text-purple-800">{formatINR(revenueData.summary.gst_summary?.cgst_paise || 0)}</span>
                </div>
                <div className="p-2 bg-white/80 rounded-lg border border-purple-100/80">
                  <span className="text-[10px] text-workshop-muted uppercase block font-semibold">Intra-State SGST</span>
                  <span className="font-mono font-bold text-purple-800">{formatINR(revenueData.summary.gst_summary?.sgst_paise || 0)}</span>
                </div>
                <div className="p-2 bg-white/80 rounded-lg border border-purple-100/80">
                  <span className="text-[10px] text-workshop-muted uppercase block font-semibold">Inter-State IGST</span>
                  <span className="font-mono font-bold text-purple-800">{formatINR(revenueData.summary.gst_summary?.igst_paise || 0)}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Revenue Distribution Progress Bar */}
          <div className="p-5 bg-white rounded-xl border border-workshop-border shadow-2xs space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-workshop-muted">
              <span>REVENUE COMPOSITION BREAKDOWN</span>
              <div className="flex items-center gap-4 text-xs font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-sky-600 inline-block" />
                  Parts: {revenueData.breakdown.parts_percent}%
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block" />
                  Labour: {revenueData.breakdown.labour_percent}%
                </span>
                {revenueData.breakdown.other_percent > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                    Other: {revenueData.breakdown.other_percent}%
                  </span>
                )}
              </div>
            </div>

            {/* Proportional Stacked Bar */}
            <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${revenueData.breakdown.parts_percent}%` }}
                className="bg-sky-600 h-full transition-all"
                title={`Parts: ${formatINR(revenueData.summary.parts_total_paise)} (${revenueData.breakdown.parts_percent}%)`}
              />
              <div
                style={{ width: `${revenueData.breakdown.labour_percent}%` }}
                className="bg-indigo-600 h-full transition-all"
                title={`Labour: ${formatINR(revenueData.summary.labour_total_paise)} (${revenueData.breakdown.labour_percent}%)`}
              />
              <div
                style={{ width: `${revenueData.breakdown.other_percent}%` }}
                className="bg-amber-500 h-full transition-all"
                title={`Other: ${formatINR(revenueData.summary.other_charges_total_paise)} (${revenueData.breakdown.other_percent}%)`}
              />
            </div>
          </div>

          {/* Interactive Revenue Calendar & CA Audit Section (Enabled by Default or Toggle) */}
          {showCalendarInRevenue && revenueData.daily_breakdown && (
            <div className="pt-2">
              <RevenueCalendarView
                dailyBreakdown={revenueData.daily_breakdown}
                onNavigateToInvoice={(id) => onNavigate && onNavigate('invoices', id)}
              />
            </div>
          )}

          {/* Detailed Breakdown: 2 Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Card A: Financial Ledger Summary */}
            <div className="p-5 bg-white rounded-xl border border-workshop-border shadow-2xs space-y-4">
              <h3 className="font-bold text-sm text-workshop-text flex items-center gap-2">
                <Receipt className="w-4 h-4 text-brand" /> Revenue Stream Line Items
              </h3>
              
              <div className="space-y-2.5 divide-y divide-workshop-border-soft text-sm">
                <div className="flex justify-between pt-1">
                  <span className="text-workshop-muted">Parts &amp; Consumables Total</span>
                  <span className="font-mono font-semibold text-workshop-text">
                    {formatINR(revenueData.summary.parts_total_paise)}
                  </span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-workshop-muted">Labour &amp; Service Charges</span>
                  <span className="font-mono font-semibold text-workshop-text">
                    {formatINR(revenueData.summary.labour_total_paise)}
                  </span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-workshop-muted">Other Charges (Towing, Sanitization, etc.)</span>
                  <span className="font-mono font-semibold text-workshop-text">
                    {formatINR(revenueData.summary.other_charges_total_paise)}
                  </span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-workshop-muted">Discounts Given</span>
                  <span className="font-mono font-semibold text-workshop-amber">
                    -{formatINR(revenueData.summary.discount_total_paise)}
                  </span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-workshop-muted">Tax (GST) Collected</span>
                  <span className="font-mono font-semibold text-workshop-text">
                    {formatINR(revenueData.summary.tax_total_paise)}
                  </span>
                </div>
                <div className="flex justify-between pt-3 font-bold text-base text-workshop-text border-t-2 border-workshop-border">
                  <span>Grand Total Revenue</span>
                  <span className="font-mono text-brand-deep">
                    {formatINR(revenueData.summary.total_revenue_paise)}
                  </span>
                </div>
              </div>
            </div>

            {/* Card B: Collections by Payment Method & Invoices Status */}
            <div className="p-5 bg-white rounded-xl border border-workshop-border shadow-2xs space-y-4">
              <h3 className="font-bold text-sm text-workshop-text flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-workshop-green" /> Payment Collections by Method
              </h3>

              <div className="grid grid-cols-2 gap-3">
                {Object.entries(revenueData.payments_by_method).map(([method, amount]: [string, any]) => (
                  <div key={method} className="p-3 bg-gray-50 rounded-lg border border-workshop-border-soft">
                    <span className="text-xs font-semibold text-workshop-muted">{method}</span>
                    <div className="font-mono font-bold text-base text-workshop-text mt-1">{formatINR(amount)}</div>
                  </div>
                ))}
                {Object.keys(revenueData.payments_by_method).length === 0 && (
                  <div className="col-span-full text-xs text-workshop-muted py-2">No payments recorded yet.</div>
                )}
              </div>

              {/* Settlement Status Badges */}
              <div className="pt-2 border-t border-workshop-border-soft">
                <span className="text-xs font-semibold text-workshop-muted uppercase tracking-wider block mb-2">
                  Invoice Settlement Breakdown
                </span>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-3 py-1.5 rounded-lg bg-green-50 text-green-800 font-semibold border border-green-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Fully Paid: {revenueData.summary.paid_count}
                  </span>
                  <span className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 font-semibold border border-amber-200">
                    Partially Paid: {revenueData.summary.partially_paid_count}
                  </span>
                  <span className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 font-semibold border border-gray-200">
                    Unpaid: {revenueData.summary.unpaid_count}
                  </span>
                </div>
              </div>

            </div>

          </div>

          {/* Monthly Trend Table */}
          {revenueData.monthly_trend && revenueData.monthly_trend.length > 0 && (
            <div className="bg-white rounded-xl border border-workshop-border overflow-hidden shadow-2xs">
              <div className="p-4 border-b border-workshop-border">
                <h3 className="font-bold text-sm text-workshop-text">Monthly Financial &amp; CA Breakdown</h3>
                <p className="text-xs text-workshop-muted">Aggregated performance, GST liability, and gross margins by calendar month.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#F8FAFC] border-b border-workshop-border text-xs uppercase text-workshop-muted font-semibold">
                    <tr>
                      <th className="px-4 py-3">Month</th>
                      <th className="px-4 py-3 text-center">Invoices</th>
                      <th className="px-4 py-3 text-right">Parts</th>
                      <th className="px-4 py-3 text-right">Labour</th>
                      <th className="px-4 py-3 text-right">GST Total</th>
                      <th className="px-4 py-3 text-right font-bold text-workshop-text">Total Revenue</th>
                      <th className="px-4 py-3 text-right text-emerald-700">Gross Profit</th>
                      <th className="px-4 py-3 text-right text-workshop-green">Collected</th>
                      <th className="px-4 py-3 text-right text-workshop-red">Balance Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-workshop-border-soft">
                    {revenueData.monthly_trend.map((m: any) => (
                      <tr key={m.month_key} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-semibold text-workshop-text">{m.month_label}</td>
                        <td className="px-4 py-3 text-center font-mono text-xs">{m.invoice_count}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-workshop-muted">{formatINR(m.parts_paise)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-workshop-muted">{formatINR(m.labour_paise)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-purple-700 font-semibold">{formatINR((m.cgst_paise || 0) + (m.sgst_paise || 0) + (m.igst_paise || 0))}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-sm text-brand-deep">{formatINR(m.revenue_paise)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-emerald-700">
                          {formatINR(m.profit_paise || 0)}
                          <span className="text-[10px] text-emerald-800/80 block font-normal">
                            ({(m.margin_percent || 0).toFixed(1)}%)
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-workshop-green">{formatINR(m.collected_paise)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-workshop-red">{formatINR(m.outstanding_paise)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Itemized Finalized Invoices Breakdown Table */}
          <div className="bg-white rounded-xl border border-workshop-border overflow-hidden shadow-2xs space-y-4">
            <div className="p-4 border-b border-workshop-border flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-workshop-text">Finalized Invoices Breakdown</h3>
                <p className="text-xs text-workshop-muted">Every invoice contributing to the total revenue figure with GST and margins.</p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-workshop-muted" />
                  <input
                    type="text"
                    placeholder="Search invoice, customer, reg..."
                    value={invoiceSearch}
                    onChange={(e) => setInvoiceSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-gray-50 border border-workshop-border rounded-lg text-xs w-48 lg:w-56 focus:outline-brand focus:bg-white"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-gray-50 border border-workshop-border rounded-lg text-xs font-medium text-workshop-text focus:outline-brand"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PAID">Paid Only</option>
                  <option value="PARTIALLY_PAID">Partially Paid</option>
                  <option value="UNPAID">Unpaid</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F8FAFC] border-b border-workshop-border text-xs uppercase text-workshop-muted font-semibold">
                  <tr>
                    <th className="px-4 py-3">Invoice #</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Vehicle</th>
                    <th className="px-4 py-3 text-right">Parts</th>
                    <th className="px-4 py-3 text-right">Labour</th>
                    <th className="px-4 py-3 text-right">GST</th>
                    <th className="px-4 py-3 text-right font-bold">Grand Total</th>
                    <th className="px-4 py-3 text-right text-emerald-700">Gross Profit</th>
                    <th className="px-4 py-3 text-right text-workshop-green">Paid</th>
                    <th className="px-4 py-3 text-right text-workshop-red">Due</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-workshop-border-soft">
                  {filteredRevenueInvoices.map((inv: any) => (
                    <tr
                      key={inv.id}
                      className="hover:bg-blue-50/20 transition cursor-pointer"
                      onClick={() => onNavigate && onNavigate('invoices', inv.id)}
                    >
                      <td className="px-4 py-3 font-mono font-bold text-brand-deep text-xs">
                        {inv.invoice_number}
                      </td>
                      <td className="px-4 py-3 text-xs text-workshop-muted font-mono">
                        {inv.finalized_at}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-xs text-workshop-text">{inv.customer_name}</div>
                        <div className="text-[11px] text-workshop-muted font-mono">{inv.customer_phone}</div>
                        {inv.customer_gstin && (
                          <div className="mt-0.5">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-purple-50 border border-purple-200 text-purple-800 font-mono text-[10px] font-bold">
                              GSTIN: {inv.customer_gstin}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs font-semibold">{inv.vehicle_reg}</div>
                        <div className="text-[11px] text-workshop-muted truncate max-w-[120px]">{inv.vehicle_model}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-workshop-muted">
                        {formatINR(inv.parts_total)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-workshop-muted">
                        {formatINR(inv.labour_total)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-purple-700 font-medium">
                        {formatINR(inv.tax_total || 0)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-xs text-brand-deep">
                        {formatINR(inv.grand_total)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-emerald-700">
                        {inv.gross_profit !== undefined && inv.gross_profit !== null ? (
                          <div>
                            {formatINR(inv.gross_profit)}
                            <span className="text-[10px] text-emerald-800/80 block font-normal">
                              ({(inv.margin_percent || 0).toFixed(1)}%)
                            </span>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-workshop-green">
                        {formatINR(inv.amount_paid)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-workshop-red">
                        {formatINR(inv.balance_due)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            inv.payment_status === 'PAID'
                              ? 'bg-workshop-green-bg text-workshop-green'
                              : inv.payment_status === 'PARTIALLY_PAID'
                              ? 'bg-workshop-amber-bg text-workshop-amber'
                              : 'bg-workshop-red-bg text-workshop-red'
                          }`}
                        >
                          {inv.payment_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onNavigate) onNavigate('invoices', inv.id);
                          }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-deep cursor-pointer"
                        >
                          View <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredRevenueInvoices.length === 0 && (
                    <tr>
                      <td colSpan={13} className="px-4 py-8 text-center text-xs text-workshop-muted">
                        No invoices found matching criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      ) : activeTab === 'CALENDAR' ? (
        /* Standalone Dedicated Calendar View */
        <div className="space-y-6">
          {revenueData && revenueData.daily_breakdown ? (
            <RevenueCalendarView
              dailyBreakdown={revenueData.daily_breakdown}
              onNavigateToInvoice={(id) => onNavigate && onNavigate('invoices', id)}
            />
          ) : (
            <div className="py-16 text-center text-sm text-workshop-muted animate-pulse">
              Loading calendar financial data...
            </div>
          )}
        </div>
      ) : activeTab === 'DAILY' && dailyData ? (
        /* Daily Workshop Summary Tab */
        <div className="space-y-6">
          {/* Summary Metric Tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white rounded-xl border border-workshop-border shadow-2xs">
              <span className="text-xs font-bold text-workshop-muted uppercase">Jobs Opened</span>
              <div className="mt-2 font-display font-bold text-3xl text-workshop-text">{dailyData.jobs_opened}</div>
            </div>
            <div className="p-4 bg-white rounded-xl border border-workshop-border shadow-2xs">
              <span className="text-xs font-bold text-workshop-muted uppercase">Jobs Delivered</span>
              <div className="mt-2 font-display font-bold text-3xl text-workshop-green">{dailyData.jobs_completed}</div>
            </div>
            <div className="p-4 bg-white rounded-xl border border-workshop-border shadow-2xs">
              <span className="text-xs font-bold text-workshop-muted uppercase">Invoiced Value</span>
              <div className="mt-2 font-display font-bold text-2xl text-brand-deep">{formatINR(dailyData.invoiced_value_paise)}</div>
            </div>
            <div className="p-4 bg-white rounded-xl border border-workshop-border shadow-2xs">
              <span className="text-xs font-bold text-workshop-muted uppercase">Payments Received</span>
              <div className="mt-2 font-display font-bold text-2xl text-workshop-green">{formatINR(dailyData.payments_total_paise)}</div>
            </div>
          </div>

          {/* Breakdown by Payment Method */}
          <div className="bg-white p-5 rounded-xl border border-workshop-border shadow-2xs">
            <h3 className="font-bold text-sm text-workshop-text mb-3">Today's Collections by Payment Method</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(dailyData.payments_by_method).map(([method, amount]: [string, any]) => (
                <div key={method} className="p-3 bg-gray-50 rounded-lg border border-workshop-border-soft">
                  <span className="text-xs font-semibold text-workshop-muted">{method}</span>
                  <div className="font-mono font-bold text-base text-workshop-text mt-1">{formatINR(amount)}</div>
                </div>
              ))}
              {Object.keys(dailyData.payments_by_method).length === 0 && (
                <div className="col-span-full text-xs text-workshop-muted py-3">No payments recorded today yet.</div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Receivables Tab */
        <div className="bg-white rounded-xl border border-workshop-border overflow-hidden shadow-2xs space-y-4">
          <div className="p-4 border-b border-workshop-border flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-workshop-text">Aged Accounts Receivable</h3>
              <p className="text-xs text-workshop-muted">Invoices finalized with pending customer balances.</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-workshop-muted">Total Outstanding:</span>
              <div className="font-mono font-bold text-lg text-workshop-red">
                {formatINR(receivables?.total_outstanding_paise)}
              </div>
            </div>
          </div>

          <table className="w-full text-left text-sm">
            <thead className="bg-[#F8FAFC] border-b border-workshop-border text-xs uppercase text-workshop-muted">
              <tr>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer &amp; Phone</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3 text-right">Invoice Total</th>
                <th className="px-4 py-3 text-right">Balance Due</th>
                <th className="px-4 py-3 text-center">Days Overdue</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-workshop-border-soft">
              {receivables?.invoices?.map((r: any) => (
                <tr key={r.invoice_id} className="hover:bg-red-50/20">
                  <td className="px-4 py-3 font-mono font-bold text-brand-deep">{r.invoice_number}</td>
                  <td className="px-4 py-3 text-xs text-workshop-muted font-mono">{r.finalized_at}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-xs text-workshop-text">{r.customer_name}</div>
                    <div className="text-xs text-workshop-muted font-mono">{r.customer_phone}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{r.vehicle_reg}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{formatINR(r.grand_total)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-xs text-workshop-red">{formatINR(r.balance_due)}</td>
                  <td className="px-4 py-3 text-center font-mono text-xs">
                    <span className={`px-2 py-0.5 rounded ${r.days_overdue > 7 ? 'bg-red-100 text-red-800 font-bold' : 'bg-gray-100 text-gray-700'}`}>
                      {r.days_overdue} days
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemindWhatsApp(r)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] hover:bg-[#1DA851] text-white font-bold text-xs rounded-lg transition shadow-2xs cursor-pointer active:scale-98"
                      title="Send 1-Click WhatsApp Payment Reminder"
                    >
                      <MessageCircle className="w-3.5 h-3.5 fill-white" /> Remind
                    </button>
                  </td>
                </tr>
              ))}
              {(!receivables?.invoices || receivables.invoices.length === 0) && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-xs text-workshop-muted">No outstanding receivables. All bills are fully settled!</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* WhatsApp Payment Reminder Modal */}
      {selectedReceivable && (
        <WhatsAppPreviewModal
          isOpen={showWhatsAppModal}
          onClose={() => setShowWhatsAppModal(false)}
          title="Send Payment Reminder on WhatsApp"
          customerName={selectedReceivable.customer_name}
          customerPhone={selectedReceivable.customer_phone}
          initialMessage={whatsAppMessage}
        />
      )}

    </div>
  );
};

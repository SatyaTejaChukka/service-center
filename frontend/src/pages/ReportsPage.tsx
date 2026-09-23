import React, { useState, useEffect } from 'react';
import { BarChart3, Calendar, IndianRupee, Clock, AlertTriangle } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { formatINR } from '../lib/formatters';

export const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'DAILY' | 'RECEIVABLES'>('DAILY');
  const [dailyData, setDailyData] = useState<any>(null);
  const [receivables, setReceivables] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const [dRes, rRes] = await Promise.all([
        apiRequest('/reports/daily-summary'),
        apiRequest('/reports/outstanding-receivables'),
      ]);
      setDailyData(dRes);
      setReceivables(rRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      
      <div>
        <h2 className="font-display font-bold text-2xl md:text-3xl text-workshop-text tracking-tight">
          Reports &amp; Operational Insights
        </h2>
        <p className="text-sm text-workshop-muted">
          Daily business summaries, cash flow breakdown, and aged customer receivables.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-workshop-border pb-3">
        <button
          onClick={() => setActiveTab('DAILY')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
            activeTab === 'DAILY' ? 'bg-brand text-white shadow-xs' : 'bg-white text-workshop-muted hover:bg-gray-100'
          }`}
        >
          <Calendar className="w-4 h-4" /> Daily Workshop Summary
        </button>
        <button
          onClick={() => setActiveTab('RECEIVABLES')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
            activeTab === 'RECEIVABLES' ? 'bg-brand text-white shadow-xs' : 'bg-white text-workshop-muted hover:bg-gray-100'
          }`}
        >
          <Clock className="w-4 h-4" /> Outstanding Receivables ({receivables?.invoices?.length || 0})
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-workshop-muted animate-pulse">Loading reports...</div>
      ) : activeTab === 'DAILY' && dailyData ? (
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
                </tr>
              ))}
              {(!receivables?.invoices || receivables.invoices.length === 0) && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-workshop-muted">No outstanding receivables. All bills are fully settled!</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
};

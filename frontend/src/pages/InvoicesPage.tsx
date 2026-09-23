import React, { useState, useEffect } from 'react';
import { Search, Filter, Receipt, ArrowRight, Printer, CheckCircle2 } from 'lucide-react';
import { apiRequest, getPdfUrl } from '../lib/api';
import { formatINR } from '../lib/formatters';
import { InvoiceDetailModal } from '../components/invoice/InvoiceDetailModal';

interface InvoiceListItem {
  id: number;
  invoice_number: string | null;
  job_card_id: number;
  job_card_number: string;
  customer_name: string;
  customer_phone: string;
  vehicle_reg: string;
  status: string;
  grand_total: number;
  amount_paid: number;
  balance_due: number;
  payment_status: string;
  finalized_at: string | null;
}

export const InvoicesPage: React.FC = () => {
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const url = statusFilter !== 'ALL' ? `/invoices?payment_status=${statusFilter}` : '/invoices';
      const res = await apiRequest<InvoiceListItem[]>(url);
      setInvoices(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter]);

  const filtered = invoices.filter((i) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (i.invoice_number && i.invoice_number.toLowerCase().includes(q)) ||
      i.job_card_number.toLowerCase().includes(q) ||
      i.customer_name.toLowerCase().includes(q) ||
      i.vehicle_reg.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Page Header */}
      <div>
        <h2 className="font-display font-bold text-2xl md:text-3xl text-workshop-text tracking-tight">
          Invoices &amp; Billing
        </h2>
        <p className="text-sm text-workshop-muted">
          Manage final service bills, payments, receipts, and receivables.
        </p>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-workshop-border space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          <div className="flex flex-wrap gap-1.5 text-xs">
            {[
              { id: 'ALL', label: 'All Invoices' },
              { id: 'UNPAID', label: 'Unpaid' },
              { id: 'PARTIALLY_PAID', label: 'Partially Paid' },
              { id: 'PAID', label: 'Fully Paid' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-brand text-white shadow-xs'
                    : 'bg-gray-100 hover:bg-gray-200 text-workshop-muted'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-workshop-muted absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search invoice#, JC#, vehicle plate..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-workshop-border rounded-lg bg-[#FAFAF8] focus:outline-none"
            />
          </div>

        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-workshop-border overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F8FAFC] border-b border-workshop-border text-xs uppercase text-workshop-muted font-semibold">
              <tr>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Job Card #</th>
                <th className="px-4 py-3">Customer &amp; Vehicle</th>
                <th className="px-4 py-3">Invoice State</th>
                <th className="px-4 py-3 text-right">Grand Total</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Balance Due</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-workshop-border-soft">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-workshop-muted">
                    Loading invoices...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-workshop-muted">
                    No matching invoices found.
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => setSelectedInvoiceId(inv.id)}
                    className="hover:bg-blue-50/40 cursor-pointer transition"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-brand-deep">
                      {inv.invoice_number || <span className="text-workshop-muted italic">DRAFT</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-workshop-muted">
                      {inv.job_card_number}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-workshop-text text-xs">{inv.customer_name}</div>
                      <div className="font-mono text-xs text-workshop-muted">{inv.vehicle_reg}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        inv.status === 'FINALIZED'
                          ? 'bg-blue-50 text-brand-deep border border-blue-200'
                          : inv.status === 'VOID'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-workshop-text">
                      {formatINR(inv.grand_total)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-workshop-green">
                      {formatINR(inv.amount_paid)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-xs">
                      <span className={inv.balance_due > 0 ? 'text-workshop-red' : 'text-workshop-green'}>
                        {formatINR(inv.balance_due)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-semibold">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={getPdfUrl(`/invoices/${inv.id}/pdf`)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title="Print / Save PDF"
                          className="p-1 text-workshop-muted hover:text-brand hover:bg-blue-50 rounded transition"
                        >
                          <Printer className="w-4 h-4" />
                        </a>
                        <span className="text-brand">View Bill &rarr;</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Detail Modal */}
      {selectedInvoiceId && (
        <InvoiceDetailModal
          invoiceId={selectedInvoiceId}
          isOpen={true}
          onClose={() => setSelectedInvoiceId(null)}
          onInvoiceUpdated={fetchInvoices}
        />
      )}

    </div>
  );
};

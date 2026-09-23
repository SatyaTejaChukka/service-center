import React, { useState, useEffect } from 'react';
import { PlusCircle, Search, Filter, ArrowRight, Clock, FileText, Printer } from 'lucide-react';
import { apiRequest, getPdfUrl } from '../lib/api';
import { formatINR } from '../lib/formatters';

interface JobCardItem {
  id: number;
  job_card_number: string;
  date: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  vehicle_reg: string;
  vehicle_model: string;
  odometer: number;
  created_at: string;
  invoice_total: number;
  invoice_status: string;
}

interface Props {
  onNavigate: (page: string, id?: number) => void;
  onNewJobCard: () => void;
}

export const JobCardsPage: React.FC<Props> = ({ onNavigate, onNewJobCard }) => {
  const [jobCards, setJobCards] = useState<JobCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  const fetchJobCards = async () => {
    try {
      setLoading(true);
      const url = statusFilter !== 'ALL' ? `/job-cards?status_filter=${statusFilter}` : '/job-cards';
      const res = await apiRequest<JobCardItem[]>(url);
      setJobCards(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobCards();
  }, [statusFilter]);

  const filtered = jobCards.filter((j) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      j.job_card_number.toLowerCase().includes(q) ||
      j.vehicle_reg.toLowerCase().includes(q) ||
      j.customer_name.toLowerCase().includes(q) ||
      j.vehicle_model.toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'READY_FOR_DELIVERY':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-workshop-green-bg text-workshop-green">Ready</span>;
      case 'WAITING_FOR_APPROVAL':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-workshop-amber-bg text-workshop-amber">Awaiting Approval</span>;
      case 'IN_PROGRESS':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-brand">In Progress</span>;
      case 'APPROVED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">Approved</span>;
      case 'INSPECTION':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">Inspection</span>;
      case 'COMPLETED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">Completed</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-workshop-red-bg text-workshop-red">Cancelled</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-brand">{status}</span>;
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl md:text-3xl text-workshop-text tracking-tight">
            Workshop Job Cards
          </h2>
          <p className="text-sm text-workshop-muted">
            Track active repair jobs, inspections, and service lifecycles.
          </p>
        </div>
        <button
          onClick={onNewJobCard}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-deep text-white font-semibold text-sm rounded-lg shadow-sm transition cursor-pointer self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" /> + Open New Job Card
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-workshop-border space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Status Tabs */}
          <div className="flex flex-wrap gap-1.5 text-xs">
            {[
              { id: 'ALL', label: 'All Jobs' },
              { id: 'RECEIVED', label: 'Received' },
              { id: 'INSPECTION', label: 'Inspection' },
              { id: 'WAITING_FOR_APPROVAL', label: 'Awaiting Approval' },
              { id: 'APPROVED', label: 'Approved' },
              { id: 'IN_PROGRESS', label: 'In Service' },
              { id: 'READY_FOR_DELIVERY', label: 'Ready' },
              { id: 'COMPLETED', label: 'Completed' },
              { id: 'CANCELLED', label: 'Cancelled' },
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

          {/* Search filter */}
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-workshop-muted absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filter by JC#, plate, name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-workshop-border rounded-lg bg-[#FAFAF8] focus:outline-none"
            />
          </div>

        </div>
      </div>

      {/* Job Cards Table */}
      <div className="bg-white rounded-xl border border-workshop-border overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F8FAFC] border-b border-workshop-border text-xs uppercase text-workshop-muted font-semibold">
              <tr>
                <th className="px-4 py-3">Job Card #</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Invoice / Est.</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-workshop-border-soft">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-workshop-muted">
                    Loading job cards...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-workshop-muted">
                    No matching job cards found.
                  </td>
                </tr>
              ) : (
                filtered.map((jc) => (
                  <tr
                    key={jc.id}
                    onClick={() => onNavigate('jobcard_detail', jc.id)}
                    className="hover:bg-blue-50/40 cursor-pointer transition"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-brand-deep">
                      {jc.job_card_number}
                    </td>
                    <td className="px-4 py-3 text-xs text-workshop-muted font-mono">
                      {jc.date}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono font-semibold text-xs bg-gray-100 px-2 py-0.5 rounded border border-gray-200 inline-block mb-0.5">
                        {jc.vehicle_reg}
                      </div>
                      <div className="text-xs text-workshop-muted">{jc.vehicle_model}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-workshop-text text-xs">{jc.customer_name}</div>
                      <div className="text-xs text-workshop-muted font-mono">{jc.customer_phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(jc.status)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-mono font-bold text-xs text-workshop-text">
                        {formatINR(jc.invoice_total)}
                      </div>
                      <span className="text-[10px] text-workshop-muted uppercase">
                        {jc.invoice_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-semibold">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={getPdfUrl(`/job-cards/${jc.id}/pdf`)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title="Print Job Card PDF"
                          className="p-1 text-workshop-muted hover:text-brand hover:bg-blue-50 rounded transition"
                        >
                          <Printer className="w-4 h-4" />
                        </a>
                        <span className="text-brand">View &rarr;</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  UserPlus,
  Search,
  Clock,
  CheckCircle,
  AlertCircle,
  IndianRupee,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { formatINR } from '../lib/formatters';

interface DashboardData {
  tiles: {
    todays_jobs: number;
    in_service: number;
    ready_for_delivery: number;
    todays_revenue_paise: number;
  };
  recent_job_cards: Array<{
    id: number;
    job_card_number: string;
    vehicle_reg: string;
    vehicle_model: string;
    status: string;
    odometer: number;
    date: string;
  }>;
  widgets: {
    pending_approvals: Array<{ id: number; job_card_number: string; vehicle: string; reg: string }>;
    ready_for_delivery: Array<{ id: number; job_card_number: string; vehicle: string; reg: string }>;
    recent_payments: Array<{ id: number; amount: number; method: string; invoice_id: number; invoice_number: string; paid_at: string }>;
  };
}

interface Props {
  onNavigate: (page: string, id?: number) => void;
  onOpenSearch: () => void;
  onNewJobCard: () => void;
  onNewCustomer: () => void;
}

export const DashboardPage: React.FC<Props> = ({
  onNavigate,
  onOpenSearch,
  onNewJobCard,
  onNewCustomer,
}) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const res = await apiRequest<DashboardData>('/dashboard/summary');
        setData(res);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'READY_FOR_DELIVERY':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-workshop-green-bg text-workshop-green">Ready</span>;
      case 'WAITING_FOR_APPROVAL':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-workshop-amber-bg text-workshop-amber">Awaiting Approval</span>;
      case 'IN_PROGRESS':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-brand">In Service</span>;
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
      
      {/* Top Greeting & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl md:text-3xl tracking-tight text-workshop-text">
            {getGreeting()}
          </h2>
          <p className="text-sm text-workshop-muted">
            Here's what's happening at Pushpa Raj Automotive today.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onNewJobCard}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-deep text-white font-semibold text-sm rounded-lg shadow-sm transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" /> + New Job Card
          </button>
          <button
            onClick={onNewCustomer}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-white hover:bg-gray-50 border border-workshop-border text-workshop-text font-semibold text-sm rounded-lg transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-workshop-muted" /> + New Customer
          </button>
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-white hover:bg-gray-50 border border-workshop-border text-workshop-text font-semibold text-sm rounded-lg transition cursor-pointer"
          >
            <Search className="w-4 h-4 text-workshop-muted" /> Find Vehicle
          </button>
        </div>
      </div>

      {/* 4 Statistic Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Tile 1: Today's Jobs */}
        <div className="p-5 bg-white rounded-xl border border-workshop-border shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-workshop-muted uppercase tracking-wider">Today's Jobs</span>
            <span className="p-1.5 bg-blue-50 text-brand rounded-md"><Clock className="w-4 h-4" /></span>
          </div>
          <div className="mt-3 font-display font-bold text-3xl md:text-4xl text-workshop-text leading-none">
            {data ? data.tiles.todays_jobs : '-'}
          </div>
          <p className="text-[11px] text-workshop-muted mt-2">New job cards created today</p>
        </div>

        {/* Tile 2: In Service */}
        <div className="p-5 bg-white rounded-xl border border-workshop-border shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-workshop-muted uppercase tracking-wider">In Service</span>
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-md"><AlertCircle className="w-4 h-4" /></span>
          </div>
          <div className="mt-3 font-display font-bold text-3xl md:text-4xl text-workshop-text leading-none">
            {data ? data.tiles.in_service : '-'}
          </div>
          <p className="text-[11px] text-workshop-muted mt-2">Diagnosing, approval or active repair</p>
        </div>

        {/* Tile 3: Ready for Delivery */}
        <div className="p-5 bg-white rounded-xl border border-workshop-border shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-workshop-muted uppercase tracking-wider">Ready for Delivery</span>
            <span className="p-1.5 bg-workshop-green-bg text-workshop-green rounded-md"><CheckCircle className="w-4 h-4" /></span>
          </div>
          <div className="mt-3 font-display font-bold text-3xl md:text-4xl text-workshop-green leading-none">
            {data ? data.tiles.ready_for_delivery : '-'}
          </div>
          <p className="text-[11px] text-workshop-muted mt-2">Work completed; awaiting delivery</p>
        </div>

        {/* Tile 4: Today's Revenue */}
        <div className="p-5 bg-white rounded-xl border border-workshop-border shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-workshop-muted uppercase tracking-wider">Today's Revenue</span>
            <span className="p-1.5 bg-green-50 text-green-700 rounded-md"><TrendingUp className="w-4 h-4" /></span>
          </div>
          <div className="mt-3 font-display font-bold text-2xl md:text-3xl text-workshop-text leading-none tracking-tight">
            {data ? formatINR(data.tiles.todays_revenue_paise) : '-'}
          </div>
          <p className="text-[11px] text-workshop-muted mt-2">Cash &amp; digital payments received</p>
        </div>

      </div>

      {/* Recent Job Cards Table */}
      <div className="bg-white rounded-xl border border-workshop-border overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-workshop-border flex items-center justify-between">
          <h3 className="font-semibold text-base text-workshop-text">Recent Job Cards</h3>
          <button
            onClick={() => onNavigate('job_cards')}
            className="text-xs font-semibold text-brand hover:text-brand-deep flex items-center gap-1 cursor-pointer"
          >
            View All Job Cards <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F8FAFC] border-b border-workshop-border text-xs uppercase text-workshop-muted font-semibold">
              <tr>
                <th className="px-4 py-3">Job Card #</th>
                <th className="px-4 py-3">Vehicle Plate</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Odometer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-workshop-border-soft">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-workshop-muted">
                    Loading recent job cards...
                  </td>
                </tr>
              ) : !data || data.recent_job_cards.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-workshop-muted">
                    No job cards recorded yet. Click <span className="font-semibold text-brand">+ New Job Card</span> to start.
                  </td>
                </tr>
              ) : (
                data.recent_job_cards.map((jc) => (
                  <tr
                    key={jc.id}
                    onClick={() => onNavigate('jobcard_detail', jc.id)}
                    className="hover:bg-blue-50/40 cursor-pointer transition"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-brand-deep">{jc.job_card_number}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold bg-gray-100 px-2 py-0.5 rounded border border-gray-200 text-xs">
                        {jc.vehicle_reg}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-workshop-text">{jc.vehicle_model}</td>
                    <td className="px-4 py-3 font-mono text-xs text-workshop-muted">{jc.odometer.toLocaleString('en-IN')} km</td>
                    <td className="px-4 py-3">{getStatusBadge(jc.status)}</td>
                    <td className="px-4 py-3 text-right text-xs font-semibold text-brand">
                      Open &rarr;
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3 Action Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Widget 1: Pending Approvals */}
        <div className="bg-white p-4 rounded-xl border border-workshop-border shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-workshop-muted uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span> Pending Customer Approvals
            </h4>
            <span className="text-xs font-mono font-bold text-workshop-amber">
              {data?.widgets.pending_approvals.length || 0}
            </span>
          </div>
          <div className="space-y-2">
            {!data || data.widgets.pending_approvals.length === 0 ? (
              <div className="text-xs text-workshop-muted py-4 text-center">No pending approvals.</div>
            ) : (
              data.widgets.pending_approvals.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onNavigate('jobcard_detail', item.id)}
                  className="p-2.5 bg-gray-50 hover:bg-amber-50/50 rounded-lg border border-workshop-border cursor-pointer transition flex items-center justify-between"
                >
                  <div>
                    <span className="font-mono font-semibold text-xs text-brand-deep">{item.job_card_number}</span>
                    <div className="text-xs text-workshop-text font-medium">{item.vehicle} ({item.reg})</div>
                  </div>
                  <span className="text-[11px] font-semibold text-workshop-amber bg-workshop-amber-bg px-2 py-0.5 rounded-full">
                    Review
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Widget 2: Ready for Delivery */}
        <div className="bg-white p-4 rounded-xl border border-workshop-border shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-workshop-muted uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500"></span> Ready for Delivery
            </h4>
            <span className="text-xs font-mono font-bold text-workshop-green">
              {data?.widgets.ready_for_delivery.length || 0}
            </span>
          </div>
          <div className="space-y-2">
            {!data || data.widgets.ready_for_delivery.length === 0 ? (
              <div className="text-xs text-workshop-muted py-4 text-center">No vehicles ready for delivery.</div>
            ) : (
              data.widgets.ready_for_delivery.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onNavigate('jobcard_detail', item.id)}
                  className="p-2.5 bg-gray-50 hover:bg-green-50/50 rounded-lg border border-workshop-border cursor-pointer transition flex items-center justify-between"
                >
                  <div>
                    <span className="font-mono font-semibold text-xs text-brand-deep">{item.job_card_number}</span>
                    <div className="text-xs text-workshop-text font-medium">{item.vehicle} ({item.reg})</div>
                  </div>
                  <span className="text-[11px] font-semibold text-workshop-green bg-workshop-green-bg px-2 py-0.5 rounded-full">
                    Deliver
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Widget 3: Recent Payments */}
        <div className="bg-white p-4 rounded-xl border border-workshop-border shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-workshop-muted uppercase tracking-wider flex items-center gap-1.5">
              <IndianRupee className="w-3.5 h-3.5 text-brand" /> Recent Payments
            </h4>
          </div>
          <div className="space-y-2">
            {!data || data.widgets.recent_payments.length === 0 ? (
              <div className="text-xs text-workshop-muted py-4 text-center">No recent payments.</div>
            ) : (
              data.widgets.recent_payments.map((pay) => (
                <div
                  key={pay.id}
                  onClick={() => onNavigate('invoices', pay.invoice_id)}
                  className="p-2.5 bg-gray-50 hover:bg-blue-50/50 rounded-lg border border-workshop-border cursor-pointer transition flex items-center justify-between"
                >
                  <div>
                    <div className="font-mono font-bold text-xs text-workshop-text">{formatINR(pay.amount)}</div>
                    <div className="text-[11px] text-workshop-muted">
                      {pay.method} &bull; {pay.invoice_number}
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-workshop-muted">
                    {pay.paid_at}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

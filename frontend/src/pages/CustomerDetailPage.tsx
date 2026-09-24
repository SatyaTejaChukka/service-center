import React, { useState, useEffect } from 'react';
import { ArrowLeft, User, Car, FileText, Phone, MapPin, IndianRupee, Mail } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { formatINR } from '../lib/formatters';

interface Props {
  customerId: number;
  onBack: () => void;
  onNavigateToJobCard: (id: number) => void;
  onNavigateToVehicle: (id: number) => void;
}

export const CustomerDetailPage: React.FC<Props> = ({
  customerId,
  onBack,
  onNavigateToJobCard,
  onNavigateToVehicle,
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest(`/customers/${customerId}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [customerId]);

  if (loading) {
    return <div className="p-8 text-center text-sm text-workshop-muted animate-pulse">Loading profile...</div>;
  }

  if (!data) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="text-red-600 font-semibold">Customer not found</div>
        <button onClick={onBack} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">&larr; Back</button>
      </div>
    );
  }

  const { customer, vehicles, lifetime_spend, total_outstanding, job_cards } = data;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-workshop-border shadow-2xs">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg text-workshop-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="font-display font-bold text-2xl text-workshop-text">{customer.name}</h2>
          <div className="flex flex-wrap items-center gap-4 text-xs text-workshop-muted mt-1 font-mono">
            <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-brand" /> {customer.phone}</span>
            {customer.alt_phone && <span>Alt: {customer.alt_phone}</span>}
            {customer.email && <span className="flex items-center gap-1 font-sans"><Mail className="w-3 h-3 text-brand" /> {customer.email}</span>}
            {customer.address && <span className="flex items-center gap-1 font-sans"><MapPin className="w-3 h-3 text-brand" /> {customer.address}</span>}
          </div>
        </div>
      </div>

      {/* 2 Metric Tiles: Lifetime Spend & Outstanding Balance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 bg-white rounded-xl border border-workshop-border">
          <span className="text-xs font-bold text-workshop-muted uppercase tracking-wider">Lifetime Billed Spend</span>
          <div className="mt-2 font-display font-bold text-3xl text-brand-deep">
            {formatINR(lifetime_spend)}
          </div>
        </div>
        <div className="p-5 bg-white rounded-xl border border-workshop-border">
          <span className="text-xs font-bold text-workshop-muted uppercase tracking-wider">Outstanding Payment Balance</span>
          <div className={`mt-2 font-display font-bold text-3xl ${total_outstanding > 0 ? 'text-workshop-red' : 'text-workshop-green'}`}>
            {formatINR(total_outstanding)}
          </div>
        </div>
      </div>

      {/* Owned Vehicles */}
      <div className="bg-white rounded-xl border border-workshop-border p-5 space-y-3">
        <h3 className="font-bold text-sm text-workshop-text flex items-center gap-2">
          <Car className="w-4 h-4 text-brand" /> Vehicles Owned ({vehicles.length})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {vehicles.map((v: any) => (
            <div
              key={v.id}
              onClick={() => onNavigateToVehicle(v.id)}
              className="p-3 bg-gray-50 hover:bg-blue-50/50 rounded-lg border border-workshop-border cursor-pointer transition flex items-center justify-between"
            >
              <div>
                <span className="font-mono font-bold text-xs bg-white px-2 py-0.5 rounded border border-gray-200">
                  {v.registration_number}
                </span>
                <div className="text-xs font-semibold text-workshop-text mt-1">{v.make} {v.model}</div>
              </div>
              <span className="text-xs text-brand font-semibold">&rarr;</span>
            </div>
          ))}
        </div>
      </div>

      {/* Complete Service History */}
      <div className="bg-white rounded-xl border border-workshop-border overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-workshop-border">
          <h3 className="font-bold text-sm text-workshop-text">Service History &amp; Invoices</h3>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F8FAFC] border-b border-workshop-border text-xs uppercase text-workshop-muted">
            <tr>
              <th className="px-4 py-3">Job Card #</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Vehicle</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Invoice Amount</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-workshop-border-soft">
            {job_cards.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-workshop-muted">No service records found.</td></tr>
            ) : (
              job_cards.map((jc: any) => (
                <tr key={jc.id} onClick={() => onNavigateToJobCard(jc.id)} className="hover:bg-blue-50/40 cursor-pointer">
                  <td className="px-4 py-3 font-mono font-bold text-brand-deep">{jc.job_card_number}</td>
                  <td className="px-4 py-3 text-xs text-workshop-muted font-mono">{jc.date}</td>
                  <td className="px-4 py-3 text-xs font-mono font-semibold">{jc.vehicle_reg} ({jc.vehicle_model})</td>
                  <td className="px-4 py-3 text-xs">{jc.status}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-xs">
                    {jc.invoice ? formatINR(jc.invoice.grand_total) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-semibold text-brand">View &rarr;</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};

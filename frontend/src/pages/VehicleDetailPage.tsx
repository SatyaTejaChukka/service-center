import React, { useState, useEffect } from 'react';
import { ArrowLeft, Car, User, Clock, FileText, IndianRupee } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { formatINR } from '../lib/formatters';

interface Props {
  vehicleId: number;
  onBack: () => void;
  onNavigateToJobCard: (id: number) => void;
  onNavigateToInvoice: (id: number) => void;
}

export const VehicleDetailPage: React.FC<Props> = ({
  vehicleId,
  onBack,
  onNavigateToJobCard,
  onNavigateToInvoice,
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest(`/vehicles/${vehicleId}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [vehicleId]);

  if (loading) {
    return <div className="p-8 text-center text-sm text-workshop-muted animate-pulse">Loading vehicle...</div>;
  }

  if (!data) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="text-red-600 font-semibold">Vehicle not found</div>
        <button onClick={onBack} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">&larr; Back</button>
      </div>
    );
  }

  const { vehicle, owner, history } = data;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-workshop-border shadow-2xs">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg text-workshop-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-xl bg-gray-100 px-3 py-1 rounded border border-gray-300">
              {vehicle.registration_number}
            </span>
            <h2 className="font-display font-bold text-2xl text-workshop-text">{vehicle.make} {vehicle.model}</h2>
          </div>
          <div className="text-xs text-workshop-muted mt-1">
            Owner: <span className="font-semibold text-workshop-text">{owner?.name}</span> ({owner?.phone}) &bull; Current Odometer: <span className="font-mono font-semibold">{vehicle.current_odometer.toLocaleString('en-IN')} km</span>
          </div>
        </div>
      </div>

      {/* Chronological Service History matching Section 12.4 */}
      <div className="bg-white rounded-xl border border-workshop-border overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-workshop-border flex items-center justify-between">
          <h3 className="font-bold text-sm text-workshop-text flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand" /> Chronological Service History ({history.length} Visits)
          </h3>
        </div>

        <table className="w-full text-left text-sm">
          <thead className="bg-[#F8FAFC] border-b border-workshop-border text-xs uppercase text-workshop-muted">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Job Card #</th>
              <th className="px-4 py-3">Odometer</th>
              <th className="px-4 py-3">Services / Work Done</th>
              <th className="px-4 py-3 text-right">Invoice Amount</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-workshop-border-soft">
            {history.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-workshop-muted">No past services recorded.</td></tr>
            ) : (
              history.map((h: any) => (
                <tr key={h.job_card_id} className="hover:bg-blue-50/40">
                  <td className="px-4 py-3 font-mono text-xs text-workshop-muted">{h.date}</td>
                  <td className="px-4 py-3 font-mono font-bold text-brand-deep cursor-pointer" onClick={() => onNavigateToJobCard(h.job_card_id)}>
                    {h.job_card_number}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{h.odometer.toLocaleString('en-IN')} km</td>
                  <td className="px-4 py-3 text-xs text-workshop-text font-medium">{h.work_summary}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-xs">{formatINR(h.total_amount)}</td>
                  <td className="px-4 py-3 text-right text-xs">
                    {h.invoice_id ? (
                      <button
                        onClick={() => onNavigateToInvoice(h.invoice_id)}
                        className="text-brand font-semibold hover:underline"
                      >
                        [View Invoice]
                      </button>
                    ) : (
                      <span className="text-workshop-muted">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};

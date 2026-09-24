import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Printer,
  Receipt,
  CheckCircle,
  AlertTriangle,
  Clock,
  Car,
  User,
  Wrench,
  Package,
  History,
  Check,
  X,
  CalendarClock
} from 'lucide-react';
import { apiRequest, getPdfUrl } from '../lib/api';
import { formatINR, formatDate } from '../lib/formatters';
import { useAuth } from '../context/AuthContext';

interface Props {
  jobCardId: number;
  onBack: () => void;
  onNavigateToInvoice: (invoiceId: number) => void;
}

export const JobCardDetailPage: React.FC<Props> = ({
  jobCardId,
  onBack,
  onNavigateToInvoice,
}) => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status transition state
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const fetchDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest(`/job-cards/${jobCardId}`);
      setData(res);
      setNewStatus(res.status);
    } catch (err: any) {
      setError(err.message || 'Failed to load job card');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [jobCardId]);

  const handleUpdateStatus = async () => {
    try {
      await apiRequest(`/job-cards/${jobCardId}/status`, {
        method: 'POST',
        body: JSON.stringify({
          status: newStatus,
          note: statusNote || undefined,
          cancelled_reason: newStatus === 'CANCELLED' ? cancelReason : undefined,
        }),
      });
      setShowStatusModal(false);
      fetchDetail();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-workshop-muted animate-pulse">
        Loading Job Card details...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="text-red-600 font-semibold">{error || 'Job card not found'}</div>
        <button onClick={onBack} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">
          &larr; Back to Job Cards
        </button>
      </div>
    );
  }

  const isCompleted = data.status === 'COMPLETED';
  const isCancelled = data.status === 'CANCELLED';

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-workshop-border shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg text-workshop-muted transition"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xl text-brand-deep">
                {data.job_card_number}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-brand">
                {data.status}
              </span>
            </div>
            <div className="text-xs text-workshop-muted mt-0.5">
              Opened on {data.date} at {data.time_in} &bull; Odometer: <span className="font-mono font-semibold">{data.odometer.toLocaleString('en-IN')} km</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowStatusModal(true)}
            className="px-3.5 py-2 bg-white hover:bg-gray-50 border border-workshop-border text-workshop-text font-semibold text-xs rounded-lg transition"
          >
            Change Status ({data.status})
          </button>

          <a
            href={getPdfUrl(`/job-cards/${data.id}/pdf`)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 border border-workshop-border text-workshop-text font-semibold text-xs rounded-lg transition shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-workshop-muted" /> Print Job Card PDF
          </a>

          {data.invoice && (
            <button
              onClick={() => onNavigateToInvoice(data.invoice.id)}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-deep text-white font-semibold text-xs rounded-lg shadow-sm transition"
            >
              <Receipt className="w-3.5 h-3.5" /> View / Finalize Invoice
            </button>
          )}
        </div>
      </div>

      {/* Customer & Vehicle Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Customer Card */}
        <div className="p-4 bg-white rounded-xl border border-workshop-border shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-workshop-muted uppercase tracking-wider">
            <User className="w-3.5 h-3.5 text-brand" /> Customer Information
          </div>
          <div className="font-bold text-base text-workshop-text">{data.customer.name}</div>
          <div className="text-xs text-workshop-muted space-y-1">
            <div>Phone: <span className="font-mono font-semibold text-workshop-text">{data.customer.phone}</span></div>
            {data.customer.alt_phone && <div>Alt Phone: <span className="font-mono">{data.customer.alt_phone}</span></div>}
            {data.customer.email && <div>Email: <span className="font-mono">{data.customer.email}</span></div>}
            {data.customer.address && <div>Address: {data.customer.address}</div>}
          </div>
        </div>

        {/* Vehicle Card */}
        <div className="p-4 bg-white rounded-xl border border-workshop-border shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-workshop-muted uppercase tracking-wider">
            <Car className="w-3.5 h-3.5 text-brand" /> Vehicle Details
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-base bg-gray-100 px-2.5 py-0.5 rounded border border-gray-300">
              {data.vehicle.registration_number}
            </span>
            <span className="font-bold text-base text-workshop-text">
              {data.vehicle.make} {data.vehicle.model} {data.vehicle.variant && <span className="text-sm font-normal text-workshop-muted">({data.vehicle.variant})</span>}
            </span>
          </div>
          <div className="text-xs text-workshop-muted space-y-1">
            <div className="flex flex-wrap items-center gap-x-2">
              <span>Fuel: <span className="font-semibold text-workshop-text">{data.vehicle.fuel_type}</span></span>
              <span>&bull;</span>
              <span>Fuel Level: <span className="font-semibold text-workshop-text">{data.fuel_level || 'N/A'}</span></span>
              {data.vehicle.year && <><span>&bull;</span><span>Year: <span className="font-semibold text-workshop-text">{data.vehicle.year}</span></span></>}
              {data.vehicle.colour && <><span>&bull;</span><span>Colour: <span className="font-semibold text-workshop-text">{data.vehicle.colour}</span></span></>}
            </div>
            {data.vehicle.vin && <div>VIN: <span className="font-mono">{data.vehicle.vin}</span></div>}
            {data.vehicle.engine_number && <div>Engine: <span className="font-mono">{data.vehicle.engine_number}</span></div>}
          </div>
        </div>

      </div>

      {/* Intake Notes, Delivery Time, and Assigned Technician */}
      {(data.notes || data.promised_at || data.assigned_to_name) && (
        <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200/80 text-xs text-blue-950 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-xs uppercase tracking-wider text-brand-deep flex items-center gap-1.5">
              <CalendarClock className="w-4 h-4 text-brand" /> Intake & Assignment
            </span>
            <div className="flex flex-wrap items-center gap-4 text-xs">
              {data.assigned_to_name && (
                <div>
                  <span className="text-workshop-muted">Technician:</span>{' '}
                  <span className="font-semibold text-workshop-text">{data.assigned_to_name}</span>
                </div>
              )}
              {data.promised_at && (
                <div>
                  <span className="text-workshop-muted">Promised Delivery:</span>{' '}
                  <span className="font-semibold text-brand font-mono">{data.promised_at}</span>
                </div>
              )}
            </div>
          </div>
          {data.notes && (
            <div className="pt-1.5 border-t border-blue-100 text-xs text-workshop-text">
              <span className="font-semibold text-workshop-muted">Intake Notes:</span> {data.notes}
            </div>
          )}
        </div>
      )}

      {/* Inline Previous Service Summary (FR-HIS-003) */}
      {data.last_service && (
        <div className="p-4 bg-amber-50/80 rounded-xl border border-amber-200/80 text-xs text-amber-900 space-y-1">
          <span className="font-bold text-amber-950 flex items-center gap-1.5">
            <History className="w-4 h-4 text-amber-700" /> Previous Service Record for this Vehicle:
          </span>
          <div>
            Date: <span className="font-semibold">{data.last_service.date}</span> &bull; 
            Job Card: <span className="font-mono font-semibold">{data.last_service.job_card_number}</span> &bull; 
            Odometer: <span className="font-semibold">{data.last_service.odometer.toLocaleString('en-IN')} km</span> &bull; 
            Amount: <span className="font-mono font-bold">{formatINR(data.last_service.total_amount)}</span>
          </div>
          <div>Work done previously: <span className="font-medium text-amber-950">{data.last_service.work_done}</span></div>
        </div>
      )}

      {/* Complaints & Inspection Side by Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Customer Complaints */}
        <div className="p-4 bg-white rounded-xl border border-workshop-border shadow-2xs space-y-3">
          <h3 className="font-bold text-sm text-workshop-text">Itemised Customer Complaints</h3>
          <div className="space-y-1.5">
            {data.complaints.length === 0 ? (
              <div className="text-xs text-workshop-muted py-2">No complaints recorded.</div>
            ) : (
              data.complaints.map((c: any) => (
                <div key={c.id} className="flex items-start gap-2 text-xs p-2 bg-gray-50 rounded-lg border border-workshop-border-soft">
                  <span className="font-mono font-bold text-workshop-muted">{c.sequence}.</span>
                  <span className="text-workshop-text font-medium">{c.description}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Inspection Checklist */}
        <div className="p-4 bg-white rounded-xl border border-workshop-border shadow-2xs space-y-3">
          <h3 className="font-bold text-sm text-workshop-text">Intake Inspection Checklist</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {data.inspections.map((insp: any) => {
              const isAttention = insp.status === 'NEEDS_ATTENTION';
              return (
                <div
                  key={insp.id}
                  className={`p-2 rounded-lg border ${
                    isAttention ? 'border-amber-300 bg-amber-50/50 text-amber-950' : 'border-gray-200 bg-gray-50 text-workshop-text'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span>{insp.category}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      isAttention ? 'bg-workshop-amber text-white font-bold' : 'text-workshop-green font-bold'
                    }`}>
                      {insp.status}
                    </span>
                  </div>
                  {insp.notes && <div className="text-[11px] text-workshop-muted mt-1 truncate">{insp.notes}</div>}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Labour & Parts Breakdown */}
      <div className="bg-white rounded-xl border border-workshop-border overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-workshop-border flex items-center justify-between">
          <h3 className="font-bold text-sm text-workshop-text">Service Work &amp; Parts Breakdown</h3>
          <span className="text-xs text-workshop-muted font-medium">
            (Only Approved/Used lines contribute to billing totals)
          </span>
        </div>

        <div className="p-4 space-y-6">
          
          {/* Labour Items */}
          <div>
            <span className="text-xs font-bold text-workshop-muted uppercase tracking-wider block mb-2">Labour / Services</span>
            <table className="w-full text-left text-xs border border-workshop-border rounded-lg overflow-hidden">
              <thead className="bg-[#F8FAFC] border-b border-workshop-border text-workshop-muted uppercase">
                <tr>
                  <th className="p-2.5">Description</th>
                  <th className="p-2.5 text-center">Status</th>
                  <th className="p-2.5 text-right">Qty</th>
                  <th className="p-2.5 text-right">Rate</th>
                  <th className="p-2.5 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-workshop-border-soft">
                {data.labour_items.map((l: any) => (
                  <tr key={l.id} className={l.status === 'REJECTED' ? 'bg-red-50/30 line-through text-workshop-muted' : ''}>
                    <td className="p-2.5 font-medium">{l.description}</td>
                    <td className="p-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        l.status === 'APPROVED' || l.status === 'DONE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="p-2.5 text-right font-mono">{l.quantity}</td>
                    <td className="p-2.5 text-right font-mono">{formatINR(l.unit_price)}</td>
                    <td className="p-2.5 text-right font-mono font-bold">{formatINR(l.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Parts Items */}
          <div>
            <span className="text-xs font-bold text-workshop-muted uppercase tracking-wider block mb-2">Parts / Materials</span>
            <table className="w-full text-left text-xs border border-workshop-border rounded-lg overflow-hidden">
              <thead className="bg-[#F8FAFC] border-b border-workshop-border text-workshop-muted uppercase">
                <tr>
                  <th className="p-2.5">Part Name</th>
                  <th className="p-2.5">Unit</th>
                  <th className="p-2.5 text-center">Status</th>
                  <th className="p-2.5 text-right">Qty</th>
                  <th className="p-2.5 text-right">Rate</th>
                  <th className="p-2.5 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-workshop-border-soft">
                {data.parts_items.map((p: any) => {
                  const isExcluded = p.status === 'REJECTED' || p.status === 'RECOMMENDED';
                  return (
                    <tr key={p.id} className={isExcluded ? 'bg-amber-50/20 text-workshop-muted' : ''}>
                      <td className="p-2.5 font-medium">
                        <span className={p.status === 'REJECTED' ? 'line-through' : ''}>{p.description}</span>
                        {p.part_number && <span className="text-gray-400 font-mono ml-1">({p.part_number})</span>}
                        {isExcluded && (
                          <div className="text-[10px] text-amber-700 italic">
                            {p.status === 'REJECTED' ? 'Customer rejected — excluded from invoice' : 'Pending decision — excluded from invoice'}
                          </div>
                        )}
                      </td>
                      <td className="p-2.5">{p.unit}</td>
                      <td className="p-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.status === 'APPROVED' || p.status === 'USED' ? 'bg-green-100 text-green-800' : p.status === 'REJECTED' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-mono">{p.quantity}</td>
                      <td className="p-2.5 text-right font-mono">{formatINR(p.unit_price)}</td>
                      <td className="p-2.5 text-right font-mono font-bold">
                        <span className={isExcluded ? 'line-through text-gray-400' : ''}>{formatINR(p.total)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Authoritative Totals Summary Box */}
          {data.invoice && (
            <div className="p-4 bg-gray-50 border border-workshop-border rounded-xl space-y-1.5 max-w-sm ml-auto text-xs">
              <div className="flex justify-between text-workshop-muted">
                <span>Parts Total:</span>
                <span className="font-mono font-semibold">{formatINR(data.invoice.parts_total)}</span>
              </div>
              <div className="flex justify-between text-workshop-muted">
                <span>Labour Total:</span>
                <span className="font-mono font-semibold">{formatINR(data.invoice.labour_total)}</span>
              </div>
              {data.invoice.other_charges_total > 0 && (
                <div className="flex justify-between text-workshop-muted">
                  <span>Other Charges:</span>
                  <span className="font-mono font-semibold">{formatINR(data.invoice.other_charges_total)}</span>
                </div>
              )}
              {data.invoice.discount > 0 && (
                <div className="flex justify-between text-workshop-red">
                  <span>Discount:</span>
                  <span className="font-mono font-semibold">-{formatINR(data.invoice.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm text-workshop-text border-t border-workshop-border pt-2">
                <span>Grand Total:</span>
                <span className="font-mono text-brand-deep text-base">{formatINR(data.invoice.grand_total)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-workshop-muted pt-1">
                <span>Payment Status:</span>
                <span className="font-bold text-workshop-green">{data.invoice.payment_status}</span>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Status History Audit Trail */}
      <div className="bg-white rounded-xl border border-workshop-border p-4 shadow-2xs space-y-3">
        <h4 className="font-bold text-xs text-workshop-muted uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-brand" /> Status Transition Audit Trail
        </h4>
        <div className="divide-y divide-gray-100 text-xs">
          {data.status_history.map((h: any, idx: number) => (
            <div key={idx} className="py-2 flex items-center justify-between">
              <div>
                <span className="font-bold text-workshop-text">{h.to_status}</span>
                {h.from_status !== 'NONE' && <span className="text-workshop-muted"> (from {h.from_status})</span>}
                {h.note && <span className="text-gray-500 italic ml-2">&bull; {h.note}</span>}
              </div>
              <div className="text-workshop-muted">
                {h.changed_by} &bull; <span className="font-mono">{h.changed_at}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Change Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-workshop-border p-6 max-w-md w-full space-y-4">
            <h3 className="font-bold text-base text-workshop-text">Update Job Card Status</h3>
            <div>
              <label className="block text-xs font-semibold text-workshop-text mb-1">Select New Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm bg-white"
              >
                <option value="RECEIVED">RECEIVED</option>
                <option value="INSPECTION">INSPECTION</option>
                <option value="WAITING_FOR_APPROVAL">WAITING_FOR_APPROVAL</option>
                <option value="APPROVED">APPROVED</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="READY_FOR_DELIVERY">READY_FOR_DELIVERY</option>
                <option value="COMPLETED">COMPLETED (Requires Finalised Invoice)</option>
                <option value="CANCELLED">CANCELLED (Requires Reason)</option>
              </select>
            </div>

            {newStatus === 'CANCELLED' && (
              <div>
                <label className="block text-xs font-semibold text-red-700 mb-1">Reason for Cancellation *</label>
                <textarea
                  rows={2}
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="State reason why job is being cancelled..."
                  className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-workshop-text mb-1">Note (Optional)</label>
              <input
                type="text"
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder="Optional transition note..."
                className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="px-4 py-2 border border-workshop-border rounded-lg text-xs font-semibold hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateStatus}
                className="px-4 py-2 bg-brand text-white rounded-lg text-xs font-bold hover:bg-brand-deep shadow-xs"
              >
                Confirm Status Change
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
  Lock,
  Ban,
  IndianRupee,
  FileCheck,
  MessageCircle
} from 'lucide-react';
import { apiRequest, getPdfUrl } from '../../lib/api';
import { formatINR } from '../../lib/formatters';
import { useAuth } from '../../context/AuthContext';
import { WhatsAppPreviewModal } from '../common/WhatsAppPreviewModal';
import { buildInvoiceReceiptMessage, buildReadyForDeliveryMessage } from '../../lib/whatsapp';

interface Props {
  invoiceId: number;
  isOpen: boolean;
  onClose: () => void;
  onInvoiceUpdated?: () => void;
}

export const InvoiceDetailModal: React.FC<Props> = ({
  invoiceId,
  isOpen,
  onClose,
  onInvoiceUpdated,
}) => {
  const { user, workshop } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // WhatsApp modal state
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppTitle, setWhatsAppTitle] = useState('');
  const [whatsAppMessage, setWhatsAppMessage] = useState('');

  // Payment form
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState('UPI');
  const [payRef, setPayRef] = useState('');
  const [payNote, setPayNote] = useState('');

  // Other charge form
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [chargeDesc, setChargeDesc] = useState('');
  const [chargeAmount, setChargeAmount] = useState<number>(0);

  // Discount form
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountAmt, setDiscountAmt] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState('');

  // Void modal
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  // Business profile for header branding
  const [businessProfile, setBusinessProfile] = useState<{ business_name?: string; business_address?: string } | null>(null);

  useEffect(() => {
    apiRequest('/settings/business').then(setBusinessProfile).catch(() => {});
  }, []);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest(`/invoices/${invoiceId}`);
      setData(res);
      setPayAmount(res.balance_due / 100);
    } catch (err: any) {
      setError(err.message || 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && invoiceId) {
      fetchInvoice();
    }
  }, [isOpen, invoiceId]);

  const handleFinalize = async () => {
    if (!window.confirm('Are you sure you want to finalise this invoice? Once finalised, line items will be locked.')) {
      return;
    }
    try {
      await apiRequest(`/invoices/${invoiceId}/finalize`, { method: 'POST' });
      fetchInvoice();
      if (onInvoiceUpdated) onInvoiceUpdated();
    } catch (err: any) {
      alert(err.message || 'Finalisation failed');
    }
  };

  const handleToggleInvoiceItem = async (type: 'labour' | 'part', itemId: number, currentStatus: string) => {
    if (!data?.job_card_id) return;
    try {
      const nextStatus = currentStatus === 'REJECTED' ? 'APPROVED' : 'REJECTED';
      const endpoint = type === 'labour'
        ? `/job-cards/${data.job_card_id}/labour-items/${itemId}`
        : `/job-cards/${data.job_card_id}/parts-items/${itemId}`;
      await apiRequest(endpoint, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus })
      });
      fetchInvoice();
      if (onInvoiceUpdated) onInvoiceUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to update item status');
    }
  };

  const handleReversePayment = async (paymentId: number) => {
    const reason = window.prompt('Enter reason for payment reversal (e.g. Mistaken receipt entry):');
    if (!reason || !reason.trim()) return;
    try {
      await apiRequest(`/invoices/${invoiceId}/payments/${paymentId}/reverse`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() })
      });
      fetchInvoice();
      if (onInvoiceUpdated) onInvoiceUpdated();
    } catch (err: any) {
      alert(err.message || 'Payment reversal failed');
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest(`/invoices/${invoiceId}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Math.round(payAmount * 100),
          method: payMethod,
          reference: payRef.trim() || undefined,
          note: payNote.trim() || undefined,
        }),
      });
      setShowPayModal(false);
      setPayRef('');
      setPayNote('');
      fetchInvoice();
      if (onInvoiceUpdated) onInvoiceUpdated();
    } catch (err: any) {
      alert(err.message || 'Payment recording failed');
    }
  };

  const handleAddCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest(`/invoices/${invoiceId}/other-charges`, {
        method: 'POST',
        body: JSON.stringify({
          description: chargeDesc,
          amount: Math.round(chargeAmount * 100),
        }),
      });
      setShowChargeModal(false);
      fetchInvoice();
      if (onInvoiceUpdated) onInvoiceUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to add charge');
    }
  };

  const handleApplyDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest(`/invoices/${invoiceId}/discount`, {
        method: 'POST',
        body: JSON.stringify({
          discount: Math.round(discountAmt * 100),
          reason: discountReason,
        }),
      });
      setShowDiscountModal(false);
      fetchInvoice();
      if (onInvoiceUpdated) onInvoiceUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to apply discount');
    }
  };

  const handleVoidInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidReason.trim()) {
      alert('Please state a reason for voiding this invoice');
      return;
    }
    try {
      await apiRequest(`/invoices/${invoiceId}/void`, {
        method: 'POST',
        body: JSON.stringify({ reason: voidReason }),
      });
      setShowVoidModal(false);
      fetchInvoice();
      if (onInvoiceUpdated) onInvoiceUpdated();
    } catch (err: any) {
      alert(err.message || 'Void operation failed');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/60 backdrop-blur-sm p-3 sm:p-4 md:p-6 flex flex-col items-center justify-start sm:justify-center">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-workshop-border overflow-hidden my-auto shrink-0 max-h-[94vh] flex flex-col">
        
        {/* Modal Top Bar */}
        <div className="px-6 py-4 border-b border-workshop-border bg-[#F8FAFC] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="font-display font-bold text-xl text-workshop-text">
              {data?.invoice_number ? `Invoice ${data.invoice_number}` : 'Invoice Preview (DRAFT)'}
            </h3>
            {data && (
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                data.status === 'FINALIZED'
                  ? 'bg-blue-100 text-brand-deep'
                  : data.status === 'VOID'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {data.status}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200 text-workshop-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto overscroll-contain flex-1 space-y-6">
          {loading && (
            <div className="py-12 text-center text-sm text-workshop-muted animate-pulse">
              Loading invoice...
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
              {error}
            </div>
          )}

          {data && (
            <div className="max-w-xl mx-auto bg-white border border-gray-200 rounded-xl p-6 shadow-xs space-y-5 text-sm">
              
              {/* Void Notice watermark banner if void */}
              {data.status === 'VOID' && (
                <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg text-center font-bold text-sm">
                  ⚠️ THIS INVOICE IS VOIDED &bull; Reason: {data.void_reason}
                </div>
              )}

              {/* Brand Header */}
              <div className="text-center border-b border-workshop-border pb-4 space-y-1">
                <h4 className="font-display font-bold text-2xl tracking-tight text-workshop-text uppercase">
                  {businessProfile?.business_name || 'Automotive Services'}
                </h4>
                <div className="text-xs text-workshop-muted font-medium">
                  Tax Invoice / Service Bill &bull; {businessProfile?.business_address || 'Workshop Services'}
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-3 rounded-lg border border-workshop-border-soft">
                <div>
                  <div className="text-workshop-muted">Invoice No:</div>
                  <div className="font-mono font-bold text-sm text-brand-deep">{data.invoice_number || 'DRAFT'}</div>
                </div>
                <div className="text-right">
                  <div className="text-workshop-muted">Job Card No:</div>
                  <div className="font-mono font-bold text-sm text-workshop-text">{data.job_card_number}</div>
                </div>
                <div>
                  <div className="text-workshop-muted">Customer:</div>
                  <div className="font-bold text-workshop-text">{data.customer?.name} ({data.customer?.phone})</div>
                </div>
                <div className="text-right">
                  <div className="text-workshop-muted">Vehicle:</div>
                  <div className="font-bold text-workshop-text">{data.vehicle?.make} {data.vehicle?.model} &bull; <span className="font-mono">{data.vehicle?.registration_number}</span></div>
                </div>
              </div>

              {/* Draft Estimate Adjustment Notice */}
              {data.status === 'DRAFT' && (
                <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-brand-deep">
                  💡 <b>Quotation / Draft Mode:</b> Use <b>Exclude</b> next to any line to remove items the customer declines, or <b>Include</b> to add them back. Totals recalculate immediately.
                </div>
              )}

              {/* Approved Parts Table */}
              <div>
                <span className="text-xs font-bold text-workshop-muted uppercase tracking-wider block mb-2">Parts / Materials</span>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-workshop-border text-workshop-muted">
                      <th className="text-left pb-1.5">Description</th>
                      <th className="text-right pb-1.5 w-16">Qty</th>
                      <th className="text-right pb-1.5 w-24">Amount</th>
                      {data.status === 'DRAFT' && <th className="text-right pb-1.5 w-20">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.approved_parts.map((p: any) => (
                      <tr key={p.id}>
                        <td className="py-2 font-medium">{p.description}</td>
                        <td className="py-2 text-right font-mono">{p.quantity} {p.unit}</td>
                        <td className="py-2 text-right font-mono font-semibold">{formatINR(p.total)}</td>
                        {data.status === 'DRAFT' && (
                          <td className="py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleToggleInvoiceItem('part', p.id, p.status)}
                              className="px-2 py-0.5 rounded bg-amber-50 hover:bg-red-50 text-amber-900 hover:text-red-700 border border-amber-200 hover:border-red-300 font-semibold text-[10px] cursor-pointer"
                              title="Exclude from billing"
                            >
                              Exclude
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {/* Recommended lines awaiting customer decision */}
                    {data.recommended_parts && data.recommended_parts.map((p: any) => (
                      <tr key={p.id} className="bg-amber-50/30">
                        <td className="py-2 font-medium">
                          {p.description}
                          <span className="block text-[10px] text-amber-700 italic">
                            Recommended — awaiting customer approval
                          </span>
                        </td>
                        <td className="py-2 text-right font-mono">{p.quantity} {p.unit}</td>
                        <td className="py-2 text-right font-mono font-semibold text-amber-800">{formatINR(p.total)}</td>
                        {data.status === 'DRAFT' && (
                          <td className="py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleToggleInvoiceItem('part', p.id, p.status)}
                              className="px-2 py-0.5 rounded bg-amber-50 hover:bg-red-50 text-amber-900 hover:text-red-700 border border-amber-200 hover:border-red-300 font-semibold text-[10px] cursor-pointer"
                              title="Exclude from billing"
                            >
                              Exclude
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {/* Excluded Rejected Lines */}
                    {data.rejected_parts && data.rejected_parts.map((p: any) => (
                      <tr key={p.id} className="text-gray-400 bg-red-50/20">
                        <td className="py-2 line-through">
                          {p.description}
                          <span className="block text-[10px] text-red-600 italic no-underline">
                            Customer rejected — excluded from billing
                          </span>
                        </td>
                        <td className="py-2 text-right font-mono line-through">{p.quantity} {p.unit}</td>
                        <td className="py-2 text-right font-mono line-through">{formatINR(p.total)}</td>
                        {data.status === 'DRAFT' && (
                          <td className="py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleToggleInvoiceItem('part', p.id, p.status)}
                              className="px-2 py-0.5 rounded bg-green-50 hover:bg-green-100 text-green-800 border border-green-300 font-semibold text-[10px] cursor-pointer"
                              title="Include back in billing"
                            >
                              Include
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    <tr className="font-bold border-t border-workshop-border">
                      <td colSpan={data.status === 'DRAFT' ? 3 : 2} className="py-2">
                        {data.status === 'DRAFT' && data.recommended_parts && data.recommended_parts.length > 0 ? 'Parts Estimate:' : 'Parts Total:'}
                      </td>
                      <td className="py-2 text-right font-mono text-brand-deep">{formatINR(data.parts_total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Approved Labour Table */}
              <div>
                <span className="text-xs font-bold text-workshop-muted uppercase tracking-wider block mb-2">Labour &amp; Services</span>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-workshop-border text-workshop-muted">
                      <th className="text-left pb-1.5">Description</th>
                      <th className="text-right pb-1.5 w-16">Qty</th>
                      <th className="text-right pb-1.5 w-24">Amount</th>
                      {data.status === 'DRAFT' && <th className="text-right pb-1.5 w-20">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.approved_labour.map((l: any) => (
                      <tr key={l.id}>
                        <td className="py-2 font-medium">{l.description}</td>
                        <td className="py-2 text-right font-mono">{l.quantity}</td>
                        <td className="py-2 text-right font-mono font-semibold">{formatINR(l.total)}</td>
                        {data.status === 'DRAFT' && (
                          <td className="py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleToggleInvoiceItem('labour', l.id, l.status)}
                              className="px-2 py-0.5 rounded bg-amber-50 hover:bg-red-50 text-amber-900 hover:text-red-700 border border-amber-200 hover:border-red-300 font-semibold text-[10px] cursor-pointer"
                              title="Exclude from billing"
                            >
                              Exclude
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {/* Recommended lines awaiting customer decision */}
                    {data.recommended_labour && data.recommended_labour.map((l: any) => (
                      <tr key={l.id} className="bg-amber-50/30">
                        <td className="py-2 font-medium">
                          {l.description}
                          <span className="block text-[10px] text-amber-700 italic">
                            Recommended — awaiting customer approval
                          </span>
                        </td>
                        <td className="py-2 text-right font-mono">{l.quantity}</td>
                        <td className="py-2 text-right font-mono font-semibold text-amber-800">{formatINR(l.total)}</td>
                        {data.status === 'DRAFT' && (
                          <td className="py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleToggleInvoiceItem('labour', l.id, l.status)}
                              className="px-2 py-0.5 rounded bg-amber-50 hover:bg-red-50 text-amber-900 hover:text-red-700 border border-amber-200 hover:border-red-300 font-semibold text-[10px] cursor-pointer"
                              title="Exclude from billing"
                            >
                              Exclude
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {/* Excluded Rejected Lines */}
                    {data.rejected_labour && data.rejected_labour.map((l: any) => (
                      <tr key={l.id} className="text-gray-400 bg-red-50/20">
                        <td className="py-2 line-through">
                          {l.description}
                          <span className="block text-[10px] text-red-600 italic no-underline">
                            Customer rejected — excluded from billing
                          </span>
                        </td>
                        <td className="py-2 text-right font-mono line-through">{l.quantity}</td>
                        <td className="py-2 text-right font-mono line-through">{formatINR(l.total)}</td>
                        {data.status === 'DRAFT' && (
                          <td className="py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleToggleInvoiceItem('labour', l.id, l.status)}
                              className="px-2 py-0.5 rounded bg-green-50 hover:bg-green-100 text-green-800 border border-green-300 font-semibold text-[10px] cursor-pointer"
                              title="Include back in billing"
                            >
                              Include
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    <tr className="font-bold border-t border-workshop-border">
                      <td colSpan={data.status === 'DRAFT' ? 3 : 2} className="py-2">
                        {data.status === 'DRAFT' && data.recommended_labour && data.recommended_labour.length > 0 ? 'Labour Estimate:' : 'Labour Total:'}
                      </td>
                      <td className="py-2 text-right font-mono text-brand-deep">{formatINR(data.labour_total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Other Charges & Discounts */}
              <div className="border-t border-workshop-border pt-3 space-y-1.5 text-xs">
                {data.other_charges.map((o: any) => (
                  <div key={o.id} className="flex justify-between items-center text-workshop-text">
                    <span>{o.description}:</span>
                    <span className="font-mono font-semibold">{formatINR(o.amount)}</span>
                  </div>
                ))}

                {data.discount > 0 && (
                  <div className="flex justify-between items-center text-workshop-red">
                    <span>Discount ({data.discount_reason || 'Applied'}):</span>
                    <span className="font-mono font-semibold">-{formatINR(data.discount)}</span>
                  </div>
                )}

                {/* Grand Total */}
                <div className="flex justify-between items-center text-base font-bold border-t-2 border-workshop-text pt-2 mt-2">
                  <span className="font-display tracking-wide text-lg">
                    {data.status === 'DRAFT' && ((data.recommended_parts && data.recommended_parts.length > 0) || (data.recommended_labour && data.recommended_labour.length > 0)) ? 'ESTIMATED TOTAL:' : 'GRAND TOTAL:'}
                  </span>
                  <span className="font-mono text-xl text-brand-deep">{formatINR(data.grand_total)}</span>
                </div>

                {/* Payment Breakdown */}
                {data.status === 'FINALIZED' ? (
                  <div className="border-t border-gray-200 pt-2 space-y-1">
                    <div className="flex justify-between text-workshop-muted">
                      <span>Amount Paid:</span>
                      <span className="font-mono font-semibold">{formatINR(data.amount_paid)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-sm text-workshop-text">
                      <span>Balance Due:</span>
                      <span className={`font-mono ${data.balance_due > 0 ? 'text-workshop-red' : 'text-workshop-green'}`}>
                        {formatINR(data.balance_due)}
                      </span>
                    </div>
                  </div>
                ) : data.amount_paid > 0 ? (
                  <div className="border-t border-gray-200 pt-2 space-y-1">
                    <div className="flex justify-between text-workshop-muted">
                      <span>Advance Received:</span>
                      <span className="font-mono font-semibold">{formatINR(data.amount_paid)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-sm text-workshop-text">
                      <span>Estimated Balance on Delivery:</span>
                      <span className="font-mono text-workshop-text font-semibold">
                        {formatINR(data.balance_due)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-gray-200 pt-2">
                    <div className="text-xs text-workshop-muted text-right italic">
                      Estimate mode &bull; Final settlement recorded upon job completion.
                    </div>
                  </div>
                )}

              </div>

              {/* Recorded Payments List */}
              {data.payments.length > 0 && (
                <div className="border-t border-workshop-border pt-3">
                  <span className="text-xs font-bold text-workshop-muted uppercase tracking-wider block mb-2">
                    Payment Receipts ({data.payment_status})
                  </span>
                  <div className="space-y-1.5 text-xs">
                    {data.payments.map((p: any) => {
                      const isRev = p.is_reversal;
                      const hasBeenReversed = data.payments.some((r: any) => r.is_reversal && r.reference === `REV-${p.id}`);
                      return (
                        <div
                          key={p.id}
                          className={`p-2 rounded-md border ${
                            isRev
                              ? 'bg-red-50/70 border-red-200 text-red-900'
                              : 'bg-green-50/60 border-green-200 text-green-900'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isRev ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'}`}>
                                {isRev ? 'REVERSAL' : p.method}
                              </span>
                              {p.reference && <span className="text-workshop-muted font-mono">Ref: {p.reference}</span>}
                              <span className="text-[11px] text-workshop-muted">{p.paid_at}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`font-mono font-bold ${isRev ? 'text-workshop-red' : 'text-green-900'}`}>
                                {isRev ? `-${formatINR(p.amount)}` : formatINR(p.amount)}
                              </span>
                              {!isRev && !hasBeenReversed && data.status !== 'VOID' && (
                                <button
                                  type="button"
                                  onClick={() => handleReversePayment(p.id)}
                                  className="px-2 py-0.5 bg-red-100 hover:bg-red-200 text-red-800 text-[10px] font-semibold rounded cursor-pointer transition"
                                  title="Reverse this payment entry"
                                >
                                  Reverse
                                </button>
                              )}
                            </div>
                          </div>
                          {p.note && <div className="text-[11px] opacity-80 italic mt-1">{p.note}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Modal Action Bar */}
        {data && (
          <div className="px-6 py-4 border-t border-workshop-border bg-gray-50 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <a
                href={getPdfUrl(`/invoices/${data.id}/pdf`)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-gray-100 border border-workshop-border text-workshop-text font-semibold text-xs rounded-lg transition shadow-2xs cursor-pointer"
              >
                <Printer className="w-4 h-4 text-workshop-muted" /> Print / Save PDF
              </a>

              <button
                type="button"
                onClick={() => {
                  if (!data) return;
                  const isPaid = data.balance_due <= 0;
                  let msg = '';
                  if (isPaid) {
                    setWhatsAppTitle('Share Payment Receipt on WhatsApp');
                    msg = buildInvoiceReceiptMessage({
                      customerName: data.customer?.name || 'Customer',
                      vehicleReg: data.vehicle?.registration_number || '',
                      vehicleModel: `${data.vehicle?.make || ''} ${data.vehicle?.model || ''}`.trim(),
                      invoiceNo: data.invoice_number,
                      amountPaidPaise: data.amount_paid,
                      balanceDuePaise: data.balance_due,
                      paymentMethod: data.payments && data.payments.length > 0 ? data.payments[data.payments.length - 1].method : 'UPI/Cash',
                      paymentDate: data.payments && data.payments.length > 0 ? data.payments[data.payments.length - 1].paid_at : new Date().toLocaleDateString('en-IN'),
                      workshop
                    });
                  } else {
                    setWhatsAppTitle('Share Invoice Bill & UPI Link on WhatsApp');
                    msg = buildReadyForDeliveryMessage({
                      customerName: data.customer?.name || 'Customer',
                      vehicleReg: data.vehicle?.registration_number || '',
                      vehicleModel: `${data.vehicle?.make || ''} ${data.vehicle?.model || ''}`.trim(),
                      invoiceNo: data.invoice_number,
                      grandTotalPaise: data.grand_total,
                      balanceDuePaise: data.balance_due,
                      workshop
                    });
                  }
                  setWhatsAppMessage(msg);
                  setShowWhatsAppModal(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#25D366] hover:bg-[#1DA851] text-white font-bold text-xs rounded-lg transition shadow-2xs cursor-pointer"
                title="Share bill / receipt on WhatsApp"
              >
                <MessageCircle className="w-4 h-4 fill-white" /> Share on WhatsApp
              </button>

              {data.status === 'DRAFT' && (
                <>
                  <button
                    onClick={() => setShowChargeModal(true)}
                    className="px-3 py-2 bg-white hover:bg-gray-100 border border-workshop-border text-workshop-text font-semibold text-xs rounded-lg transition"
                  >
                    + Add Charge
                  </button>
                  <button
                    onClick={() => setShowDiscountModal(true)}
                    className="px-3 py-2 bg-white hover:bg-gray-100 border border-workshop-border text-workshop-text font-semibold text-xs rounded-lg transition"
                  >
                    Apply Discount
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {data.status === 'DRAFT' && (
                <button
                  onClick={handleFinalize}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-brand hover:bg-brand-deep text-white font-bold text-xs rounded-lg shadow-sm transition cursor-pointer"
                >
                  <Lock className="w-4 h-4" /> Finalise Invoice
                </button>
              )}

              {data.status === 'FINALIZED' && data.balance_due > 0 && (
                <button
                  onClick={() => setShowPayModal(true)}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-workshop-green hover:opacity-90 text-white font-bold text-xs rounded-lg shadow-sm transition cursor-pointer"
                >
                  <IndianRupee className="w-4 h-4" /> Record Payment
                </button>
              )}

              {data.status === 'FINALIZED' && user?.role === 'ADMIN' && (
                <button
                  onClick={() => setShowVoidModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-red-50 text-workshop-red border border-red-200 font-semibold text-xs rounded-lg transition cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" /> Void Invoice
                </button>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Record Payment Sub-Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-60 overflow-y-auto overscroll-contain bg-black/60 p-4 flex flex-col items-center justify-center">
          <form onSubmit={handleRecordPayment} className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full space-y-4 my-auto shrink-0">
            <h4 className="font-bold text-base text-workshop-text">Record Customer Payment</h4>
            <div>
              <label className="block text-xs font-semibold text-workshop-text mb-1">Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={payAmount}
                onChange={(e) => setPayAmount(Number(e.target.value))}
                max={data?.balance_due / 100}
                className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm font-mono"
              />
              <span className="text-[11px] text-workshop-muted">
                Outstanding: {formatINR(data?.balance_due)}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-workshop-text mb-1">Payment Method *</label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm bg-white"
              >
                <option value="UPI">UPI (Google Pay, PhonePe, Paytm)</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Credit / Debit Card</option>
                <option value="BANK_TRANSFER">Bank Transfer (NEFT/IMPS)</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-workshop-text mb-1">Reference / UTR #</label>
              <input
                type="text"
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                placeholder="e.g. UPI UTR 987654321012"
                className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-workshop-text mb-1">Payment Note / Remarks (Optional)</label>
              <input
                type="text"
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="e.g. Advance paid, balance on delivery"
                className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="px-3.5 py-1.5 border border-workshop-border rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-workshop-green text-white font-bold rounded-lg text-xs"
              >
                Confirm Payment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Other Charge Sub-Modal */}
      {showChargeModal && (
        <div className="fixed inset-0 z-60 overflow-y-auto overscroll-contain bg-black/60 p-4 flex flex-col items-center justify-center">
          <form onSubmit={handleAddCharge} className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full space-y-4 my-auto shrink-0">
            <h4 className="font-bold text-base text-workshop-text">Add Other Charge</h4>
            <div>
              <label className="block text-xs font-semibold text-workshop-text mb-1">Description *</label>
              <input
                type="text"
                required
                value={chargeDesc}
                onChange={(e) => setChargeDesc(e.target.value)}
                placeholder="e.g. Consumables, Washing"
                className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-workshop-text mb-1">Amount (₹) *</label>
              <input
                type="number"
                required
                value={chargeAmount}
                onChange={(e) => setChargeAmount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm font-mono"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowChargeModal(false)}
                className="px-3.5 py-1.5 border border-workshop-border rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-brand text-white font-bold rounded-lg text-xs"
              >
                Add Charge
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Discount Sub-Modal */}
      {showDiscountModal && (
        <div className="fixed inset-0 z-60 overflow-y-auto overscroll-contain bg-black/60 p-4 flex flex-col items-center justify-center">
          <form onSubmit={handleApplyDiscount} className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full space-y-4 my-auto shrink-0">
            <h4 className="font-bold text-base text-workshop-text">Apply Invoice Discount</h4>
            <div>
              <label className="block text-xs font-semibold text-workshop-text mb-1">Discount Amount (₹) *</label>
              <input
                type="number"
                required
                value={discountAmt}
                onChange={(e) => setDiscountAmt(Number(e.target.value))}
                className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-workshop-text mb-1">Reason</label>
              <input
                type="text"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                placeholder="e.g. Festive promotion"
                className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDiscountModal(false)}
                className="px-3.5 py-1.5 border border-workshop-border rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-brand text-white font-bold rounded-lg text-xs"
              >
                Apply Discount
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Void Sub-Modal */}
      {showVoidModal && (
        <div className="fixed inset-0 z-60 overflow-y-auto overscroll-contain bg-black/60 p-4 flex flex-col items-center justify-center">
          <form onSubmit={handleVoidInvoice} className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full space-y-4 my-auto shrink-0">
            <h4 className="font-bold text-base text-red-700">Void Invoice ({data?.invoice_number})</h4>
            <p className="text-xs text-workshop-muted">
              Voiding an invoice locks it permanently and marks it for audit. The invoice number is retained and never reused.
            </p>
            <div>
              <label className="block text-xs font-semibold text-workshop-text mb-1">Mandatory Reason *</label>
              <textarea
                rows={2}
                required
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Reason for voiding..."
                className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowVoidModal(false)}
                className="px-3.5 py-1.5 border border-workshop-border rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-workshop-red text-white font-bold rounded-lg text-xs"
              >
                Confirm Void
              </button>
            </div>
          </form>
        </div>
      )}


      {/* WhatsApp Bill / Receipt Modal */}
      {data && (
        <WhatsAppPreviewModal
          isOpen={showWhatsAppModal}
          onClose={() => setShowWhatsAppModal(false)}
          title={whatsAppTitle}
          customerName={data.customer?.name || 'Customer'}
          customerPhone={data.customer?.phone || ''}
          initialMessage={whatsAppMessage}
        />
      )}

    </div>
  );
};

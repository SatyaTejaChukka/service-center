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
  CalendarClock,
  MessageCircle,
  ChevronDown,
  Plus,
  Trash2,
  Ban,
  UserCheck,
  RefreshCw
} from 'lucide-react';
import { apiRequest, getPdfUrl } from '../lib/api';
import { formatINR, formatDate } from '../lib/formatters';
import { useAuth } from '../context/AuthContext';
import { WhatsAppPreviewModal } from '../components/common/WhatsAppPreviewModal';
import {
  buildEstimateApprovalMessage,
  buildReadyForDeliveryMessage,
  buildJobCardIntakeMessage
} from '../lib/whatsapp';

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
  const { user, workshop } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Catalogs
  const [labourCatalog, setLabourCatalog] = useState<any[]>([]);
  const [partsCatalog, setPartsCatalog] = useState<any[]>([]);

  useEffect(() => {
    apiRequest<any[]>('/catalogs/labour').then(setLabourCatalog).catch(() => {});
    apiRequest<any[]>('/catalogs/parts').then(setPartsCatalog).catch(() => {});
  }, []);

  // Status transition state
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  // Add Labour Modal state
  const [showAddLabourModal, setShowAddLabourModal] = useState(false);
  const [labourDesc, setLabourDesc] = useState('');
  const [labourRate, setLabourRate] = useState<number>(500);
  const [labourQty, setLabourQty] = useState<number>(1);
  const [labourStatus, setLabourStatus] = useState<string>('RECOMMENDED');
  const [labourCatalogId, setLabourCatalogId] = useState<number | undefined>(undefined);

  // Add Part Modal state
  const [showAddPartModal, setShowAddPartModal] = useState(false);
  const [partDesc, setPartDesc] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [partUnit, setPartUnit] = useState('pcs');
  const [partPrice, setPartPrice] = useState<number>(500);
  const [partQty, setPartQty] = useState<number>(1);
  const [partStatus, setPartStatus] = useState<string>('RECOMMENDED');
  const [partCatalogId, setPartCatalogId] = useState<number | undefined>(undefined);

  // Customer Approval Modal state
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalName, setApprovalName] = useState('');
  const [approvalMethod, setApprovalMethod] = useState('WHATSAPP');
  const [approvalNote, setApprovalNote] = useState('');
  const [approvalsMap, setApprovalsMap] = useState<Record<string, boolean>>({});

  // WhatsApp modal state
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppTitle, setWhatsAppTitle] = useState('');
  const [whatsAppMessage, setWhatsAppMessage] = useState('');
  const [showWhatsAppDropdown, setShowWhatsAppDropdown] = useState(false);

  const handleOpenWhatsAppEstimate = () => {
    if (!data) return;
    const partsPaise = data.parts_items?.reduce((sum: number, p: any) => p.status !== 'REJECTED' ? sum + p.total : sum, 0) || 0;
    const labourPaise = data.labour_items?.reduce((sum: number, l: any) => l.status !== 'REJECTED' ? sum + l.total : sum, 0) || 0;
    const otherPaise = data.invoice?.other_charges_total || 0;
    const discountPaise = data.invoice?.discount || 0;
    const grandTotalPaise = Math.max(0, partsPaise + labourPaise + otherPaise - discountPaise);

    // Build work summary list for customer clarity
    const itemsList: string[] = [];
    data.labour_items?.filter((l: any) => l.status !== 'REJECTED').forEach((l: any) => {
      itemsList.push(`• ${l.description} (${formatINR(l.total)})`);
    });
    data.parts_items?.filter((p: any) => p.status !== 'REJECTED').forEach((p: any) => {
      itemsList.push(`• ${p.description} [${p.quantity} ${p.unit}] (${formatINR(p.total)})`);
    });
    const workSummary = itemsList.join('\n');

    const msg = buildEstimateApprovalMessage({
      customerName: data.customer.name,
      vehicleReg: data.vehicle.registration_number,
      vehicleModel: `${data.vehicle.make || ''} ${data.vehicle.model || ''}`.trim(),
      jobCardNo: data.job_card_number,
      grandTotalPaise: grandTotalPaise,
      labourTotalPaise: labourPaise,
      partsTotalPaise: partsPaise,
      otherChargesPaise: otherPaise,
      workSummary,
      workshop
    });
    setWhatsAppTitle('Send Estimate for Customer Approval');
    setWhatsAppMessage(msg);
    setShowWhatsAppModal(true);
    setShowWhatsAppDropdown(false);
  };

  const handleOpenWhatsAppReady = () => {
    if (!data) return;
    const paid = data.invoice?.payments ? Math.max(0, data.invoice.payments.reduce((sum: number, p: any) => p.is_reversal ? sum - p.amount : sum + p.amount, 0)) : 0;
    const grand = data.invoice?.grand_total || 0;
    const balanceDue = Math.max(0, grand - paid);

    const msg = buildReadyForDeliveryMessage({
      customerName: data.customer.name,
      vehicleReg: data.vehicle.registration_number,
      vehicleModel: `${data.vehicle.make || ''} ${data.vehicle.model || ''}`.trim(),
      invoiceNo: data.invoice?.invoice_number || undefined,
      grandTotalPaise: grand,
      balanceDuePaise: balanceDue,
      workshop
    });
    setWhatsAppTitle('Send Ready for Delivery & UPI Link');
    setWhatsAppMessage(msg);
    setShowWhatsAppModal(true);
    setShowWhatsAppDropdown(false);
  };

  const handleOpenWhatsAppIntake = () => {
    if (!data) return;
    const msg = buildJobCardIntakeMessage({
      customerName: data.customer.name,
      vehicleReg: data.vehicle.registration_number,
      vehicleModel: `${data.vehicle.make || ''} ${data.vehicle.model || ''}`.trim(),
      jobCardNo: data.job_card_number,
      date: data.date,
      odometer: data.odometer,
      fuelLevel: data.fuel_level,
      complaints: data.complaints?.map((c: any) => c.description),
      workshop
    });
    setWhatsAppTitle('Send Intake Gatepass on WhatsApp');
    setWhatsAppMessage(msg);
    setShowWhatsAppModal(true);
    setShowWhatsAppDropdown(false);
  };

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

  const handleToggleLabourStatus = async (l: any) => {
    try {
      const nextStatus = l.status === 'REJECTED' ? 'APPROVED' : 'REJECTED';
      await apiRequest(`/job-cards/${jobCardId}/labour-items/${l.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      fetchDetail();
    } catch (err: any) {
      alert(err.message || 'Failed to update service item');
    }
  };

  const handleDeleteLabour = async (lid: number) => {
    if (!window.confirm('Are you sure you want to remove this service line from the job card?')) return;
    try {
      await apiRequest(`/job-cards/${jobCardId}/labour-items/${lid}`, {
        method: 'DELETE',
      });
      fetchDetail();
    } catch (err: any) {
      alert(err.message || 'Failed to remove service item');
    }
  };

  const handleTogglePartStatus = async (p: any) => {
    try {
      const nextStatus = p.status === 'REJECTED' ? 'APPROVED' : 'REJECTED';
      await apiRequest(`/job-cards/${jobCardId}/parts-items/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      fetchDetail();
    } catch (err: any) {
      alert(err.message || 'Failed to update part item');
    }
  };

  const handleDeletePart = async (pid: number) => {
    if (!window.confirm('Are you sure you want to remove this part item from the job card?')) return;
    try {
      await apiRequest(`/job-cards/${jobCardId}/parts-items/${pid}`, {
        method: 'DELETE',
      });
      fetchDetail();
    } catch (err: any) {
      alert(err.message || 'Failed to remove part item');
    }
  };

  const handleAddLabour = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labourDesc.trim()) return;
    try {
      await apiRequest(`/job-cards/${jobCardId}/labour-items`, {
        method: 'POST',
        body: JSON.stringify({
          description: labourDesc.trim(),
          quantity: Number(labourQty) || 1,
          unit_price: Math.round(labourRate * 100),
          status: labourStatus,
          catalog_id: labourCatalogId || undefined,
        }),
      });
      setLabourDesc('');
      setLabourRate(500);
      setLabourQty(1);
      setLabourCatalogId(undefined);
      setShowAddLabourModal(false);
      fetchDetail();
    } catch (err: any) {
      alert(err.message || 'Failed to add service item');
    }
  };

  const handleAddPart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partDesc.trim()) return;
    try {
      await apiRequest(`/job-cards/${jobCardId}/parts-items`, {
        method: 'POST',
        body: JSON.stringify({
          description: partDesc.trim(),
          part_number: partNumber.trim() || undefined,
          unit: partUnit,
          quantity: Number(partQty) || 1,
          unit_price: Math.round(partPrice * 100),
          status: partStatus,
          catalog_id: partCatalogId || undefined,
        }),
      });
      setPartDesc('');
      setPartNumber('');
      setPartPrice(500);
      setPartQty(1);
      setPartUnit('pcs');
      setPartCatalogId(undefined);
      setShowAddPartModal(false);
      fetchDetail();
    } catch (err: any) {
      alert(err.message || 'Failed to add part item');
    }
  };

  const handleOpenApprovalModal = () => {
    if (!data) return;
    setApprovalName(data.customer?.name || '');
    const map: Record<string, boolean> = {};
    data.labour_items?.forEach((l: any) => {
      map[`l_${l.id}`] = l.status !== 'REJECTED';
    });
    data.parts_items?.forEach((p: any) => {
      map[`p_${p.id}`] = p.status !== 'REJECTED';
    });
    setApprovalsMap(map);
    setShowApprovalModal(true);
  };

  const handleRecordApprovalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvalName.trim()) {
      alert('Please provide customer/approver name');
      return;
    }
    const line_approvals: any[] = [];
    data.labour_items?.forEach((l: any) => {
      line_approvals.push({
        type: 'labour',
        id: l.id,
        status: approvalsMap[`l_${l.id}`] ? 'APPROVED' : 'REJECTED',
      });
    });
    data.parts_items?.forEach((p: any) => {
      line_approvals.push({
        type: 'part',
        id: p.id,
        status: approvalsMap[`p_${p.id}`] ? 'APPROVED' : 'REJECTED',
      });
    });

    try {
      await apiRequest(`/job-cards/${jobCardId}/approvals`, {
        method: 'POST',
        body: JSON.stringify({
          approved_by_name: approvalName.trim(),
          method: approvalMethod,
          note: approvalNote.trim() || undefined,
          line_approvals,
        }),
      });
      setShowApprovalModal(false);
      fetchDetail();
    } catch (err: any) {
      alert(err.message || 'Failed to record customer approvals');
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
  const canEditItems = !isCancelled && !isCompleted && data.invoice?.status !== 'FINALIZED';

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

          {/* WhatsApp Communications Split Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowWhatsAppDropdown(!showWhatsAppDropdown)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#25D366] hover:bg-[#1DA851] text-white font-bold text-xs rounded-lg transition shadow-2xs cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5 fill-white" />
              WhatsApp
              <ChevronDown className="w-3 h-3 ml-0.5" />
            </button>

            {showWhatsAppDropdown && (
              <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-workshop-border py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={handleOpenWhatsAppEstimate}
                  className="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex flex-col text-xs cursor-pointer"
                >
                  <span className="font-bold text-workshop-text">📑 Send Service Estimate</span>
                  <span className="text-[10px] text-workshop-muted">Send quote for 1-click customer approval</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenWhatsAppReady}
                  className="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex flex-col text-xs cursor-pointer border-t border-gray-100"
                >
                  <span className="font-bold text-workshop-text">✅ Send Ready for Pickup</span>
                  <span className="text-[10px] text-workshop-muted">Include bill summary &amp; direct UPI pay link</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenWhatsAppIntake}
                  className="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex flex-col text-xs cursor-pointer border-t border-gray-100"
                >
                  <span className="font-bold text-workshop-text">🚗 Send Intake Gatepass</span>
                  <span className="text-[10px] text-workshop-muted">Check-in confirmation with recorded complaints</span>
                </button>
              </div>
            )}
          </div>

          {canEditItems && (
            <button
              type="button"
              onClick={handleOpenApprovalModal}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-lg transition shadow-2xs cursor-pointer"
              title="Record customer approvals or exclusions across all line items"
            >
              <UserCheck className="w-3.5 h-3.5" /> Customer Decisions
            </button>
          )}

          {data.invoice && (
            <button
              onClick={() => onNavigateToInvoice(data.invoice.id)}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-deep text-white font-semibold text-xs rounded-lg shadow-sm transition cursor-pointer"
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
        <div className="p-4 border-b border-workshop-border flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-sm text-workshop-text">Service Work &amp; Parts Breakdown</h3>
            <span className="text-xs text-workshop-muted font-medium hidden sm:inline">
              (Only Approved/Used lines contribute to billing totals)
            </span>
          </div>
          <button
            type="button"
            onClick={handleOpenWhatsAppEstimate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] hover:bg-[#1DA851] text-white font-bold text-xs rounded-lg transition shadow-2xs cursor-pointer"
            title="Send estimate to customer via WhatsApp for 1-click approval"
          >
            <MessageCircle className="w-3.5 h-3.5 fill-white" /> Send Estimate on WhatsApp
          </button>
        </div>

        <div className="p-4 space-y-6">
          
          {/* Labour Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-workshop-muted uppercase tracking-wider">Labour / Services</span>
              {canEditItems && (
                <button
                  type="button"
                  onClick={() => setShowAddLabourModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-brand hover:bg-brand-deep text-white font-semibold text-xs rounded-md shadow-2xs transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Service
                </button>
              )}
            </div>
            <table className="w-full text-left text-xs border border-workshop-border rounded-lg overflow-hidden">
              <thead className="bg-[#F8FAFC] border-b border-workshop-border text-workshop-muted uppercase">
                <tr>
                  <th className="p-2.5">Description</th>
                  <th className="p-2.5 text-center">Status</th>
                  <th className="p-2.5 text-right">Qty</th>
                  <th className="p-2.5 text-right">Rate</th>
                  <th className="p-2.5 text-right">Line Total</th>
                  {canEditItems && <th className="p-2.5 text-right w-36">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-workshop-border-soft">
                {data.labour_items.map((l: any) => {
                  const isRejected = l.status === 'REJECTED';
                  const isRecommended = l.status === 'RECOMMENDED';
                  return (
                    <tr key={l.id} className={isRejected ? 'bg-red-50/30 text-workshop-muted' : isRecommended ? 'bg-amber-50/20' : ''}>
                      <td className="p-2.5 font-medium">
                        <span className={isRejected ? 'line-through text-gray-400' : ''}>{l.description}</span>
                        {isRecommended && (
                          <div className="text-[10px] text-amber-700 italic">
                            Recommended — awaiting customer approval
                          </div>
                        )}
                        {isRejected && (
                          <div className="text-[10px] text-red-600 italic">
                            Customer rejected — excluded from billing
                          </div>
                        )}
                      </td>
                      <td className="p-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          l.status === 'APPROVED' || l.status === 'DONE'
                            ? 'bg-green-100 text-green-800'
                            : isRecommended
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {l.status}
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-mono">{l.quantity}</td>
                      <td className="p-2.5 text-right font-mono">{formatINR(l.unit_price)}</td>
                      <td className="p-2.5 text-right font-mono font-bold">
                        <span className={isRejected ? 'line-through text-gray-400' : ''}>{formatINR(l.total)}</span>
                      </td>
                      {canEditItems && (
                        <td className="p-2.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {isRejected ? (
                              <button
                                type="button"
                                onClick={() => handleToggleLabourStatus(l)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-50 hover:bg-green-100 text-green-800 border border-green-300 font-semibold text-[11px] transition cursor-pointer"
                                title="Include this service in billable work"
                              >
                                <Check className="w-3 h-3" /> Include
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleLabourStatus(l)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-50 hover:bg-red-50 text-amber-900 hover:text-red-700 border border-amber-200 hover:border-red-300 font-semibold text-[11px] transition cursor-pointer"
                                title="Exclude this service from work & billing"
                              >
                                <Ban className="w-3 h-3" /> Exclude
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteLabour(l.id)}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                              title="Delete service line"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Parts Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-workshop-muted uppercase tracking-wider">Parts / Materials</span>
              {canEditItems && (
                <button
                  type="button"
                  onClick={() => setShowAddPartModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-brand hover:bg-brand-deep text-white font-semibold text-xs rounded-md shadow-2xs transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Part
                </button>
              )}
            </div>
            <table className="w-full text-left text-xs border border-workshop-border rounded-lg overflow-hidden">
              <thead className="bg-[#F8FAFC] border-b border-workshop-border text-workshop-muted uppercase">
                <tr>
                  <th className="p-2.5">Part Name</th>
                  <th className="p-2.5">Unit</th>
                  <th className="p-2.5 text-center">Status</th>
                  <th className="p-2.5 text-right">Qty</th>
                  <th className="p-2.5 text-right">Rate</th>
                  <th className="p-2.5 text-right">Line Total</th>
                  {canEditItems && <th className="p-2.5 text-right w-36">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-workshop-border-soft">
                {data.parts_items.map((p: any) => {
                  const isRejected = p.status === 'REJECTED';
                  const isRecommended = p.status === 'RECOMMENDED';
                  return (
                    <tr key={p.id} className={isRejected ? 'bg-red-50/30 text-workshop-muted' : isRecommended ? 'bg-amber-50/20' : ''}>
                      <td className="p-2.5 font-medium">
                        <span className={isRejected ? 'line-through text-gray-400' : ''}>{p.description}</span>
                        {p.part_number && <span className="text-gray-400 font-mono ml-1">({p.part_number})</span>}
                        {isRecommended && (
                          <div className="text-[10px] text-amber-700 italic">
                            Recommended — awaiting customer approval
                          </div>
                        )}
                        {isRejected && (
                          <div className="text-[10px] text-red-600 italic">
                            Customer rejected — excluded from billing
                          </div>
                        )}
                      </td>
                      <td className="p-2.5">{p.unit}</td>
                      <td className="p-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.status === 'APPROVED' || p.status === 'USED'
                            ? 'bg-green-100 text-green-800'
                            : isRecommended
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-mono">{p.quantity}</td>
                      <td className="p-2.5 text-right font-mono">{formatINR(p.unit_price)}</td>
                      <td className="p-2.5 text-right font-mono font-bold">
                        <span className={isRejected ? 'line-through text-gray-400' : ''}>{formatINR(p.total)}</span>
                      </td>
                      {canEditItems && (
                        <td className="p-2.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {isRejected ? (
                              <button
                                type="button"
                                onClick={() => handleTogglePartStatus(p)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-50 hover:bg-green-100 text-green-800 border border-green-300 font-semibold text-[11px] transition cursor-pointer"
                                title="Include this part in billable work"
                              >
                                <Check className="w-3 h-3" /> Include
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleTogglePartStatus(p)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-50 hover:bg-red-50 text-amber-900 hover:text-red-700 border border-amber-200 hover:border-red-300 font-semibold text-[11px] transition cursor-pointer"
                                title="Exclude this part from work & billing"
                              >
                                <Ban className="w-3 h-3" /> Exclude
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeletePart(p.id)}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                              title="Delete part line"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Authoritative Totals Summary Box */}
          {data.invoice && (() => {
            const hasPendingRecommendations =
              data.labour_items?.some((l: any) => l.status === 'RECOMMENDED') ||
              data.parts_items?.some((p: any) => p.status === 'RECOMMENDED');
            
            const estSummary = data.estimate_summary;
            const estParts = estSummary ? estSummary.estimated_parts_total : data.invoice.parts_total;
            const estLabour = estSummary ? estSummary.estimated_labour_total : data.invoice.labour_total;
            const estGrand = estSummary ? estSummary.estimated_grand_total : data.invoice.grand_total;
            const approvedGrand = estSummary ? estSummary.approved_grand_total : data.invoice.grand_total;

            const paidAmount = data.invoice.payments
              ? Math.max(0, data.invoice.payments.reduce((sum: number, p: any) => p.is_reversal ? sum - p.amount : sum + p.amount, 0))
              : 0;
            const balanceDue = Math.max(0, data.invoice.grand_total - paidAmount);

            return (
              <div className="p-4 bg-gray-50 border border-workshop-border rounded-xl space-y-1.5 max-w-sm ml-auto text-xs">
                {hasPendingRecommendations ? (
                  <>
                    <div className="flex items-center justify-between pb-1 border-b border-workshop-border text-amber-800 font-semibold">
                      <span>Quotation / Estimate Mode</span>
                      <span className="text-[10px] bg-amber-100 px-2 py-0.5 rounded-full font-bold">Pending Approval</span>
                    </div>
                    <div className="flex justify-between text-workshop-muted pt-1">
                      <span>Parts Estimate:</span>
                      <span className="font-mono font-semibold">{formatINR(estParts)}</span>
                    </div>
                    <div className="flex justify-between text-workshop-muted">
                      <span>Labour Estimate:</span>
                      <span className="font-mono font-semibold">{formatINR(estLabour)}</span>
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
                      <span>Estimated Grand Total:</span>
                      <span className="font-mono text-brand-deep text-base">{formatINR(estGrand)}</span>
                    </div>
                    {approvedGrand > 0 && approvedGrand !== estGrand && (
                      <div className="flex justify-between text-xs text-workshop-green pt-1 border-t border-dashed border-gray-200">
                        <span>Approved Work so far:</span>
                        <span className="font-mono font-bold">{formatINR(approvedGrand)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[11px] text-workshop-muted pt-1">
                      <span>Invoice State:</span>
                      <span className="font-bold text-amber-700">DRAFT ESTIMATE</span>
                    </div>
                  </>
                ) : (
                  <>
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
                    {paidAmount > 0 && (
                      <div className="flex justify-between text-workshop-green">
                        <span>Amount Paid:</span>
                        <span className="font-mono font-semibold">{formatINR(paidAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs font-bold pt-1 border-t border-gray-200">
                      <span>Balance Due:</span>
                      <span className={`font-mono ${balanceDue > 0 ? 'text-workshop-red' : 'text-workshop-green'}`}>
                        {formatINR(balanceDue)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-workshop-muted pt-1">
                      <span>Payment Status:</span>
                      <span className="font-bold text-workshop-green">{data.invoice.payment_status}</span>
                    </div>
                  </>
                )}
              </div>
            );
          })()}

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

      {/* WhatsApp Communication Modal */}
      {data && (
        <WhatsAppPreviewModal
          isOpen={showWhatsAppModal}
          onClose={() => setShowWhatsAppModal(false)}
          title={whatsAppTitle}
          customerName={data.customer?.name || 'Customer'}
          customerPhone={data.customer?.phone || ''}
          altPhone={data.customer?.alt_phone}
          initialMessage={whatsAppMessage}
        />
      )}
      {/* Add Labour Item Modal */}
      {showAddLabourModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-workshop-border p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-workshop-border pb-3">
              <h3 className="font-bold text-base text-workshop-text flex items-center gap-2">
                <Wrench className="w-4 h-4 text-brand" /> Add Service / Labour
              </h3>
              <button
                type="button"
                onClick={() => setShowAddLabourModal(false)}
                className="p-1 text-workshop-muted hover:bg-gray-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddLabour} className="space-y-3.5 text-xs">
              {labourCatalog.length > 0 && (
                <div>
                  <label className="block font-semibold text-workshop-text mb-1">Pick from Catalog (Optional)</label>
                  <select
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs bg-white"
                    onChange={(e) => {
                      const sel = labourCatalog.find((c) => c.id === Number(e.target.value));
                      if (sel) {
                        setLabourDesc(sel.name);
                        setLabourRate(sel.default_rate / 100);
                        setLabourCatalogId(sel.id);
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="">-- Choose from standard services --</option>
                    {labourCatalog.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({formatINR(c.default_rate)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-workshop-text mb-1">Service Description *</label>
                <input
                  type="text"
                  required
                  value={labourDesc}
                  onChange={(e) => setLabourDesc(e.target.value)}
                  placeholder="e.g. Wheel Alignment, Brake Service"
                  className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-workshop-text mb-1">Qty / Units</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={labourQty}
                    onChange={(e) => setLabourQty(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-workshop-text mb-1">Rate (₹) *</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={labourRate}
                    onChange={(e) => setLabourRate(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-workshop-text mb-1">Initial Status</label>
                <select
                  value={labourStatus}
                  onChange={(e) => setLabourStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs bg-white"
                >
                  <option value="RECOMMENDED">RECOMMENDED (Requires Customer Approval)</option>
                  <option value="APPROVED">APPROVED (Authorized for Billable Work)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddLabourModal(false)}
                  className="px-4 py-2 border border-workshop-border rounded-lg text-xs font-semibold hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand text-white rounded-lg text-xs font-bold hover:bg-brand-deep shadow-xs cursor-pointer"
                >
                  Add Service Line
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Part Item Modal */}
      {showAddPartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-workshop-border p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-workshop-border pb-3">
              <h3 className="font-bold text-base text-workshop-text flex items-center gap-2">
                <Package className="w-4 h-4 text-brand" /> Add Part / Material
              </h3>
              <button
                type="button"
                onClick={() => setShowAddPartModal(false)}
                className="p-1 text-workshop-muted hover:bg-gray-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddPart} className="space-y-3.5 text-xs">
              {partsCatalog.length > 0 && (
                <div>
                  <label className="block font-semibold text-workshop-text mb-1">Pick from Catalog (Optional)</label>
                  <select
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs bg-white"
                    onChange={(e) => {
                      const sel = partsCatalog.find((c) => c.id === Number(e.target.value));
                      if (sel) {
                        setPartDesc(sel.name);
                        setPartNumber(sel.part_number || '');
                        setPartUnit(sel.unit || 'pcs');
                        setPartPrice(sel.default_price / 100);
                        setPartCatalogId(sel.id);
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="">-- Choose from catalog parts --</option>
                    {partsCatalog.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.part_number ? `(${c.part_number})` : ''} - {formatINR(c.default_price)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-workshop-text mb-1">Part Name / Description *</label>
                <input
                  type="text"
                  required
                  value={partDesc}
                  onChange={(e) => setPartDesc(e.target.value)}
                  placeholder="e.g. Engine Oil, Brake Pad Set"
                  className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-workshop-text mb-1">Part Number (Optional)</label>
                  <input
                    type="text"
                    value={partNumber}
                    onChange={(e) => setPartNumber(e.target.value)}
                    placeholder="e.g. 5W30-SYN"
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-workshop-text mb-1">Unit</label>
                  <select
                    value={partUnit}
                    onChange={(e) => setPartUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs bg-white"
                  >
                    <option value="pcs">pcs</option>
                    <option value="litre">litre</option>
                    <option value="set">set</option>
                    <option value="can">can</option>
                    <option value="box">box</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-workshop-text mb-1">Quantity *</label>
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    required
                    value={partQty}
                    onChange={(e) => setPartQty(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-workshop-text mb-1">Unit Price (₹) *</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={partPrice}
                    onChange={(e) => setPartPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-workshop-text mb-1">Initial Status</label>
                <select
                  value={partStatus}
                  onChange={(e) => setPartStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs bg-white"
                >
                  <option value="RECOMMENDED">RECOMMENDED (Requires Customer Approval)</option>
                  <option value="APPROVED">APPROVED (Authorized for Billable Work)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddPartModal(false)}
                  className="px-4 py-2 border border-workshop-border rounded-lg text-xs font-semibold hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand text-white rounded-lg text-xs font-bold hover:bg-brand-deep shadow-xs cursor-pointer"
                >
                  Add Part Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Decisions & Approvals Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-workshop-border p-6 max-w-lg w-full space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-workshop-border pb-3 shrink-0">
              <div>
                <h3 className="font-bold text-base text-workshop-text flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-brand" /> Customer Approval Decisions
                </h3>
                <p className="text-[11px] text-workshop-muted">
                  Check items customer approved; uncheck items customer decided to exclude.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowApprovalModal(false)}
                className="p-1 text-workshop-muted hover:bg-gray-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordApprovalSubmit} className="space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-workshop-text mb-1">Customer / Decision Maker *</label>
                  <input
                    type="text"
                    required
                    value={approvalName}
                    onChange={(e) => setApprovalName(e.target.value)}
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-workshop-text mb-1">Approval Channel</label>
                  <select
                    value={approvalMethod}
                    onChange={(e) => setApprovalMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs bg-white"
                  >
                    <option value="WHATSAPP">WhatsApp Message</option>
                    <option value="PHONE">Phone Call</option>
                    <option value="IN_PERSON">In Person / Workshop Counter</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              {/* Items checklist */}
              <div className="space-y-3">
                <div>
                  <span className="font-bold text-workshop-muted uppercase tracking-wider block mb-1 text-[11px]">
                    Labour / Services
                  </span>
                  <div className="space-y-1.5 bg-gray-50 p-2.5 rounded-lg border border-workshop-border">
                    {data.labour_items?.map((l: any) => {
                      const isChecked = !!approvalsMap[`l_${l.id}`];
                      return (
                        <label
                          key={l.id}
                          className={`flex items-center justify-between p-2 rounded-md border cursor-pointer transition ${
                            isChecked
                              ? 'bg-green-50/60 border-green-300 text-green-950 font-medium'
                              : 'bg-red-50/40 border-red-200 text-red-900 line-through opacity-70'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) =>
                                setApprovalsMap({
                                  ...approvalsMap,
                                  [`l_${l.id}`]: e.target.checked,
                                })
                              }
                              className="rounded text-brand focus:ring-brand"
                            />
                            <span>{l.description}</span>
                          </div>
                          <span className="font-mono font-bold">{formatINR(l.total)}</span>
                        </label>
                      );
                    })}
                    {(!data.labour_items || data.labour_items.length === 0) && (
                      <div className="text-gray-400 italic py-1">No labour items.</div>
                    )}
                  </div>
                </div>

                <div>
                  <span className="font-bold text-workshop-muted uppercase tracking-wider block mb-1 text-[11px]">
                    Parts / Materials
                  </span>
                  <div className="space-y-1.5 bg-gray-50 p-2.5 rounded-lg border border-workshop-border">
                    {data.parts_items?.map((p: any) => {
                      const isChecked = !!approvalsMap[`p_${p.id}`];
                      return (
                        <label
                          key={p.id}
                          className={`flex items-center justify-between p-2 rounded-md border cursor-pointer transition ${
                            isChecked
                              ? 'bg-green-50/60 border-green-300 text-green-950 font-medium'
                              : 'bg-red-50/40 border-red-200 text-red-900 line-through opacity-70'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) =>
                                setApprovalsMap({
                                  ...approvalsMap,
                                  [`p_${p.id}`]: e.target.checked,
                                })
                              }
                              className="rounded text-brand focus:ring-brand"
                            />
                            <span>{p.description} {p.part_number && `(${p.part_number})`}</span>
                          </div>
                          <span className="font-mono font-bold">{formatINR(p.total)}</span>
                        </label>
                      );
                    })}
                    {(!data.parts_items || data.parts_items.length === 0) && (
                      <div className="text-gray-400 italic py-1">No parts items.</div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-workshop-text mb-1">Approval Note (Optional)</label>
                <input
                  type="text"
                  value={approvalNote}
                  onChange={(e) => setApprovalNote(e.target.value)}
                  placeholder="e.g. Customer approved engine oil and filter, asked to skip AC servicing for now"
                  className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowApprovalModal(false)}
                  className="px-4 py-2 border border-workshop-border rounded-lg text-xs font-semibold hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand text-white rounded-lg text-xs font-bold hover:bg-brand-deep shadow-xs cursor-pointer"
                >
                  Save Decisions &amp; Recalculate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

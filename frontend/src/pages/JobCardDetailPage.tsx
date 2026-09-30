import React, { useState, useEffect, useRef } from 'react';
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
  RefreshCw,
  Pencil,
  ClipboardCheck,
  RotateCcw,
  AlertCircle
} from 'lucide-react';
import { apiRequest, getPdfUrl } from '../lib/api';
import { formatINR, formatDate } from '../lib/formatters';
import { useAuth } from '../context/AuthContext';
import { useDesktopModal } from '../context/DesktopModalContext';
import { WhatsAppPreviewModal } from '../components/common/WhatsAppPreviewModal';
import {
  buildEstimateApprovalMessage,
  buildReadyForDeliveryMessage,
  buildJobCardIntakeMessage
} from '../lib/whatsapp';

import { InvoiceDetailModal } from '../components/invoice/InvoiceDetailModal';

export const STATUS_OPTIONS = [
  {
    value: 'RECEIVED',
    label: 'Received',
    desc: 'Vehicle intake recorded',
    dotClass: 'bg-slate-500',
    buttonClass: 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-800',
  },
  {
    value: 'INSPECTION',
    label: 'Inspection',
    desc: 'Diagnosis & multi-point checklist',
    dotClass: 'bg-indigo-500',
    buttonClass: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-300 text-indigo-900',
  },
  {
    value: 'WAITING_FOR_APPROVAL',
    label: 'Waiting for Approval',
    desc: 'Estimate sent, awaiting customer',
    dotClass: 'bg-amber-500',
    buttonClass: 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900',
  },
  {
    value: 'APPROVED',
    label: 'Approved',
    desc: 'Customer approved estimate',
    dotClass: 'bg-teal-500',
    buttonClass: 'bg-teal-50 hover:bg-teal-100 border-teal-300 text-teal-900',
  },
  {
    value: 'IN_PROGRESS',
    label: 'In Progress',
    desc: 'Active service & bay work',
    dotClass: 'bg-blue-500',
    buttonClass: 'bg-blue-50 hover:bg-blue-100 border-blue-300 text-blue-900',
  },
  {
    value: 'READY_FOR_DELIVERY',
    label: 'Ready for Delivery',
    desc: 'Work done, road tested & QC passed',
    dotClass: 'bg-purple-500',
    buttonClass: 'bg-purple-50 hover:bg-purple-100 border-purple-300 text-purple-900',
  },
  {
    value: 'COMPLETED',
    label: 'Completed',
    desc: 'Invoice finalized & car delivered',
    dotClass: 'bg-emerald-500',
    buttonClass: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-900',
  },
  {
    value: 'CANCELLED',
    label: 'Cancelled',
    desc: 'Service cancelled by owner',
    dotClass: 'bg-rose-500',
    buttonClass: 'bg-rose-50 hover:bg-rose-100 border-rose-300 text-rose-900',
  },
  {
    value: 'REOPENED',
    label: 'Reopened',
    desc: 'Customer reconsidered & job resumed',
    dotClass: 'bg-teal-500',
    buttonClass: 'bg-teal-50 hover:bg-teal-100 border-teal-300 text-teal-900',
  },
];

export const getStatusConfig = (status: string) => {
  return (
    STATUS_OPTIONS.find((s) => s.value === status) || {
      value: status,
      label: status ? status.replace(/_/g, ' ') : 'Status',
      desc: '',
      dotClass: 'bg-slate-400',
      buttonClass: 'bg-white hover:bg-gray-50 border-workshop-border text-workshop-text',
    }
  );
};

export const STANDARD_CATEGORIES = [
  'Engine', 'Brakes', 'Battery', 'Tyres', 'Suspension',
  'Lights', 'Fluids', 'AC', 'Others'
];

export const COMMON_CUSTOMER_COMPLAINTS = [
  'General Periodic Maintenance / Oil Change',
  'Engine vibration or abnormal noise',
  'Brake noise / spongy brake pedal',
  'AC not cooling adequately',
  'Wheel alignment / steering pull',
  'Suspension thudding sound on bumps',
  'Hard clutch / gear shift difficulty',
  'Battery starting trouble / low voltage',
  'Water wash & interior vacuuming',
];

export const TECH_FINDING_SUGGESTIONS = [
  'Suspension lower arm bush torn / play detected',
  'Brake pads worn (< 2mm remaining)',
  'Engine oil sludged / past service interval',
  'Coolant leakage near radiator hose / thermostat',
  'Battery health weak / CCA below 60%',
  'AC refrigerant low / leak at condenser',
  'Tyre uneven wear / alignment pull noticed in road test',
  'Drive belt cracked / tensioner bearing noise',
  'Wiper blades streak / hardened rubber'
];

export const isTechFinding = (desc: string): boolean => {
  if (!desc) return false;
  const lower = desc.toLowerCase().trim();
  return lower.startsWith('[tech') || lower.startsWith('[technician') || lower.startsWith('[bay');
};

export const cleanComplaintText = (desc: string): string => {
  if (!desc) return '';
  return desc.replace(/^\[(tech finding|technician finding|technician recommended|tech recommended|bay finding|tech)\]\s*/i, '').trim();
};

interface Props {
  jobCardId: number;
  onBack: () => void;
  onNavigateToInvoice: (invoiceId: number) => void;
  onNavigateToCustomer?: (customerId: number) => void;
  onNavigateToVehicle?: (vehicleId: number) => void;
  backLabel?: string;
}

export const JobCardDetailPage: React.FC<Props> = ({
  jobCardId,
  onBack,
  onNavigateToInvoice,
  onNavigateToCustomer,
  onNavigateToVehicle,
  backLabel,
}) => {
  const { user, workshop } = useAuth();
  const { alert, confirm, toast } = useDesktopModal();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // In-place invoice modal state
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

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
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Dropdown refs for click-outside
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const printDropdownRef = useRef<HTMLDivElement>(null);
  const whatsAppDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false);
      }
      if (printDropdownRef.current && !printDropdownRef.current.contains(event.target as Node)) {
        setShowPrintDropdown(false);
      }
      if (whatsAppDropdownRef.current && !whatsAppDropdownRef.current.contains(event.target as Node)) {
        setShowWhatsAppDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Add Labour Modal state
  const [showAddLabourModal, setShowAddLabourModal] = useState(false);
  const [labourDesc, setLabourDesc] = useState('');
  const [labourRate, setLabourRate] = useState<number | string>('');
  const [labourCost, setLabourCost] = useState<number | string>('');
  const [labourSac, setLabourSac] = useState('998729');
  const [labourGst, setLabourGst] = useState<number>(18);
  const [labourQty, setLabourQty] = useState<number>(1);
  const [labourStatus, setLabourStatus] = useState<string>('RECOMMENDED');
  const [labourCatalogId, setLabourCatalogId] = useState<number | undefined>(undefined);

  // Add Part Modal state
  const [showAddPartModal, setShowAddPartModal] = useState(false);
  const [partDesc, setPartDesc] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [partUnit, setPartUnit] = useState('pcs');
  const [partPrice, setPartPrice] = useState<number | string>('');
  const [partCost, setPartCost] = useState<number | string>('');
  const [partHsn, setPartHsn] = useState('8708');
  const [partGst, setPartGst] = useState<number>(18);
  const [partQty, setPartQty] = useState<number>(1);
  const [partStatus, setPartStatus] = useState<string>('RECOMMENDED');
  const [partCatalogId, setPartCatalogId] = useState<number | undefined>(undefined);

  // Edit Labour Modal state
  const [editLabourItem, setEditLabourItem] = useState<any | null>(null);
  const [editLabourDesc, setEditLabourDesc] = useState('');
  const [editLabourQty, setEditLabourQty] = useState<number>(1);
  const [editLabourRate, setEditLabourRate] = useState<number | string>('');
  const [editLabourCost, setEditLabourCost] = useState<number | string>('');
  const [editLabourSac, setEditLabourSac] = useState('998729');
  const [editLabourGst, setEditLabourGst] = useState<number>(18);
  const [editLabourStatus, setEditLabourStatus] = useState<string>('APPROVED');

  // Edit Part Modal state
  const [editPartItem, setEditPartItem] = useState<any | null>(null);
  const [editPartDesc, setEditPartDesc] = useState('');
  const [editPartNumber, setEditPartNumber] = useState('');
  const [editPartUnit, setEditPartUnit] = useState('pcs');
  const [editPartQty, setEditPartQty] = useState<number>(1);
  const [editPartPrice, setEditPartPrice] = useState<number | string>('');
  const [editPartCost, setEditPartCost] = useState<number | string>('');
  const [editPartHsn, setEditPartHsn] = useState('8708');
  const [editPartGst, setEditPartGst] = useState<number>(18);
  const [editPartStatus, setEditPartStatus] = useState<string>('APPROVED');

  const calcMarginPct = (selling: number | string, cost: number | string) => {
    const s = Number(selling) || 0;
    const c = Number(cost) || 0;
    if (s <= 0) return 0;
    return Math.round(((s - c) / s) * 100);
  };

  const applyTargetMargin = (
    cost: number | string,
    pct: number,
    setSelling: (val: number | string) => void
  ) => {
    const c = Number(cost) || 0;
    if (c <= 0) return;
    const target = Math.round(c / (1 - pct / 100));
    setSelling(target);
  };

  // Customer Approval Modal state
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalName, setApprovalName] = useState('');
  const [approvalMethod, setApprovalMethod] = useState('WHATSAPP');
  const [approvalNote, setApprovalNote] = useState('');
  const [approvalsMap, setApprovalsMap] = useState<Record<string, boolean>>({});

  // Complaints management state
  const [showAddComplaintModal, setShowAddComplaintModal] = useState(false);
  const [newComplaintType, setNewComplaintType] = useState<'CUSTOMER' | 'TECH'>('CUSTOMER');
  const [newComplaintDesc, setNewComplaintDesc] = useState('');
  const [savingComplaint, setSavingComplaint] = useState(false);

  // Edit Complaint Modal state
  const [editingComplaint, setEditingComplaint] = useState<any | null>(null);
  const [editComplaintType, setEditComplaintType] = useState<'CUSTOMER' | 'TECH'>('CUSTOMER');
  const [editComplaintDesc, setEditComplaintDesc] = useState('');
  const [updatingComplaint, setUpdatingComplaint] = useState(false);

  // Multi-point Inspection Modal state
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [inspectionDraft, setInspectionDraft] = useState<Record<string, { status: 'NORMAL' | 'NEEDS_ATTENTION'; notes: string }>>({});
  const [savingInspections, setSavingInspections] = useState(false);

  // WhatsApp modal state
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppTitle, setWhatsAppTitle] = useState('');
  const [whatsAppMessage, setWhatsAppMessage] = useState('');
  const [showWhatsAppDropdown, setShowWhatsAppDropdown] = useState(false);
  const [showPrintDropdown, setShowPrintDropdown] = useState(false);

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

  const handleSelectStatus = async (targetStatus: string) => {
    if (!data || data.status === targetStatus) {
      setShowStatusDropdown(false);
      return;
    }

    if (targetStatus === 'CANCELLED' || targetStatus === 'REOPENED') {
      setShowStatusDropdown(false);
      setNewStatus(targetStatus);
      setStatusNote('');
      setShowStatusModal(true);
      return;
    }

    if (targetStatus === 'COMPLETED') {
      if (!data.invoice || data.invoice.status !== 'FINALIZED') {
        alert('Cannot mark as COMPLETED without a finalised invoice. Please finalize the invoice first.', {
          title: 'Finalised Invoice Required',
          type: 'warning',
        });
        setShowStatusDropdown(false);
        return;
      }
    }

    try {
      setUpdatingStatus(true);
      await apiRequest(`/job-cards/${jobCardId}/status`, {
        method: 'POST',
        body: JSON.stringify({
          status: targetStatus,
        }),
      });
      setShowStatusDropdown(false);
      await fetchDetail();
      toast(`Status updated to ${targetStatus}`, 'info');
    } catch (err: any) {
      alert(err.message || 'Failed to update status', { type: 'error' });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleUpdateStatus = async () => {
    try {
      const finalNote = newStatus === 'REOPENED' && !statusNote.trim()
        ? 'Customer reconsidered and reopened job card'
        : (statusNote || undefined);

      await apiRequest(`/job-cards/${jobCardId}/status`, {
        method: 'POST',
        body: JSON.stringify({
          status: newStatus,
          note: finalNote,
          cancelled_reason: newStatus === 'CANCELLED' ? cancelReason : undefined,
        }),
      });
      setShowStatusModal(false);
      fetchDetail();
      toast(`Status updated to ${newStatus}`, 'info');
    } catch (err: any) {
      alert(err.message || 'Failed to update status', { type: 'error' });
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
      alert(err.message || 'Failed to update service item', { type: 'error' });
    }
  };

  const handleDeleteLabour = async (lid: number) => {
    const confirmed = await confirm('Are you sure you want to remove this service line from the job card?', {
      title: 'Remove Service Item',
      confirmText: 'Remove',
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      await apiRequest(`/job-cards/${jobCardId}/labour-items/${lid}`, {
        method: 'DELETE',
      });
      fetchDetail();
      toast('Service item removed', 'info');
    } catch (err: any) {
      alert(err.message || 'Failed to remove service item', { type: 'error' });
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
      alert(err.message || 'Failed to update part item', { type: 'error' });
    }
  };

  const handleDeletePart = async (pid: number) => {
    const confirmed = await confirm('Are you sure you want to remove this part item from the job card?', {
      title: 'Remove Part Item',
      confirmText: 'Remove',
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      await apiRequest(`/job-cards/${jobCardId}/parts-items/${pid}`, {
        method: 'DELETE',
      });
      fetchDetail();
      toast('Part item removed', 'info');
    } catch (err: any) {
      alert(err.message || 'Failed to remove part item', { type: 'error' });
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
          unit_price: Math.round(Number(labourRate || 0) * 100),
          cost_price: Math.round(Number(labourCost || 0) * 100),
          sac_code: labourSac.trim() || '998729',
          gst_rate: Number(labourGst),
          status: labourStatus,
          catalog_id: labourCatalogId || undefined,
        }),
      });
      setLabourDesc('');
      setLabourRate('');
      setLabourCost('');
      setLabourSac('998729');
      setLabourGst(18);
      setLabourQty(1);
      setLabourCatalogId(undefined);
      setShowAddLabourModal(false);
      fetchDetail();
      toast('Service item added', 'success');
    } catch (err: any) {
      alert(err.message || 'Failed to add service item', { type: 'error' });
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
          unit_price: Math.round(Number(partPrice || 0) * 100),
          cost_price: Math.round(Number(partCost || 0) * 100),
          hsn_code: partHsn.trim() || '8708',
          gst_rate: Number(partGst),
          status: partStatus,
          catalog_id: partCatalogId || undefined,
        }),
      });
      setPartDesc('');
      setPartNumber('');
      setPartPrice('');
      setPartCost('');
      setPartHsn('8708');
      setPartGst(18);
      setPartQty(1);
      setPartUnit('pcs');
      setPartCatalogId(undefined);
      setShowAddPartModal(false);
      fetchDetail();
      toast('Part item added', 'success');
    } catch (err: any) {
      alert(err.message || 'Failed to add part item', { type: 'error' });
    }
  };

  const handleOpenEditLabour = (l: any) => {
    setEditLabourItem(l);
    setEditLabourDesc(l.description || '');
    setEditLabourQty(l.quantity || 1);
    setEditLabourRate(((l.unit_price || 0) / 100) || '');
    setEditLabourCost(((l.cost_price || 0) / 100) || '');
    setEditLabourSac(l.sac_code || '998729');
    setEditLabourGst(l.gst_rate !== undefined ? l.gst_rate : 18);
    setEditLabourStatus(l.status || 'APPROVED');
  };

  const handleSaveEditLabour = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLabourItem) return;
    try {
      await apiRequest(`/job-cards/${jobCardId}/labour-items/${editLabourItem.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          description: editLabourDesc.trim(),
          quantity: Number(editLabourQty) || 1,
          unit_price: Math.round(Number(editLabourRate || 0) * 100),
          cost_price: Math.round(Number(editLabourCost || 0) * 100),
          sac_code: editLabourSac.trim() || '998729',
          gst_rate: Number(editLabourGst),
          status: editLabourStatus,
        }),
      });
      setEditLabourItem(null);
      fetchDetail();
      toast('Service line updated', 'success');
    } catch (err: any) {
      alert(err.message || 'Failed to update service line', { type: 'error' });
    }
  };

  const handleOpenEditPart = (p: any) => {
    setEditPartItem(p);
    setEditPartDesc(p.description || '');
    setEditPartNumber(p.part_number || '');
    setEditPartUnit(p.unit || 'pcs');
    setEditPartQty(p.quantity || 1);
    setEditPartPrice(((p.unit_price || 0) / 100) || '');
    setEditPartCost(((p.cost_price || p.purchase_cost || 0) / 100) || '');
    setEditPartHsn(p.hsn_code || '8708');
    setEditPartGst(p.gst_rate !== undefined ? p.gst_rate : 18);
    setEditPartStatus(p.status || 'APPROVED');
  };

  const handleSaveEditPart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPartItem) return;
    try {
      await apiRequest(`/job-cards/${jobCardId}/parts-items/${editPartItem.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          description: editPartDesc.trim(),
          part_number: editPartNumber.trim() || undefined,
          unit: editPartUnit,
          quantity: Number(editPartQty) || 1,
          unit_price: Math.round(Number(editPartPrice || 0) * 100),
          cost_price: Math.round(Number(editPartCost || 0) * 100),
          hsn_code: editPartHsn.trim() || '8708',
          gst_rate: Number(editPartGst),
          status: editPartStatus,
        }),
      });
      setEditPartItem(null);
      fetchDetail();
      toast('Part item updated', 'success');
    } catch (err: any) {
      alert(err.message || 'Failed to update part item', { type: 'error' });
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
      alert('Please provide customer/approver name', {
        title: 'Missing Customer Name',
        type: 'warning',
      });
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
      toast('Customer approval decisions recorded', 'success');
    } catch (err: any) {
      alert(err.message || 'Failed to record customer approvals', { type: 'error' });
    }
  };

  // Complaint handlers
  const handleOpenAddComplaintModal = (type: 'CUSTOMER' | 'TECH' = 'CUSTOMER') => {
    setNewComplaintType(type);
    setNewComplaintDesc('');
    setShowAddComplaintModal(true);
  };

  const handleAddComplaintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newComplaintDesc.trim();
    if (!trimmed) return;
    try {
      setSavingComplaint(true);
      const finalDesc = newComplaintType === 'TECH' ? `[Tech Finding] ${trimmed}` : trimmed;
      await apiRequest(`/job-cards/${jobCardId}/complaints`, {
        method: 'POST',
        body: JSON.stringify({ description: finalDesc })
      });
      setShowAddComplaintModal(false);
      setNewComplaintDesc('');
      await fetchDetail();
      toast('Observation added', 'success');
    } catch (err: any) {
      alert(err.message || 'Failed to add complaint / finding', { type: 'error' });
    } finally {
      setSavingComplaint(false);
    }
  };

  const handleOpenEditComplaint = (c: any) => {
    const isTech = isTechFinding(c.description);
    setEditingComplaint(c);
    setEditComplaintType(isTech ? 'TECH' : 'CUSTOMER');
    setEditComplaintDesc(cleanComplaintText(c.description));
  };

  const handleEditComplaintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingComplaint) return;
    const trimmed = editComplaintDesc.trim();
    if (!trimmed) return;
    try {
      setUpdatingComplaint(true);
      const finalDesc = editComplaintType === 'TECH' ? `[Tech Finding] ${trimmed}` : trimmed;
      await apiRequest(`/job-cards/${jobCardId}/complaints/${editingComplaint.id}`, {
        method: 'PUT',
        body: JSON.stringify({ description: finalDesc })
      });
      setEditingComplaint(null);
      await fetchDetail();
      toast('Observation updated', 'success');
    } catch (err: any) {
      alert(err.message || 'Failed to update complaint / finding', { type: 'error' });
    } finally {
      setUpdatingComplaint(false);
    }
  };

  const handleDeleteComplaint = async (cid: number) => {
    const confirmed = await confirm('Are you sure you want to remove this complaint / observation?', {
      title: 'Remove Observation',
      confirmText: 'Remove',
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      await apiRequest(`/job-cards/${jobCardId}/complaints/${cid}`, {
        method: 'DELETE'
      });
      await fetchDetail();
      toast('Observation removed', 'info');
    } catch (err: any) {
      alert(err.message || 'Failed to remove complaint', { type: 'error' });
    }
  };

  // Inspection handlers
  const handleOpenInspectionModal = () => {
    const map: Record<string, { status: 'NORMAL' | 'NEEDS_ATTENTION'; notes: string }> = {};
    STANDARD_CATEGORIES.forEach((cat) => {
      map[cat] = { status: 'NORMAL', notes: '' };
    });
    if (data?.inspections) {
      data.inspections.forEach((insp: any) => {
        map[insp.category] = {
          status: insp.status === 'NEEDS_ATTENTION' ? 'NEEDS_ATTENTION' : 'NORMAL',
          notes: insp.notes || ''
        };
      });
    }
    setInspectionDraft(map);
    setShowInspectionModal(true);
  };

  const handleToggleDraftInspection = (category: string) => {
    setInspectionDraft((prev) => {
      const current = prev[category] || { status: 'NORMAL', notes: '' };
      const nextStatus = current.status === 'NORMAL' ? 'NEEDS_ATTENTION' : 'NORMAL';
      return {
        ...prev,
        [category]: { ...current, status: nextStatus }
      };
    });
  };

  const handleDraftInspectionNotes = (category: string, notes: string) => {
    setInspectionDraft((prev) => {
      const current = prev[category] || { status: 'NORMAL', notes: '' };
      return {
        ...prev,
        [category]: { ...current, notes }
      };
    });
  };

  const handleMarkAllInspectionsNormal = () => {
    setInspectionDraft((prev) => {
      const updated: typeof prev = {};
      STANDARD_CATEGORIES.forEach((cat) => {
        updated[cat] = { ...(prev[cat] || { notes: '' }), status: 'NORMAL' };
      });
      return updated;
    });
  };

  const handleSaveInspectionsSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setSavingInspections(true);
      const payload = Object.entries(inspectionDraft).map(([category, item]) => ({
        category,
        status: item.status,
        notes: item.notes.trim() || null
      }));
      await apiRequest(`/job-cards/${jobCardId}/inspections`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      setShowInspectionModal(false);
      await fetchDetail();
      toast('Inspection checklist saved', 'success');
    } catch (err: any) {
      alert(err.message || 'Failed to update inspections', { type: 'error' });
    } finally {
      setSavingInspections(false);
    }
  };

  const handleAddLabourForInspection = (category: string, notes?: string) => {
    const desc = notes ? `${category}: ${notes}` : `${category} Service & Inspection`;
    setLabourDesc(desc);
    setShowAddLabourModal(true);
  };

  const handleAddPartForInspection = (category: string, notes?: string) => {
    const desc = notes ? `${category}: ${notes}` : `${category} replacement component`;
    setPartDesc(desc);
    setShowAddPartModal(true);
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
      <div className="bg-white p-4 md:p-5 rounded-xl border border-workshop-border shadow-2xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        {/* Left: Identity & Metadata */}
        <div className="flex items-start sm:items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg text-workshop-muted hover:text-workshop-text transition border border-workshop-border/80 shrink-0 mt-0.5 sm:mt-0 cursor-pointer"
            title={backLabel || "Back to Job Cards"}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-bold text-xl md:text-2xl text-brand-deep tracking-tight">
                {data.job_card_number}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  data.status === 'COMPLETED'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : data.status === 'REOPENED'
                    ? 'bg-teal-100 text-teal-800 border-teal-200'
                    : data.status === 'CANCELLED'
                    ? 'bg-rose-100 text-rose-800 border-rose-200'
                    : data.status === 'WAITING_FOR_APPROVAL'
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : data.status === 'APPROVED'
                    ? 'bg-teal-100 text-teal-800 border-teal-200'
                    : data.status === 'IN_PROGRESS'
                    ? 'bg-blue-100 text-blue-800 border-blue-200'
                    : data.status === 'READY_FOR_DELIVERY'
                    ? 'bg-purple-100 text-purple-800 border-purple-200'
                    : 'bg-slate-100 text-slate-800 border-slate-200'
                }`}
              >
                {data.status}
              </span>
              {data.vehicle?.registration_number && (
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-semibold border border-gray-200">
                  {data.vehicle.registration_number}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-workshop-muted">
              <span>Opened on {data.date} at {data.time_in}</span>
              <span>&bull;</span>
              <span>
                Odometer: <span className="font-mono font-semibold text-workshop-text">{data.odometer.toLocaleString('en-IN')} km</span>
              </span>
              {data.vehicle && (
                <>
                  <span>&bull;</span>
                  <span className="font-medium text-workshop-text">
                    {data.vehicle.brand} {data.vehicle.model}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          {/* Live Vehicle Status Dropdown */}
          <div className="relative" ref={statusDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setShowStatusDropdown(!showStatusDropdown);
                setShowPrintDropdown(false);
                setShowWhatsAppDropdown(false);
              }}
              disabled={updatingStatus}
              className={`inline-flex items-center gap-1.5 px-3 py-2 border rounded-lg transition shadow-2xs cursor-pointer text-xs font-semibold ${
                getStatusConfig(data.status).buttonClass
              }`}
              title={`Current Vehicle Status: ${getStatusConfig(data.status).label}. Click to choose another status.`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${getStatusConfig(data.status).dotClass} ${updatingStatus ? 'animate-ping' : ''}`} />
              <span className="font-bold">{getStatusConfig(data.status).label}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 opacity-70 ${showStatusDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showStatusDropdown && (
              <div className="absolute left-0 xl:left-auto xl:right-0 mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-workshop-border py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-workshop-muted border-b border-gray-100 flex items-center justify-between">
                  <span>Change Vehicle Status</span>
                  <span className="font-normal text-[9px] text-gray-400">1-Click</span>
                </div>
                <div className="py-1 max-h-72 overflow-y-auto">
                  {STATUS_OPTIONS.map((opt) => {
                    const isCurrent = data.status === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={isCurrent || updatingStatus}
                        onClick={() => handleSelectStatus(opt.value)}
                        className={`w-full text-left px-3.5 py-2 flex items-center justify-between text-xs transition cursor-pointer ${
                          isCurrent
                            ? 'bg-gray-50/80 font-bold text-gray-400 cursor-default'
                            : 'hover:bg-gray-50 text-workshop-text hover:text-brand'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${opt.dotClass}`} />
                          <div className="flex flex-col">
                            <span className="font-semibold">{opt.label}</span>
                            <span className="text-[10px] text-workshop-muted font-normal">{opt.desc}</span>
                          </div>
                        </div>
                        {isCurrent && (
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-2" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="pt-1.5 border-t border-gray-100 px-2 pb-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowStatusDropdown(false);
                      setNewStatus(data.status);
                      setShowStatusModal(true);
                    }}
                    className="w-full text-center py-1.5 text-[11px] font-medium text-workshop-muted hover:text-workshop-text hover:bg-gray-50 rounded-lg transition cursor-pointer"
                  >
                    Add note / Detailed dialog &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Print Template Dropdown */}
          <div className="relative" ref={printDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setShowPrintDropdown(!showPrintDropdown);
                setShowStatusDropdown(false);
                setShowWhatsAppDropdown(false);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 border border-workshop-border text-workshop-text font-semibold text-xs rounded-lg transition shadow-2xs cursor-pointer"
              title="Print Job Card PDF Options"
            >
              <Printer className="w-3.5 h-3.5 text-workshop-muted" />
              <span>Print Job Card</span>
              <ChevronDown className="w-3 h-3 ml-0.5 text-workshop-muted" />
            </button>

            {showPrintDropdown && (
              <div className="absolute right-0 mt-1.5 w-72 bg-white rounded-xl shadow-xl border border-workshop-border py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                <a
                  href={getPdfUrl(`/job-cards/${data.id}/pdf?template=detailed`)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setShowPrintDropdown(false)}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50/50 flex flex-col text-xs transition border-b border-gray-100 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-workshop-text group-hover:text-blue-700 flex items-center gap-1.5">
                      <span>📋</span> Work Order &amp; Estimate
                    </span>
                    <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                      Customer
                    </span>
                  </div>
                  <span className="text-[10px] text-workshop-muted mt-0.5">
                    Itemized complaints, SAC/HSN pricing, totals, terms &amp; authorization sign-off
                  </span>
                </a>

                <a
                  href={getPdfUrl(`/job-cards/${data.id}/pdf?template=technician`)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setShowPrintDropdown(false)}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-amber-50/50 flex flex-col text-xs transition group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-workshop-text group-hover:text-amber-700 flex items-center gap-1.5">
                      <span>🔧</span> Shopfloor Bay Sheet
                    </span>
                    <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded">
                      Technician
                    </span>
                  </div>
                  <span className="text-[10px] text-workshop-muted mt-0.5">
                    High-vis plate badge, checklist checkboxes, stores requisition, battery/PSI notes &amp; QC
                  </span>
                </a>
              </div>
            )}
          </div>

          {/* WhatsApp Communications Split Dropdown */}
          <div className="relative" ref={whatsAppDropdownRef}>
            <button
              type="button"
              onClick={() => setShowWhatsAppDropdown(!showWhatsAppDropdown)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#25D366] hover:bg-[#1DA851] text-white font-bold text-xs rounded-lg transition shadow-2xs cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5 fill-white" />
              <span>WhatsApp</span>
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
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-lg transition shadow-2xs cursor-pointer"
              title="Record customer approvals or exclusions across all line items"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Customer Decisions</span>
            </button>
          )}

          {data.invoice && (
            <button
              type="button"
              onClick={() => setShowInvoiceModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-deep text-white font-bold text-xs rounded-lg shadow-sm transition cursor-pointer"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>View / Finalize Invoice</span>
            </button>
          )}
        </div>
      </div>

      {/* Customer & Vehicle Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Customer Card */}
        <div className="p-4 bg-white rounded-xl border border-workshop-border shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-workshop-muted uppercase tracking-wider">
              <User className="w-3.5 h-3.5 text-brand" /> Customer Information
            </div>
            {onNavigateToCustomer && data.customer?.id && (
              <button
                type="button"
                onClick={() => onNavigateToCustomer(data.customer.id)}
                className="text-xs font-semibold text-brand hover:underline cursor-pointer"
                title="View Customer Profile"
              >
                Profile &rarr;
              </button>
            )}
          </div>
          <div
            className={`font-bold text-base text-workshop-text ${onNavigateToCustomer && data.customer?.id ? 'hover:text-brand cursor-pointer' : ''}`}
            onClick={() => onNavigateToCustomer && data.customer?.id && onNavigateToCustomer(data.customer.id)}
          >
            {data.customer.name}
          </div>
          <div className="text-xs text-workshop-muted space-y-1">
            <div>Phone: <span className="font-mono font-semibold text-workshop-text">{data.customer.phone}</span></div>
            {data.customer.alt_phone && <div>Alt Phone: <span className="font-mono">{data.customer.alt_phone}</span></div>}
            {data.customer.email && <div>Email: <span className="font-mono">{data.customer.email}</span></div>}
            {data.customer.address && <div>Address: {data.customer.address}</div>}
          </div>
        </div>

        {/* Vehicle Card */}
        <div className="p-4 bg-white rounded-xl border border-workshop-border shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-workshop-muted uppercase tracking-wider">
              <Car className="w-3.5 h-3.5 text-brand" /> Vehicle Details
            </div>
            {onNavigateToVehicle && data.vehicle?.id && (
              <button
                type="button"
                onClick={() => onNavigateToVehicle(data.vehicle.id)}
                className="text-xs font-semibold text-brand hover:underline cursor-pointer"
                title="View Vehicle History"
              >
                History &rarr;
              </button>
            )}
          </div>
          <div
            className={`flex items-center gap-2 ${onNavigateToVehicle && data.vehicle?.id ? 'cursor-pointer group' : ''}`}
            onClick={() => onNavigateToVehicle && data.vehicle?.id && onNavigateToVehicle(data.vehicle.id)}
          >
            <span className="font-mono font-bold text-base bg-gray-100 px-2.5 py-0.5 rounded border border-gray-300 group-hover:border-brand transition">
              {data.vehicle.registration_number}
            </span>
            <span className="font-bold text-base text-workshop-text group-hover:text-brand transition">
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

      {/* Cancelled Banner with Direct Re-Open Button */}
      {isCancelled && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-rose-900 shadow-2xs">
          <div className="space-y-1">
            <div className="font-bold text-sm flex items-center gap-1.5 text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              Job Card is Cancelled
            </div>
            {data.cancelled_reason && (
              <div className="text-rose-700">
                <span className="font-semibold">Cancellation Reason:</span> {data.cancelled_reason}
              </div>
            )}
            <div className="text-[11px] text-rose-600">
              Customer took vehicle without service. If they reconsidered and brought the vehicle back, you can re-open this job card with a note.
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setNewStatus('REOPENED');
              setStatusNote('');
              setShowStatusModal(true);
            }}
            className="px-4 py-2.5 bg-brand hover:bg-brand-deep text-white font-bold rounded-lg shadow-sm transition shrink-0 cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
          >
            <RotateCcw className="w-4 h-4" />
            Re-Open Job Card
          </button>
        </div>
      )}

      {/* Reopened Banner */}
      {data.status === 'REOPENED' && (
        <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-xl flex items-center justify-between gap-3 text-xs text-teal-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-teal-600 shrink-0" />
            <div>
              <span className="font-bold text-teal-800">Job Card Reopened:</span> This job card was previously cancelled and has been re-opened upon customer reconsideration. You can now add services, allocate parts, and proceed with work.
            </div>
          </div>
        </div>
      )}

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Itemised Complaints & Technician Findings */}
        <div className="p-4 bg-white rounded-xl border border-workshop-border shadow-2xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-workshop-border-soft pb-2.5">
            <div>
              <h3 className="font-bold text-sm text-workshop-text">
                Itemised Complaints &amp; Bay Findings
              </h3>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-workshop-muted">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-medium">
                  <User className="w-3 h-3 text-slate-500" />
                  {data.complaints?.filter((c: any) => !isTechFinding(c.description)).length || 0} Customer
                </span>
                <span>&bull;</span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                  <Wrench className="w-3 h-3 text-indigo-600" />
                  {data.complaints?.filter((c: any) => isTechFinding(c.description)).length || 0} Tech Findings
                </span>
              </div>
            </div>
            {canEditItems && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleOpenAddComplaintModal('TECH')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold text-xs rounded-md shadow-2xs transition cursor-pointer"
                  title="Add technician finding or test run observation"
                >
                  <Wrench className="w-3.5 h-3.5 text-indigo-600" />
                  <span>+ Tech Finding</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAddComplaintModal('CUSTOMER')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-gray-50 text-workshop-text border border-workshop-border font-semibold text-xs rounded-md shadow-2xs transition cursor-pointer"
                  title="Add customer reported complaint"
                >
                  <Plus className="w-3.5 h-3.5 text-workshop-muted" />
                  <span>+ Issue</span>
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-1 max-h-80 overflow-y-auto pr-0.5">
            {(!data.complaints || data.complaints.length === 0) ? (
              <div className="text-center py-6 text-xs text-workshop-muted bg-gray-50 rounded-lg border border-dashed border-gray-200">
                <p className="font-medium text-workshop-text">No complaints or test-run findings logged yet.</p>
                {canEditItems && (
                  <p className="mt-1 text-[11px]">Click <b>+ Tech Finding</b> or <b>+ Issue</b> to log customer requests or test run observations.</p>
                )}
              </div>
            ) : (
              data.complaints.map((c: any) => {
                const techFinding = isTechFinding(c.description);
                const displayText = cleanComplaintText(c.description);
                return (
                  <div
                    key={c.id}
                    className={`group flex items-start justify-between gap-3 text-xs p-2.5 rounded-lg border transition ${
                      techFinding
                        ? 'bg-indigo-50/40 border-indigo-200/80 hover:bg-indigo-50/70'
                        : 'bg-gray-50 border-workshop-border-soft hover:bg-gray-100/70'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="font-mono font-bold text-workshop-muted text-[11px] mt-0.5">
                        {c.sequence}.
                      </span>
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {techFinding ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                              <Wrench className="w-3 h-3 text-indigo-600" /> Tech Finding
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              <User className="w-3 h-3 text-slate-500" /> Customer Voice
                            </span>
                          )}
                        </div>
                        <p className="text-workshop-text font-medium leading-relaxed break-words">
                          {displayText}
                        </p>
                      </div>
                    </div>

                    {canEditItems && (
                      <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition">
                        <button
                          type="button"
                          onClick={() => handleOpenEditComplaint(c)}
                          className="p-1 hover:bg-white text-workshop-muted hover:text-brand rounded transition border border-transparent hover:border-gray-200 cursor-pointer"
                          title="Edit complaint / finding"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteComplaint(c.id)}
                          className="p-1 hover:bg-white text-workshop-muted hover:text-red-600 rounded transition border border-transparent hover:border-red-200 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Inspection Checklist */}
        <div className="p-4 bg-white rounded-xl border border-workshop-border shadow-2xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-workshop-border-soft pb-2.5">
            <div>
              <h3 className="font-bold text-sm text-workshop-text flex items-center gap-1.5">
                <ClipboardCheck className="w-4 h-4 text-brand" />
                <span>Bay Inspection Checklist</span>
              </h3>
              <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                {(() => {
                  const attentionCount = data.inspections?.filter((i: any) => i.status === 'NEEDS_ATTENTION').length || 0;
                  const totalCount = data.inspections?.length || STANDARD_CATEGORIES.length;
                  const normalCount = Math.max(0, totalCount - attentionCount);
                  return (
                    <>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
                        ✓ {normalCount} Normal
                      </span>
                      {attentionCount > 0 ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-50 text-amber-900 font-bold border border-amber-300">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          {attentionCount} Attention
                        </span>
                      ) : (
                        <span className="text-workshop-muted text-[10px]">All clear</span>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
            {canEditItems && (
              <button
                type="button"
                onClick={handleOpenInspectionModal}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-brand hover:bg-brand-deep text-white font-semibold text-xs rounded-md shadow-2xs transition cursor-pointer"
                title="Update multi-point vehicle inspection checklist"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit Checklist</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 max-h-80 overflow-y-auto pr-0.5">
            {STANDARD_CATEGORIES.map((catName) => {
              const insp = data.inspections?.find((i: any) => i.category === catName) || {
                category: catName,
                status: 'NORMAL',
                notes: ''
              };
              const isAttention = insp.status === 'NEEDS_ATTENTION';
              return (
                <div
                  key={catName}
                  className={`p-2.5 rounded-lg border flex flex-col justify-between transition ${
                    isAttention
                      ? 'border-amber-300 bg-amber-50/70 text-amber-950 shadow-2xs'
                      : 'border-gray-200 bg-gray-50/80 text-workshop-text'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between font-semibold">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${isAttention ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                        {catName}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          isAttention
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isAttention ? 'NEEDS ATTENTION' : 'NORMAL'}
                      </span>
                    </div>
                    {insp.notes && (
                      <div className="text-[11px] text-workshop-muted mt-1.5 p-1 bg-white/70 rounded border border-gray-200/50 leading-tight">
                        {insp.notes}
                      </div>
                    )}
                  </div>

                  {isAttention && canEditItems && (
                    <div className="mt-2 pt-2 border-t border-amber-200/60 flex items-center justify-between gap-1 text-[10px]">
                      <span className="text-amber-800 font-medium">Bay Action:</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleAddLabourForInspection(catName, insp.notes)}
                          className="px-1.5 py-0.5 rounded bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-semibold transition cursor-pointer"
                          title="Add labour line for this issue"
                        >
                          + Labour
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddPartForInspection(catName, insp.notes)}
                          className="px-1.5 py-0.5 rounded bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-semibold transition cursor-pointer"
                          title="Add replacement part for this issue"
                        >
                          + Part
                        </button>
                      </div>
                    </div>
                  )}
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
                  {canEditItems && <th className="p-2.5 text-right w-44">Actions</th>}
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
                            <button
                              type="button"
                              onClick={() => handleOpenEditLabour(l)}
                              className="p-1 text-gray-500 hover:text-brand hover:bg-brand/10 rounded transition cursor-pointer"
                              title="Edit service rate, payout cost, or details"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
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
                  {canEditItems && <th className="p-2.5 text-right w-44">Actions</th>}
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
                            <button
                              type="button"
                              onClick={() => handleOpenEditPart(p)}
                              className="p-1 text-gray-500 hover:text-brand hover:bg-brand/10 rounded transition cursor-pointer"
                              title="Edit price, cost, margin or details"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
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
                <option value="REOPENED">REOPENED / ReOpen (Customer Reconsidered)</option>
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

            {newStatus === 'REOPENED' && (
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-teal-900">
                  <RotateCcw className="w-3.5 h-3.5 text-teal-600" /> Reopening Cancelled Job Card
                </div>
                <div>Please write a note below describing why the job card is being reopened (e.g. customer reconsidered and returned vehicle for service).</div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-workshop-text mb-1">
                {newStatus === 'REOPENED' ? 'Reopen Note / Reason *' : 'Note (Optional)'}
              </label>
              <input
                type="text"
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder={newStatus === 'REOPENED' ? 'e.g. Customer returned vehicle, agreed to full service' : 'Optional transition note...'}
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
                        setLabourCost((sel.cost_price || 0) / 100);
                        setLabourSac(sel.sac_code || '998729');
                        setLabourGst(sel.gst_rate !== undefined ? sel.gst_rate : 18);
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
                    placeholder="0"
                    required
                    value={labourRate === 0 || labourRate === '0' || labourRate === '' ? '' : labourRate}
                    onChange={(e) => setLabourRate(e.target.value === '' ? '' : Number(e.target.value))}
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
                        setPartCost((sel.purchase_cost || sel.cost_price || 0) / 100);
                        setPartHsn(sel.hsn_code || '8708');
                        setPartGst(sel.gst_rate !== undefined ? sel.gst_rate : 18);
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
                    placeholder="0"
                    required
                    value={partPrice === 0 || partPrice === '0' || partPrice === '' ? '' : partPrice}
                    onChange={(e) => setPartPrice(e.target.value === '' ? '' : Number(e.target.value))}
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

      {/* Edit Labour Item Modal */}
      {editLabourItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-workshop-border p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-workshop-border pb-3">
              <h3 className="font-bold text-base text-workshop-text flex items-center gap-2">
                <Wrench className="w-4 h-4 text-brand" /> Edit Service / Labour Line
              </h3>
              <button
                type="button"
                onClick={() => setEditLabourItem(null)}
                className="p-1 text-workshop-muted hover:bg-gray-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditLabour} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-workshop-text mb-1">Service Description *</label>
                <input
                  type="text"
                  required
                  value={editLabourDesc}
                  onChange={(e) => setEditLabourDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-workshop-text mb-1">Qty / Hours *</label>
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    required
                    value={editLabourQty}
                    onChange={(e) => setEditLabourQty(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-workshop-text mb-1">Status</label>
                  <select
                    value={editLabourStatus}
                    onChange={(e) => setEditLabourStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs bg-white"
                  >
                    <option value="RECOMMENDED">RECOMMENDED</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="DONE">DONE</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-workshop-text mb-1">Selling Rate (₹) *</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0"
                    required
                    value={editLabourRate === 0 || editLabourRate === '0' || editLabourRate === '' ? '' : editLabourRate}
                    onChange={(e) => setEditLabourRate(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-workshop-text mb-1">Technician Payout / Cost (₹)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0"
                    value={editLabourCost === 0 || editLabourCost === '0' || editLabourCost === '' ? '' : editLabourCost}
                    onChange={(e) => setEditLabourCost(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {/* Dynamic Margin & Profitability Helper */}
              <div className="p-2.5 rounded-lg bg-gray-50 border border-workshop-border-soft flex items-center justify-between text-xs">
                <div>
                  <span className="text-workshop-muted block text-[10px]">Gross Profit / Margin</span>
                  <span className={`font-mono font-bold ${(Number(editLabourRate) || 0) - (Number(editLabourCost) || 0) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    ₹{((Number(editLabourRate) || 0) - (Number(editLabourCost) || 0)).toFixed(2)} ({calcMarginPct(editLabourRate, editLabourCost)}%)
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-workshop-muted mr-1">Target Margin:</span>
                  {[20, 30, 40, 50].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => applyTargetMargin(editLabourCost, m, setEditLabourRate)}
                      className="px-1.5 py-0.5 rounded bg-white hover:bg-brand hover:text-white border border-gray-200 text-[10px] font-semibold transition cursor-pointer"
                      title={`Recalibrate rate for ${m}% margin on payout`}
                    >
                      {m}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-workshop-text mb-1">SAC Code</label>
                  <input
                    type="text"
                    value={editLabourSac}
                    onChange={(e) => setEditLabourSac(e.target.value)}
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-workshop-text mb-1">GST Rate %</label>
                  <select
                    value={editLabourGst}
                    onChange={(e) => setEditLabourGst(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs bg-white"
                  >
                    <option value={0}>0% (Exempt)</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18% (Standard Services)</option>
                    <option value={28}>28%</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditLabourItem(null)}
                  className="px-4 py-2 border border-workshop-border rounded-lg text-xs font-semibold hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand text-white rounded-lg text-xs font-bold hover:bg-brand-deep shadow-xs cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Part Item Modal */}
      {editPartItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-workshop-border p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-workshop-border pb-3">
              <h3 className="font-bold text-base text-workshop-text flex items-center gap-2">
                <Package className="w-4 h-4 text-brand" /> Edit Part / Material Line
              </h3>
              <button
                type="button"
                onClick={() => setEditPartItem(null)}
                className="p-1 text-workshop-muted hover:bg-gray-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditPart} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-workshop-text mb-1">Part Name / Description *</label>
                <input
                  type="text"
                  required
                  value={editPartDesc}
                  onChange={(e) => setEditPartDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-workshop-text mb-1">Part Number (Optional)</label>
                  <input
                    type="text"
                    value={editPartNumber}
                    onChange={(e) => setEditPartNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-workshop-text mb-1">Unit</label>
                  <select
                    value={editPartUnit}
                    onChange={(e) => setEditPartUnit(e.target.value)}
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
                    value={editPartQty}
                    onChange={(e) => setEditPartQty(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-workshop-text mb-1">Status</label>
                  <select
                    value={editPartStatus}
                    onChange={(e) => setEditPartStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs bg-white"
                  >
                    <option value="RECOMMENDED">RECOMMENDED</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="USED">USED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-workshop-text mb-1">Selling Price (₹) *</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0"
                    required
                    value={editPartPrice === 0 || editPartPrice === '0' || editPartPrice === '' ? '' : editPartPrice}
                    onChange={(e) => setEditPartPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-workshop-text mb-1">Purchase / Wholesale Cost (₹)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0"
                    value={editPartCost === 0 || editPartCost === '0' || editPartCost === '' ? '' : editPartCost}
                    onChange={(e) => setEditPartCost(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {/* Dynamic Margin & Profitability Helper */}
              <div className="p-2.5 rounded-lg bg-gray-50 border border-workshop-border-soft flex items-center justify-between text-xs">
                <div>
                  <span className="text-workshop-muted block text-[10px]">Gross Profit / Margin</span>
                  <span className={`font-mono font-bold ${(Number(editPartPrice) || 0) - (Number(editPartCost) || 0) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    ₹{((Number(editPartPrice) || 0) - (Number(editPartCost) || 0)).toFixed(2)} ({calcMarginPct(editPartPrice, editPartCost)}%)
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-workshop-muted mr-1">Target Margin:</span>
                  {[15, 20, 30, 40, 50].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => applyTargetMargin(editPartCost, m, setEditPartPrice)}
                      className="px-1.5 py-0.5 rounded bg-white hover:bg-brand hover:text-white border border-gray-200 text-[10px] font-semibold transition cursor-pointer"
                      title={`Recalibrate selling price for ${m}% margin on cost`}
                    >
                      {m}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-workshop-text mb-1">HSN Code</label>
                  <input
                    type="text"
                    value={editPartHsn}
                    onChange={(e) => setEditPartHsn(e.target.value)}
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-workshop-text mb-1">GST Rate %</label>
                  <select
                    value={editPartGst}
                    onChange={(e) => setEditPartGst(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs bg-white"
                  >
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18% (Auto Components)</option>
                    <option value={28}>28% (Lubricants / Batteries)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditPartItem(null)}
                  className="px-4 py-2 border border-workshop-border rounded-lg text-xs font-semibold hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand text-white rounded-lg text-xs font-bold hover:bg-brand-deep shadow-xs cursor-pointer"
                >
                  Save Changes
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

      {/* Add Complaint / Tech Finding Modal */}
      {showAddComplaintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-workshop-border p-6 max-w-lg w-full space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-workshop-border pb-3 shrink-0">
              <div>
                <h3 className="font-bold text-base text-workshop-text flex items-center gap-2">
                  <Plus className="w-4 h-4 text-brand" /> Add Complaint / Bay Finding
                </h3>
                <p className="text-[11px] text-workshop-muted">
                  Log customer reported issues or mechanic road test &amp; inspection findings
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddComplaintModal(false)}
                className="p-1 text-workshop-muted hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddComplaintSubmit} className="space-y-4 overflow-y-auto flex-1 text-xs">
              <div>
                <label className="block font-semibold text-workshop-text mb-1.5">Origin / Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewComplaintType('CUSTOMER')}
                    className={`p-2.5 rounded-lg border text-left flex items-start gap-2 transition cursor-pointer ${
                      newComplaintType === 'CUSTOMER'
                        ? 'border-brand bg-brand-50/50 text-brand-deep ring-1 ring-brand'
                        : 'border-gray-200 bg-white hover:bg-gray-50 text-workshop-muted'
                    }`}
                  >
                    <User className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-xs text-workshop-text">Customer Voice</div>
                      <div className="text-[10px] text-workshop-muted">Reported at counter intake</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewComplaintType('TECH')}
                    className={`p-2.5 rounded-lg border text-left flex items-start gap-2 transition cursor-pointer ${
                      newComplaintType === 'TECH'
                        ? 'border-indigo-500 bg-indigo-50/70 text-indigo-950 ring-1 ring-indigo-500'
                        : 'border-gray-200 bg-white hover:bg-gray-50 text-workshop-muted'
                    }`}
                  >
                    <Wrench className="w-4 h-4 shrink-0 mt-0.5 text-indigo-600" />
                    <div>
                      <div className="font-bold text-xs text-indigo-950">Tech Finding</div>
                      <div className="text-[10px] text-indigo-700">Road test / Bay inspection</div>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-workshop-text mb-1">
                  Description of Issue / Observation *
                </label>
                <textarea
                  rows={3}
                  required
                  value={newComplaintDesc}
                  onChange={(e) => setNewComplaintDesc(e.target.value)}
                  placeholder={
                    newComplaintType === 'TECH'
                      ? 'e.g. Lower arm ball joint loose, detected during test run over rough road...'
                      : 'e.g. AC cooling low during afternoon idling...'
                  }
                  className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs resize-none focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>

              {/* Suggestions */}
              <div>
                <label className="block font-semibold text-workshop-muted uppercase tracking-wider text-[10px] mb-1.5">
                  {newComplaintType === 'TECH' ? 'Common Technician Findings:' : 'Common Customer Complaints:'}
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {(newComplaintType === 'TECH' ? TECH_FINDING_SUGGESTIONS : COMMON_CUSTOMER_COMPLAINTS).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setNewComplaintDesc(item)}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-gray-100 hover:bg-brand-50 hover:text-brand border border-gray-200 transition text-left cursor-pointer"
                    >
                      + {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddComplaintModal(false)}
                  className="px-4 py-2 border border-workshop-border rounded-lg text-xs font-semibold hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingComplaint || !newComplaintDesc.trim()}
                  className="px-4 py-2 bg-brand text-white rounded-lg text-xs font-bold hover:bg-brand-deep shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {savingComplaint ? 'Adding...' : 'Add to Job Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Complaint / Tech Finding Modal */}
      {editingComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-workshop-border p-6 max-w-lg w-full space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-workshop-border pb-3 shrink-0">
              <div>
                <h3 className="font-bold text-base text-workshop-text flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-brand" /> Edit Complaint #{editingComplaint.sequence}
                </h3>
                <p className="text-[11px] text-workshop-muted">
                  Update complaint description or switch origin between customer voice &amp; technician finding
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingComplaint(null)}
                className="p-1 text-workshop-muted hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditComplaintSubmit} className="space-y-4 overflow-y-auto flex-1 text-xs">
              <div>
                <label className="block font-semibold text-workshop-text mb-1.5">Origin / Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditComplaintType('CUSTOMER')}
                    className={`p-2.5 rounded-lg border text-left flex items-start gap-2 transition cursor-pointer ${
                      editComplaintType === 'CUSTOMER'
                        ? 'border-brand bg-brand-50/50 text-brand-deep ring-1 ring-brand'
                        : 'border-gray-200 bg-white hover:bg-gray-50 text-workshop-muted'
                    }`}
                  >
                    <User className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-xs text-workshop-text">Customer Voice</div>
                      <div className="text-[10px] text-workshop-muted">Reported by customer</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditComplaintType('TECH')}
                    className={`p-2.5 rounded-lg border text-left flex items-start gap-2 transition cursor-pointer ${
                      editComplaintType === 'TECH'
                        ? 'border-indigo-500 bg-indigo-50/70 text-indigo-950 ring-1 ring-indigo-500'
                        : 'border-gray-200 bg-white hover:bg-gray-50 text-workshop-muted'
                    }`}
                  >
                    <Wrench className="w-4 h-4 shrink-0 mt-0.5 text-indigo-600" />
                    <div>
                      <div className="font-bold text-xs text-indigo-950">Tech Finding</div>
                      <div className="text-[10px] text-indigo-700">Road test / Bay diagnosis</div>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-workshop-text mb-1">
                  Description *
                </label>
                <textarea
                  rows={3}
                  required
                  value={editComplaintDesc}
                  onChange={(e) => setEditComplaintDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs resize-none focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingComplaint(null)}
                  className="px-4 py-2 border border-workshop-border rounded-lg text-xs font-semibold hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingComplaint || !editComplaintDesc.trim()}
                  className="px-4 py-2 bg-brand text-white rounded-lg text-xs font-bold hover:bg-brand-deep shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {updatingComplaint ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Multi-Point Inspection Checklist Modal */}
      {showInspectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-workshop-border p-6 max-w-3xl w-full space-y-4 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-workshop-border pb-3 shrink-0">
              <div>
                <h3 className="font-bold text-base text-workshop-text flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-brand" /> Vehicle Bay Inspection Checklist
                </h3>
                <p className="text-[11px] text-workshop-muted">
                  Record 9-point multi-system checklist results and mechanic diagnostic observations from road test
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleMarkAllInspectionsNormal}
                  className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition cursor-pointer"
                  title="Set all inspection categories to Normal"
                >
                  ✓ Mark All Normal
                </button>
                <button
                  type="button"
                  onClick={() => setShowInspectionModal(false)}
                  className="p-1 text-workshop-muted hover:bg-gray-100 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveInspectionsSubmit} className="space-y-3 overflow-y-auto flex-1 pr-1 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {STANDARD_CATEGORIES.map((catName) => {
                  const current = inspectionDraft[catName] || { status: 'NORMAL', notes: '' };
                  const isAttention = current.status === 'NEEDS_ATTENTION';
                  return (
                    <div
                      key={catName}
                      className={`p-3 rounded-xl border transition flex flex-col justify-between gap-2.5 ${
                        isAttention
                          ? 'border-amber-400 bg-amber-50/50 shadow-2xs'
                          : 'border-gray-200 bg-gray-50/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-workshop-text flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${isAttention ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                          {catName}
                        </span>
                        <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-gray-200 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => {
                              setInspectionDraft((prev) => ({
                                ...prev,
                                [catName]: { ...(prev[catName] || { notes: '' }), status: 'NORMAL' }
                              }));
                            }}
                            className={`px-2 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                              !isAttention
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                            }`}
                          >
                            ✓ Normal
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setInspectionDraft((prev) => ({
                                ...prev,
                                [catName]: { ...(prev[catName] || { notes: '' }), status: 'NEEDS_ATTENTION' }
                              }));
                            }}
                            className={`px-2 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                              isAttention
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'text-gray-500 hover:text-amber-800 hover:bg-amber-50'
                            }`}
                          >
                            ⚠️ Needs Attention
                          </button>
                        </div>
                      </div>

                      <div>
                        <input
                          type="text"
                          value={current.notes || ''}
                          onChange={(e) => handleDraftInspectionNotes(catName, e.target.value)}
                          placeholder={
                            isAttention
                              ? `Details on ${catName} defect, wear %, diagnostic reading, or parts needed...`
                              : `Notes on ${catName} condition (optional)...`
                          }
                          className={`w-full px-2.5 py-1.5 rounded-lg border text-xs bg-white focus:outline-none focus:ring-1 ${
                            isAttention
                              ? 'border-amber-300 focus:ring-amber-500'
                              : 'border-gray-300 focus:ring-brand'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowInspectionModal(false)}
                  className="px-4 py-2 border border-workshop-border rounded-lg text-xs font-semibold hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingInspections}
                  className="px-5 py-2 bg-brand text-white rounded-lg text-xs font-bold hover:bg-brand-deep shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {savingInspections ? 'Saving...' : 'Save Inspection Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-place Invoice Detail Modal */}
      {data?.invoice && showInvoiceModal && (
        <InvoiceDetailModal
          invoiceId={data.invoice.id}
          isOpen={showInvoiceModal}
          onClose={() => {
            setShowInvoiceModal(false);
            fetchDetail();
          }}
          onInvoiceUpdated={fetchDetail}
          onNavigateToJobCard={() => setShowInvoiceModal(false)}
          onNavigateToCustomer={onNavigateToCustomer}
          onNavigateToVehicle={onNavigateToVehicle}
        />
      )}
    </div>
  );
};

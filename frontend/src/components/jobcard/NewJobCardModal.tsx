import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  ChevronRight,
  ChevronLeft,
  Car,
  User,
  Plus,
  Trash2,
  AlertTriangle,
  FileCheck,
  Printer,
  Clock,
  CalendarClock,
  Notebook,
  MessageCircle
} from 'lucide-react';
import { apiRequest, getPdfUrl } from '../../lib/api';
import { formatINR } from '../../lib/formatters';
import { useAuth } from '../../context/AuthContext';
import { WhatsAppPreviewModal } from '../common/WhatsAppPreviewModal';
import { buildJobCardIntakeMessage } from '../../lib/whatsapp';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onJobCardCreated: (jobCardId: number) => void;
}

const COMMON_COMPLAINTS = [
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

const STANDARD_CATEGORIES = [
  'Engine', 'Brakes', 'Battery', 'Tyres', 'Suspension',
  'Lights', 'Fluids', 'AC', 'Others'
];

export const NewJobCardModal: React.FC<Props> = ({ isOpen, onClose, onJobCardCreated }) => {
  const { user, workshop } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // WhatsApp gatepass state
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppMessage, setWhatsAppMessage] = useState('');

  // Catalogs
  const [labourCatalog, setLabourCatalog] = useState<Array<{ id: number; name: string; default_rate: number }>>([]);
  const [partsCatalog, setPartsCatalog] = useState<Array<{ id: number; name: string; part_number?: string; unit: string; default_price: number }>>([]);

  // Step 1: Customer & Vehicle
  const [searchReg, setSearchReg] = useState('');
  const [foundVehicle, setFoundVehicle] = useState<any>(null);
  const [lastServiceInfo, setLastServiceInfo] = useState<any>(null);

  const [customerData, setCustomerData] = useState({
    name: '',
    phone: '',
    alt_phone: '',
    email: '',
    address: '',
  });

  const [vehicleData, setVehicleData] = useState({
    registration_number: '',
    make: '',
    model: '',
    variant: '',
    fuel_type: 'Petrol',
    odometer: 0,
    fuel_level: '1/2',
    vin: '',
    engine_number: '',
    year: '' as string | number,
    colour: '',
  });

  // Job Card metadata
  const [jobCardNotes, setJobCardNotes] = useState('');
  const [promisedAt, setPromisedAt] = useState('');
  const [assignedTo, setAssignedTo] = useState<number | ''>('');
  const [staffList, setStaffList] = useState<Array<{ id: number; full_name: string; role: string }>>([]);

  // Step 2: Complaints
  const [complaints, setComplaints] = useState<string[]>([]);
  const [newComplaintInput, setNewComplaintInput] = useState('');

  // Step 3: Inspection
  const [inspections, setInspections] = useState<Record<string, { status: 'NORMAL' | 'NEEDS_ATTENTION'; notes: string }>>({
    Engine: { status: 'NORMAL', notes: '' },
    Brakes: { status: 'NORMAL', notes: '' },
    Battery: { status: 'NORMAL', notes: '' },
    Tyres: { status: 'NORMAL', notes: '' },
    Suspension: { status: 'NORMAL', notes: '' },
    Lights: { status: 'NORMAL', notes: '' },
    Fluids: { status: 'NORMAL', notes: '' },
    AC: { status: 'NORMAL', notes: '' },
    Others: { status: 'NORMAL', notes: '' },
  });

  // Step 4: Work & Parts
  const [labourLines, setLabourLines] = useState<Array<{ description: string; quantity: number; unit_price: number; catalog_id?: number }>>([
  ]);

  const [partLines, setPartLines] = useState<Array<{ description: string; part_number?: string; unit: string; quantity: number; unit_price: number; catalog_id?: number }>>([
  ]);

  // Step 5: Approval
  const [approvals, setApprovals] = useState<Record<string, 'APPROVED' | 'REJECTED'>>({});
  const [approverName, setApproverName] = useState('');
  const [approvalMethod, setApprovalMethod] = useState<'PHONE' | 'IN_PERSON'>('PHONE');

  // Step 6: Result
  const [createdJobCard, setCreatedJobCard] = useState<any>(null);

  // Safeguards & Draft auto-save
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [savedDraftAvailable, setSavedDraftAvailable] = useState<any>(null);
  const [isDirty, setIsDirty] = useState(false);

  const DRAFT_KEY = 'pr_draft_new_job_card';
  const isFormDirty = isDirty || step > 1;

  // Check if draft exists on open
  useEffect(() => {
    if (isOpen) {
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.timestamp && step === 1 && !isDirty) {
            setSavedDraftAvailable(parsed);
          }
        }
      } catch (e) {
        console.warn('Failed to parse draft job card', e);
      }
    }
  }, [isOpen]);

  // Auto-save draft whenever inputs are dirty
  useEffect(() => {
    if (isOpen && isFormDirty && step < 6) {
      const draft = {
        step,
        customerData,
        vehicleData,
        jobCardNotes,
        promisedAt,
        assignedTo,
        complaints,
        inspections,
        labourLines,
        partLines,
        approvals,
        approverName,
        approvalMethod,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }
  }, [isOpen, isFormDirty, step, customerData, vehicleData, jobCardNotes, promisedAt, assignedTo, complaints, inspections, labourLines, partLines, approvals, approverName, approvalMethod]);

  // Clear draft on job card creation (step 6)
  useEffect(() => {
    if (step === 6) {
      localStorage.removeItem(DRAFT_KEY);
      setIsDirty(false);
      setSavedDraftAvailable(null);
    }
  }, [step]);

  // Window beforeunload prompt to prevent losing unsubmitted changes
  useEffect(() => {
    if (!isOpen || step === 6 || !isFormDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isOpen, step, isFormDirty]);

  // Global ESC key listener to safely request close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDiscardModal) {
          setShowDiscardModal(false);
        } else {
          handleRequestClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFormDirty, step, showDiscardModal]);

  const handleRequestClose = () => {
    if (isFormDirty && step < 6) {
      setShowDiscardModal(true);
    } else {
      onClose();
    }
  };

  const handleConfirmDiscard = () => {
    setShowDiscardModal(false);
    localStorage.removeItem(DRAFT_KEY);
    setIsDirty(false);
    setSavedDraftAvailable(null);
    onClose();
  };

  const handleRestoreSavedDraft = () => {
    if (!savedDraftAvailable) return;
    try {
      if (savedDraftAvailable.customerData) setCustomerData(savedDraftAvailable.customerData);
      if (savedDraftAvailable.vehicleData) setVehicleData(savedDraftAvailable.vehicleData);
      if (savedDraftAvailable.jobCardNotes) setJobCardNotes(savedDraftAvailable.jobCardNotes);
      if (savedDraftAvailable.promisedAt) setPromisedAt(savedDraftAvailable.promisedAt);
      if (savedDraftAvailable.assignedTo) setAssignedTo(savedDraftAvailable.assignedTo);
      if (savedDraftAvailable.complaints) setComplaints(savedDraftAvailable.complaints);
      if (savedDraftAvailable.inspections) setInspections(savedDraftAvailable.inspections);
      if (savedDraftAvailable.labourLines) setLabourLines(savedDraftAvailable.labourLines);
      if (savedDraftAvailable.partLines) setPartLines(savedDraftAvailable.partLines);
      if (savedDraftAvailable.approvals) setApprovals(savedDraftAvailable.approvals);
      if (savedDraftAvailable.approverName) setApproverName(savedDraftAvailable.approverName);
      if (savedDraftAvailable.approvalMethod) setApprovalMethod(savedDraftAvailable.approvalMethod);
      if (savedDraftAvailable.step && savedDraftAvailable.step < 6) setStep(savedDraftAvailable.step);
      setIsDirty(true);
      setSavedDraftAvailable(null);
    } catch (e) {
      console.error('Failed to restore draft', e);
    }
  };

  const handleDiscardSavedDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setSavedDraftAvailable(null);
  };

  useEffect(() => {
    if (isOpen) {
      // Load catalogs
      apiRequest<any[]>('/catalogs/labour').then(setLabourCatalog).catch(() => {});
      apiRequest<any[]>('/catalogs/parts').then(setPartsCatalog).catch(() => {});
      // Load staff list for technician assignment (admin only)
      if (user?.role === 'ADMIN') {
        apiRequest<any[]>('/users').then(setStaffList).catch(() => {});
      }
    }
  }, [isOpen]);

  // Search existing vehicle
  const handleSearchVehicle = async () => {
    if (!searchReg.trim()) return;
    try {
      const res = await apiRequest<{ vehicles: any[] }>(`/search?q=${encodeURIComponent(searchReg.trim())}`);
      if (res.vehicles && res.vehicles.length > 0) {
        const v = res.vehicles[0];
        setFoundVehicle(v);
        setVehicleData({
          registration_number: v.registration_number,
          make: v.make,
          model: v.model,
          variant: v.variant || '',
          fuel_type: v.fuel_type || 'Petrol',
          odometer: v.current_odometer,
          fuel_level: '1/2',
          vin: v.vin || '',
          engine_number: v.engine_number || '',
          year: v.year || '',
          colour: v.colour || '',
        });
        setCustomerData({
          name: v.customer_name,
          phone: v.customer_phone,
          alt_phone: '',
          email: '',
          address: '',
        });
        setApproverName(v.customer_name);
        
        // Load details for previous service
        const vDetail = await apiRequest<any>(`/vehicles/${v.id}`);
        if (vDetail.history && vDetail.history.length > 0) {
          setLastServiceInfo(vDetail.history[0]);
        }
      } else {
        alert('No registered vehicle found. You can fill out the form to register new.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add Labour line helper
  const addLabourFromCatalog = (catalogItem: any) => {
    setLabourLines([
      ...labourLines,
      {
        description: catalogItem.name,
        quantity: 1,
        unit_price: catalogItem.default_rate,
        catalog_id: catalogItem.id,
      },
    ]);
  };

  // Add Part line helper
  const addPartFromCatalog = (catalogItem: any) => {
    setPartLines([
      ...partLines,
      {
        description: catalogItem.name,
        part_number: catalogItem.part_number,
        unit: catalogItem.unit || 'pcs',
        quantity: 1,
        unit_price: catalogItem.default_price,
        catalog_id: catalogItem.id,
      },
    ]);
  };

  // Calculate live preview total based on approvals
  const calculatePreviewTotals = () => {
    let partsTotal = 0;
    let estimatedPartsTotal = 0;
    partLines.forEach((p, idx) => {
      const lineTot = Math.round(p.quantity * p.unit_price);
      estimatedPartsTotal += lineTot;
      const appr = approvals[`part_${idx}`];
      if (appr === 'APPROVED' || (!appr && step <= 4)) {
        partsTotal += lineTot;
      }
    });

    let labourTotal = 0;
    let estimatedLabourTotal = 0;
    labourLines.forEach((l, idx) => {
      const lineTot = Math.round(l.quantity * l.unit_price);
      estimatedLabourTotal += lineTot;
      const appr = approvals[`labour_${idx}`];
      if (appr === 'APPROVED' || (!appr && step <= 4)) {
        labourTotal += lineTot;
      }
    });

    const otherCharges = 0;
    const discount = 0;
    const subtotal = partsTotal + labourTotal + otherCharges;
    const grandTotal = Math.max(0, subtotal - discount);

    return {
      partsTotal,
      labourTotal,
      otherCharges,
      discount,
      grandTotal,
      estimatedPartsTotal,
      estimatedLabourTotal,
      estimatedGrandTotal: estimatedPartsTotal + estimatedLabourTotal
    };
  };

  // Submit and create full Job Card
  const handleFinalSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Create or get customer
      let customerId = foundVehicle?.customer_id;
      if (!customerId) {
        try {
          const cRes = await apiRequest<any>('/customers', {
            method: 'POST',
            body: JSON.stringify({
              name: customerData.name.trim(),
              phone: customerData.phone.trim(),
              alt_phone: customerData.alt_phone.trim() || undefined,
              email: customerData.email.trim() || undefined,
              address: customerData.address.trim() || undefined,
            }),
          });
          customerId = cRes.id;
        } catch (cErr: any) {
          if (cErr.message.includes('already exists') || cErr.message.includes('409')) {
            // Find existing customer
            const searchCust = await apiRequest<any>(`/customers?search=${customerData.phone}`);
            if (searchCust && searchCust.length > 0) {
              customerId = searchCust[0].id;
            }
          } else {
            throw cErr;
          }
        }
      }

      // 2. Create or get vehicle
      let vehicleId = foundVehicle?.id;
      if (!vehicleId) {
        try {
          const vRes = await apiRequest<any>('/vehicles', {
            method: 'POST',
            body: JSON.stringify({
              registration_number: vehicleData.registration_number.trim(),
              make: vehicleData.make.trim(),
              model: vehicleData.model.trim(),
              variant: vehicleData.variant.trim() || undefined,
              fuel_type: vehicleData.fuel_type,
              current_odometer: Number(vehicleData.odometer) || 0,
              vin: vehicleData.vin.trim() || undefined,
              engine_number: vehicleData.engine_number.trim() || undefined,
              year: vehicleData.year ? Number(vehicleData.year) : undefined,
              colour: vehicleData.colour.trim() || undefined,
              customer_id: customerId,
            }),
          });
          vehicleId = vRes.id;
        } catch (vErr: any) {
          const searchV = await apiRequest<any>(`/vehicles?search=${vehicleData.registration_number}`);
          if (searchV && searchV.length > 0) {
            vehicleId = searchV[0].id;
          } else {
            throw vErr;
          }
        }
      }

      // 3. Create Job Card
      const jcRes = await apiRequest<any>('/job-cards', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: customerId,
          vehicle_id: vehicleId,
          odometer: Number(vehicleData.odometer),
          fuel_level: vehicleData.fuel_level,
          complaints: complaints,
          notes: jobCardNotes.trim() || undefined,
          assigned_to: assignedTo ? Number(assignedTo) : undefined,
          promised_at: promisedAt ? new Date(promisedAt).toISOString() : undefined,
        }),
      });
      const jcId = jcRes.id;

      // 4. Update Inspections
      const inspPayload = Object.entries(inspections).map(([cat, val]) => ({
        category: cat,
        status: val.status,
        notes: val.notes || null,
      }));
      await apiRequest(`/job-cards/${jcId}/inspections`, {
        method: 'PUT',
        body: JSON.stringify(inspPayload),
      });

      // 5. Add Labour Items
      const createdLabour: any[] = [];
      for (let i = 0; i < labourLines.length; i++) {
        const l = labourLines[i];
        const status = approvals[`labour_${i}`] || 'APPROVED';
        const res = await apiRequest(`/job-cards/${jcId}/labour-items`, {
          method: 'POST',
          body: JSON.stringify({ ...l, status }),
        });
        createdLabour.push(res);
      }

      // 6. Add Parts Items
      const createdParts: any[] = [];
      for (let i = 0; i < partLines.length; i++) {
        const p = partLines[i];
        const status = approvals[`part_${i}`] || 'RECOMMENDED';
        const res = await apiRequest(`/job-cards/${jcId}/parts-items`, {
          method: 'POST',
          body: JSON.stringify({ ...p, status }),
        });
        createdParts.push(res);
      }

      // 7. Record Approvals
      const lineApprovals: any[] = [];
      createdLabour.forEach((l, idx) => {
        lineApprovals.push({
          type: 'labour',
          id: l.id,
          status: approvals[`labour_${idx}`] || 'APPROVED',
        });
      });
      createdParts.forEach((p, idx) => {
        lineApprovals.push({
          type: 'part',
          id: p.id,
          status: approvals[`part_${idx}`] || 'RECOMMENDED',
        });
      });

      await apiRequest(`/job-cards/${jcId}/approvals`, {
        method: 'POST',
        body: JSON.stringify({
          approved_by_name: approverName || customerData.name,
          method: approvalMethod,
          note: 'Intake approval captured',
          line_approvals: lineApprovals,
        }),
      });

      // Get updated Job Card Detail
      const finalDetail = await apiRequest<any>(`/job-cards/${jcId}`);
      setCreatedJobCard(finalDetail);
      setStep(6);
      onJobCardCreated(jcId);
    } catch (err: any) {
      console.error('Job card creation error:', err);
      setError(err.message || 'Failed to create job card');
    } finally {
      setLoading(false);
    }
  };

  const totals = calculatePreviewTotals();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/60 backdrop-blur-sm p-3 sm:p-4 md:p-6 flex flex-col items-center justify-start sm:justify-center cursor-pointer"
      onClick={handleRequestClose}
    >
      <div
        className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-workshop-border overflow-hidden my-auto shrink-0 flex flex-col max-h-[92vh] cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header with 6-Step Indicator */}
        <div className="px-6 py-4 border-b border-workshop-border bg-[#F8FAFC] flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-display font-bold text-xl text-workshop-text">
              New Vehicle Service Job Card
            </h3>
            <p className="text-xs text-workshop-muted">
              Guided 6-step workshop intake flow
            </p>
          </div>
          <button
            type="button"
            onClick={handleRequestClose}
            className="p-1.5 rounded-lg hover:bg-gray-200 text-workshop-muted transition cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Bar */}
        <div className="px-6 py-3 bg-white border-b border-workshop-border flex items-center justify-between text-xs overflow-x-auto shrink-0">
          {[
            '1. Customer & Vehicle',
            '2. Complaints',
            '3. Inspection',
            '4. Work & Parts',
            '5. Approval',
            '6. Summary'
          ].map((title, idx) => {
            const stepNum = idx + 1;
            const isCurrent = step === stepNum;
            const isDone = step > stepNum;
            return (
              <div
                key={title}
                className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1 rounded-full ${
                  isCurrent
                    ? 'bg-brand text-white font-bold'
                    : isDone
                    ? 'bg-workshop-green-bg text-workshop-green font-semibold'
                    : 'text-workshop-muted'
                }`}
              >
                {isDone && <Check className="w-3.5 h-3.5" />}
                <span>{title}</span>
              </div>
            );
          })}
        </div>

        {/* Body content (scrollable) */}
        <div className="p-6 overflow-y-auto overscroll-contain flex-1 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {/* STEP 1: Customer & Vehicle */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Saved Draft Recovery Banner */}
              {savedDraftAvailable && (
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-brand shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-brand-deep">Unsubmitted Draft Found</div>
                      <div className="text-[11px] text-workshop-muted">
                        An unfinished job card was saved from {new Date(savedDraftAvailable.timestamp).toLocaleString('en-IN')}.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={handleDiscardSavedDraft}
                      className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-800 font-medium cursor-pointer"
                    >
                      Discard Draft
                    </button>
                    <button
                      type="button"
                      onClick={handleRestoreSavedDraft}
                      className="px-3 py-1 bg-brand hover:bg-brand-deep text-white text-xs font-bold rounded-lg transition cursor-pointer shadow-2xs"
                    >
                      Restore Draft
                    </button>
                  </div>
                </div>
              )}
              {/* Returning Vehicle Quick Search */}
              <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200/80 flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="text-sm">
                  <span className="font-bold text-brand-deep">Returning Vehicle?</span>
                  <div className="text-xs text-workshop-muted">Type plate number to auto-populate customer &amp; vehicle history.</div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    placeholder="e.g. AP 31 XX 1234"
                    value={searchReg}
                    onChange={(e) => setSearchReg(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white w-full sm:w-44 focus:outline-none"
                  />
                  <button
                    onClick={handleSearchVehicle}
                    className="px-3 py-1.5 bg-brand hover:bg-brand-deep text-white text-xs font-semibold rounded-lg"
                  >
                    Lookup
                  </button>
                </div>
              </div>

              {/* Inline Previous Service Card (FR-HIS-003) */}
              {lastServiceInfo && (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
                  <span className="font-bold text-sm text-amber-950">Previous Service on Record:</span>
                  <div>Date: <span className="font-semibold">{lastServiceInfo.date}</span> &bull; Job Card: <span className="font-mono font-semibold">{lastServiceInfo.job_card_number}</span> &bull; Odometer: <span className="font-semibold">{lastServiceInfo.odometer} km</span></div>
                  <div>Work carried out: <span className="font-medium">{lastServiceInfo.work_summary}</span></div>
                </div>
              )}

              {/* Customer Fields */}
              <div>
                <h4 className="font-bold text-sm text-brand-deep mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-brand" /> Customer Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-workshop-text mb-1">Customer Name *</label>
                    <input
                      type="text"
                      required
                      value={customerData.name}
                      onChange={(e) => setCustomerData({ ...customerData, name: e.target.value })}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-workshop-text mb-1">Mobile Number *</label>
                    <input
                      type="text"
                      required
                      value={customerData.phone}
                      onChange={(e) => setCustomerData({ ...customerData, phone: e.target.value })}
                      placeholder="e.g. 9876543210"
                      className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-workshop-text mb-1">Alternate Phone</label>
                    <input
                      type="text"
                      value={customerData.alt_phone}
                      onChange={(e) => setCustomerData({ ...customerData, alt_phone: e.target.value })}
                      placeholder="Optional"
                      className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-workshop-text mb-1">Email</label>
                    <input
                      type="email"
                      value={customerData.email}
                      onChange={(e) => setCustomerData({ ...customerData, email: e.target.value })}
                      placeholder="Optional"
                      className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm"
                    />
                  </div>
                  <div className="md:col-span-4">
                    <label className="block text-xs font-semibold text-workshop-text mb-1">Address</label>
                    <input
                      type="text"
                      value={customerData.address}
                      onChange={(e) => setCustomerData({ ...customerData, address: e.target.value })}
                      placeholder="Street, Area, City (Optional)"
                      className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Vehicle Fields */}
              <div>
                <h4 className="font-bold text-sm text-brand-deep mb-3 flex items-center gap-2">
                  <Car className="w-4 h-4 text-brand" /> Vehicle Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-workshop-text mb-1">Registration Plate *</label>
                    <input
                      type="text"
                      required
                      value={vehicleData.registration_number}
                      onChange={(e) => setVehicleData({ ...vehicleData, registration_number: e.target.value })}
                      placeholder="e.g. KA01AB1234"
                      className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-workshop-text mb-1">Make / Brand *</label>
                    <input
                      type="text"
                      required
                      value={vehicleData.make}
                      onChange={(e) => setVehicleData({ ...vehicleData, make: e.target.value })}
                      placeholder="e.g. Hyundai"
                      className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-workshop-text mb-1">Model *</label>
                    <input
                      type="text"
                      required
                      value={vehicleData.model}
                      onChange={(e) => setVehicleData({ ...vehicleData, model: e.target.value })}
                      placeholder="e.g. Creta"
                      className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-workshop-text mb-1">Variant (Optional)</label>
                    <input
                      type="text"
                      value={vehicleData.variant}
                      onChange={(e) => setVehicleData({ ...vehicleData, variant: e.target.value })}
                      placeholder="e.g. SX (O), VXi, Sportz"
                      className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-workshop-text mb-1">Fuel Type</label>
                    <select
                      value={vehicleData.fuel_type}
                      onChange={(e) => setVehicleData({ ...vehicleData, fuel_type: e.target.value })}
                      className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm bg-white"
                    >
                      <option>Petrol</option>
                      <option>Diesel</option>
                      <option>CNG</option>
                      <option>Electric</option>
                      <option>Hybrid</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-workshop-text mb-1">Current Odometer (km) *</label>
                    <input
                      type="number"
                      required
                      value={vehicleData.odometer}
                      onChange={(e) => setVehicleData({ ...vehicleData, odometer: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-workshop-text mb-1">Fuel Level at Intake</label>
                    <div className="flex items-center gap-1 bg-workshop-bg rounded-lg p-2 border border-workshop-border">
                      <span className="text-[10px] font-bold text-workshop-red mr-1">E</span>
                      {['E', '1/4', '1/2', '3/4', 'F'].map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setVehicleData({ ...vehicleData, fuel_level: level })}
                          className={`flex-1 py-1.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                            vehicleData.fuel_level === level
                              ? level === 'E'
                                ? 'bg-workshop-red text-white shadow-sm'
                                : level === 'F'
                                  ? 'bg-workshop-green text-white shadow-sm'
                                  : 'bg-brand text-white shadow-sm'
                              : 'bg-white text-workshop-muted hover:bg-gray-100 border border-gray-200'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                      <span className="text-[10px] font-bold text-workshop-green ml-1">F</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-workshop-text mb-1">Year of Manufacture</label>
                    <input
                      type="number"
                      value={vehicleData.year}
                      onChange={(e) => setVehicleData({ ...vehicleData, year: e.target.value })}
                      placeholder="e.g. 2021"
                      className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-workshop-text mb-1">Vehicle Colour</label>
                    <input
                      type="text"
                      value={vehicleData.colour}
                      onChange={(e) => setVehicleData({ ...vehicleData, colour: e.target.value })}
                      placeholder="e.g. Polar White, Phantom Black"
                      className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-workshop-text mb-1">VIN / Chassis # (Optional)</label>
                    <input
                      type="text"
                      value={vehicleData.vin}
                      onChange={(e) => setVehicleData({ ...vehicleData, vin: e.target.value })}
                      placeholder="e.g. MALBA51..."
                      className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-workshop-text mb-1">Engine Number (Optional)</label>
                    <input
                      type="text"
                      value={vehicleData.engine_number}
                      onChange={(e) => setVehicleData({ ...vehicleData, engine_number: e.target.value })}
                      placeholder="e.g. G4LA123456"
                      className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm font-mono uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Job Card Intake & Assignment */}
              <div className="pt-2 border-t border-workshop-border">
                <h4 className="font-bold text-sm text-brand-deep mb-3 flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-brand" /> Intake Details & Delivery
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-workshop-text mb-1">Promised Delivery Date & Time (Optional)</label>
                    <input
                      type="datetime-local"
                      value={promisedAt}
                      onChange={(e) => setPromisedAt(e.target.value)}
                      className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-workshop-text mb-1">Assign Technician (Optional)</label>
                    <select
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm bg-white"
                    >
                      <option value="">Unassigned</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} ({s.role})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-workshop-text mb-1">Intake Notes / Instructions (Optional)</label>
                    <textarea
                      rows={2}
                      value={jobCardNotes}
                      onChange={(e) => setJobCardNotes(e.target.value)}
                      placeholder="Customer special requests, vehicle condition on intake, existing scratches or dents, items in boot, etc."
                      className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Complaints */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h4 className="font-bold text-sm text-workshop-text mb-1">Itemised Customer Complaints</h4>
                <p className="text-xs text-workshop-muted mb-4">Each issue reported by the customer is recorded as an individual item.</p>

                {/* Add new complaint input */}
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newComplaintInput}
                    onChange={(e) => setNewComplaintInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newComplaintInput.trim()) {
                        e.preventDefault();
                        setComplaints([...complaints, newComplaintInput.trim()]);
                        setNewComplaintInput('');
                      }
                    }}
                    placeholder="Type complaint and press Enter or Add..."
                    className="flex-1 px-3 py-2 border border-workshop-border rounded-lg text-sm"
                  />
                  <button
                    onClick={() => {
                      if (newComplaintInput.trim()) {
                        setComplaints([...complaints, newComplaintInput.trim()]);
                        setNewComplaintInput('');
                      }
                    }}
                    className="px-4 py-2 bg-brand text-white font-semibold text-sm rounded-lg hover:bg-brand-deep"
                  >
                    + Add
                  </button>
                </div>

                {/* List of current complaints */}
                <div className="space-y-2 mb-6">
                  {complaints.map((c, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 border border-workshop-border rounded-lg text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs bg-gray-200 px-2 py-0.5 rounded text-workshop-muted">{idx + 1}</span>
                        <span>{c}</span>
                      </div>
                      <button
                        onClick={() => setComplaints(complaints.filter((_, i) => i !== idx))}
                        className="text-workshop-muted hover:text-workshop-red p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {complaints.length === 0 && (
                    <div className="text-xs text-workshop-muted py-4 text-center">No complaints recorded yet.</div>
                  )}
                </div>

                {/* Quick suggestions */}
                <div>
                  <span className="text-xs font-bold text-workshop-muted uppercase tracking-wider block mb-2">Common Complaint Suggestions:</span>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_COMPLAINTS.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          if (!complaints.includes(item)) {
                            setComplaints([...complaints, item]);
                          }
                        }}
                        className="text-xs px-2.5 py-1.5 bg-gray-100 hover:bg-blue-50 hover:text-brand border border-workshop-border rounded-full transition cursor-pointer"
                      >
                        + {item}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Inspection Checklist */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-sm text-workshop-text mb-1">Standard Intake Inspection Checklist</h4>
                <p className="text-xs text-workshop-muted mb-4">Mark category health and add diagnosis observations.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {STANDARD_CATEGORIES.map((cat) => {
                  const item = inspections[cat] || { status: 'NORMAL', notes: '' };
                  const isAttention = item.status === 'NEEDS_ATTENTION';

                  return (
                    <div
                      key={cat}
                      className={`p-3.5 rounded-xl border transition ${
                        isAttention ? 'border-amber-300 bg-amber-50/40' : 'border-workshop-border bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm text-workshop-text">{cat}</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setInspections({
                                ...inspections,
                                [cat]: { ...item, status: 'NORMAL' },
                              });
                            }}
                            className={`text-xs px-2.5 py-1 rounded-md font-semibold transition ${
                              !isAttention
                                ? 'bg-workshop-green-bg text-workshop-green border border-green-300'
                                : 'bg-gray-100 text-workshop-muted'
                            }`}
                          >
                            Normal
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setInspections({
                                ...inspections,
                                [cat]: { ...item, status: 'NEEDS_ATTENTION' },
                              });
                            }}
                            className={`text-xs px-2.5 py-1 rounded-md font-semibold transition ${
                              isAttention
                                ? 'bg-workshop-amber-bg text-workshop-amber border border-amber-300'
                                : 'bg-gray-100 text-workshop-muted'
                            }`}
                          >
                            Needs Attention
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        placeholder="Add inspection notes / findings..."
                        value={item.notes}
                        onChange={(e) => {
                          setInspections({
                            ...inspections,
                            [cat]: { ...item, notes: e.target.value },
                          });
                        }}
                        className="w-full text-xs px-2.5 py-1.5 border border-workshop-border rounded-md bg-white focus:outline-none"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: Work & Parts */}
          {step === 4 && (
            <div className="space-y-6">
              
              {/* Labour Items Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-sm text-workshop-text">Labour &amp; Services</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-workshop-muted">Add from catalog:</span>
                    <select
                      onChange={(e) => {
                        const sel = labourCatalog.find((c) => c.id === Number(e.target.value));
                        if (sel) addLabourFromCatalog(sel);
                        e.target.value = '';
                      }}
                      className="text-xs px-2.5 py-1 border border-workshop-border rounded-lg bg-white"
                    >
                      <option value="">-- Select Labour Catalog --</option>
                      {labourCatalog.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({formatINR(c.default_rate)})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <table className="w-full text-left text-xs border border-workshop-border rounded-lg overflow-hidden">
                  <thead className="bg-[#F8FAFC] border-b border-workshop-border text-workshop-muted uppercase">
                    <tr>
                      <th className="p-2.5">Description</th>
                      <th className="p-2.5 w-20 text-right">Qty</th>
                      <th className="p-2.5 w-32 text-right">Rate (₹)</th>
                      <th className="p-2.5 w-32 text-right">Total</th>
                      <th className="p-2.5 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-workshop-border-soft">
                    {labourLines.map((l, idx) => (
                      <tr key={idx}>
                        <td className="p-2">
                          <input
                            type="text"
                            value={l.description}
                            onChange={(e) => {
                              const updated = [...labourLines];
                              updated[idx].description = e.target.value;
                              setLabourLines(updated);
                            }}
                            className="w-full px-2 py-1 border border-transparent hover:border-gray-300 rounded"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            value={l.quantity}
                            onChange={(e) => {
                              const updated = [...labourLines];
                              updated[idx].quantity = Number(e.target.value);
                              setLabourLines(updated);
                            }}
                            className="w-16 px-2 py-1 text-right border border-gray-200 rounded font-mono"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            value={l.unit_price / 100}
                            onChange={(e) => {
                              const updated = [...labourLines];
                              updated[idx].unit_price = Math.round(Number(e.target.value) * 100);
                              setLabourLines(updated);
                            }}
                            className="w-24 px-2 py-1 text-right border border-gray-200 rounded font-mono"
                          />
                        </td>
                        <td className="p-2 text-right font-mono font-bold">
                          {formatINR(Math.round(l.quantity * l.unit_price))}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => setLabourLines(labourLines.filter((_, i) => i !== idx))}
                            className="text-workshop-muted hover:text-workshop-red"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button
                  type="button"
                  onClick={() => setLabourLines([...labourLines, { description: '', quantity: 1, unit_price: 0 }])}
                  className="mt-2 text-xs font-semibold text-brand flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> + Add Custom Labour Line
                </button>
              </div>

              {/* Parts Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-sm text-workshop-text">Parts &amp; Materials</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-workshop-muted">Add from catalog:</span>
                    <select
                      onChange={(e) => {
                        const sel = partsCatalog.find((c) => c.id === Number(e.target.value));
                        if (sel) addPartFromCatalog(sel);
                        e.target.value = '';
                      }}
                      className="text-xs px-2.5 py-1 border border-workshop-border rounded-lg bg-white"
                    >
                      <option value="">-- Select Parts Catalog --</option>
                      {partsCatalog.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({formatINR(c.default_price)})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <table className="w-full text-left text-xs border border-workshop-border rounded-lg overflow-hidden">
                  <thead className="bg-[#F8FAFC] border-b border-workshop-border text-workshop-muted uppercase">
                    <tr>
                      <th className="p-2.5">Part Description</th>
                      <th className="p-2.5 w-16">Unit</th>
                      <th className="p-2.5 w-20 text-right">Qty</th>
                      <th className="p-2.5 w-32 text-right">Price (₹)</th>
                      <th className="p-2.5 w-32 text-right">Total</th>
                      <th className="p-2.5 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-workshop-border-soft">
                    {partLines.map((p, idx) => (
                      <tr key={idx}>
                        <td className="p-2">
                          <input
                            type="text"
                            value={p.description}
                            onChange={(e) => {
                              const updated = [...partLines];
                              updated[idx].description = e.target.value;
                              setPartLines(updated);
                            }}
                            className="w-full px-2 py-1 border border-transparent hover:border-gray-300 rounded"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={p.unit}
                            onChange={(e) => {
                              const updated = [...partLines];
                              updated[idx].unit = e.target.value;
                              setPartLines(updated);
                            }}
                            className="w-14 px-1 py-1 border border-gray-200 rounded text-center"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            step="0.1"
                            value={p.quantity}
                            onChange={(e) => {
                              const updated = [...partLines];
                              updated[idx].quantity = Number(e.target.value);
                              setPartLines(updated);
                            }}
                            className="w-16 px-2 py-1 text-right border border-gray-200 rounded font-mono"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            value={p.unit_price / 100}
                            onChange={(e) => {
                              const updated = [...partLines];
                              updated[idx].unit_price = Math.round(Number(e.target.value) * 100);
                              setPartLines(updated);
                            }}
                            className="w-24 px-2 py-1 text-right border border-gray-200 rounded font-mono"
                          />
                        </td>
                        <td className="p-2 text-right font-mono font-bold">
                          {formatINR(Math.round(p.quantity * p.unit_price))}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => setPartLines(partLines.filter((_, i) => i !== idx))}
                            className="text-workshop-muted hover:text-workshop-red"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button
                  type="button"
                  onClick={() => setPartLines([...partLines, { description: '', unit: 'pcs', quantity: 1, unit_price: 0 }])}
                  className="mt-2 text-xs font-semibold text-brand flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> + Add Custom Part
                </button>

                {/* Step 4 Live Running Estimate */}
                <div className="p-3 bg-gray-50 border border-workshop-border rounded-xl flex items-center justify-between text-xs mt-3">
                  <span className="text-workshop-muted">
                    Total Work Added: <span className="font-semibold text-workshop-text">{labourLines.length} labour lines, {partLines.length} parts</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-workshop-muted font-medium">Estimated Work Total:</span>
                    <span className="font-mono font-bold text-base text-brand-deep">{formatINR(totals.estimatedGrandTotal)}</span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* STEP 5: Customer Approval */}
          {step === 5 && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h4 className="font-bold text-sm text-workshop-text">Customer Approval / Estimate Decision</h4>
                  <p className="text-xs text-workshop-muted">
                    Toggle Approve/Reject per line. Rejected lines are preserved for history but strictly excluded from billing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const allAppr: Record<string, 'APPROVED' | 'REJECTED'> = {};
                    partLines.forEach((_, idx) => (allAppr[`part_${idx}`] = 'APPROVED'));
                    labourLines.forEach((_, idx) => (allAppr[`labour_${idx}`] = 'APPROVED'));
                    setApprovals(allAppr);
                  }}
                  className="text-xs px-3 py-1.5 bg-green-50 text-workshop-green border border-green-300 rounded-lg font-bold hover:bg-green-100"
                >
                  ✓ Approve All
                </button>
              </div>

              {/* Approval Rows */}
              <div className="space-y-2">
                {/* Parts */}
                <span className="text-xs font-bold text-workshop-muted uppercase tracking-wider block">Parts</span>
                {partLines.map((p, idx) => {
                  const key = `part_${idx}`;
                  const isApproved = approvals[key] === 'APPROVED';
                  const isRejected = approvals[key] === 'REJECTED';

                  return (
                    <div
                      key={key}
                      className={`p-3 rounded-xl border flex items-center justify-between text-sm transition ${
                        isRejected ? 'bg-red-50/50 border-red-200 opacity-75' : isApproved ? 'bg-white border-green-200' : 'bg-gray-50 border-workshop-border'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          isApproved ? 'bg-workshop-green-bg text-workshop-green' : isRejected ? 'bg-workshop-red-bg text-workshop-red' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {isApproved ? 'Approved' : isRejected ? 'Rejected' : 'Recommended'}
                        </span>
                        <div>
                          <span className={`font-medium ${isRejected ? 'line-through text-workshop-muted' : 'text-workshop-text'}`}>
                            {p.description}
                          </span>
                          <span className="text-xs text-workshop-muted ml-2">({p.quantity} {p.unit})</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="font-mono font-bold text-sm">{formatINR(Math.round(p.quantity * p.unit_price))}</span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setApprovals({ ...approvals, [key]: 'APPROVED' })}
                            className={`px-3 py-1 rounded text-xs font-bold cursor-pointer transition ${
                              isApproved ? 'bg-workshop-green text-white' : 'bg-gray-100 text-workshop-muted hover:bg-gray-200'
                            }`}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => setApprovals({ ...approvals, [key]: 'REJECTED' })}
                            className={`px-3 py-1 rounded text-xs font-bold cursor-pointer transition ${
                              isRejected ? 'bg-workshop-red text-white' : 'bg-gray-100 text-workshop-muted hover:bg-gray-200'
                            }`}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Labour */}
                <span className="text-xs font-bold text-workshop-muted uppercase tracking-wider block pt-2">Labour</span>
                {labourLines.map((l, idx) => {
                  const key = `labour_${idx}`;
                  const isApproved = approvals[key] === 'APPROVED';
                  const isRejected = approvals[key] === 'REJECTED';

                  return (
                    <div
                      key={key}
                      className={`p-3 rounded-xl border flex items-center justify-between text-sm transition ${
                        isRejected ? 'bg-red-50/50 border-red-200 opacity-75' : isApproved ? 'bg-white border-green-200' : 'bg-gray-50 border-workshop-border'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          isApproved ? 'bg-workshop-green-bg text-workshop-green' : isRejected ? 'bg-workshop-red-bg text-workshop-red' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {isApproved ? 'Approved' : isRejected ? 'Rejected' : 'Recommended'}
                        </span>
                        <span className={`font-medium ${isRejected ? 'line-through text-workshop-muted' : 'text-workshop-text'}`}>
                          {l.description}
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="font-mono font-bold text-sm">{formatINR(Math.round(l.quantity * l.unit_price))}</span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setApprovals({ ...approvals, [key]: 'APPROVED' })}
                            className={`px-3 py-1 rounded text-xs font-bold cursor-pointer transition ${
                              isApproved ? 'bg-workshop-green text-white' : 'bg-gray-100 text-workshop-muted hover:bg-gray-200'
                            }`}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => setApprovals({ ...approvals, [key]: 'REJECTED' })}
                            className={`px-3 py-1 rounded text-xs font-bold cursor-pointer transition ${
                              isRejected ? 'bg-workshop-red text-white' : 'bg-gray-100 text-workshop-muted hover:bg-gray-200'
                            }`}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Live Preview Summary Card */}
              <div className="p-4 bg-gray-50 border border-workshop-border rounded-xl space-y-2">
                <div className="flex justify-between text-xs text-workshop-muted">
                  <span>Parts Total (Approved):</span>
                  <span className="font-mono">{formatINR(totals.partsTotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-workshop-muted">
                  <span>Labour Total (Approved):</span>
                  <span className="font-mono">{formatINR(totals.labourTotal)}</span>
                </div>
                {totals.otherCharges > 0 && (
                  <div className="flex justify-between text-xs text-workshop-muted">
                    <span>Consumables / Other Charges:</span>
                    <span className="font-mono">{formatINR(totals.otherCharges)}</span>
                  </div>
                )}
                {totals.discount > 0 && (
                  <div className="flex justify-between text-xs text-workshop-muted">
                    <span>Discount:</span>
                    <span className="font-mono text-workshop-red">-{formatINR(totals.discount)}</span>
                  </div>
                )}
                {totals.estimatedGrandTotal !== totals.grandTotal && (
                  <div className="flex justify-between text-xs text-workshop-muted pt-1 border-t border-gray-200">
                    <span>Original Quoted Work:</span>
                    <span className="font-mono">{formatINR(totals.estimatedGrandTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-workshop-text border-t border-workshop-border pt-2">
                  <span>Approved Billable Total:</span>
                  <span className="font-mono text-brand-deep text-lg">{formatINR(totals.grandTotal)}</span>
                </div>
              </div>

              {/* Approval Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-workshop-text mb-1">Approved By (Customer / Contact)</label>
                  <input
                    type="text"
                    value={approverName}
                    onChange={(e) => setApproverName(e.target.value)}
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-workshop-text mb-1">Approval Method</label>
                  <select
                    value={approvalMethod}
                    onChange={(e: any) => setApprovalMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm bg-white"
                  >
                    <option value="PHONE">Phone Call</option>
                    <option value="IN_PERSON">In Person at Workshop</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: Summary & Created Confirmation */}
          {step === 6 && createdJobCard && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-green-100 text-workshop-green rounded-full flex items-center justify-center mx-auto shadow-sm">
                <FileCheck className="w-8 h-8" />
              </div>
              <h4 className="font-display font-bold text-2xl text-workshop-text">
                Job Card Opened Successfully!
              </h4>
              <div className="font-mono font-bold text-xl text-brand-deep bg-blue-50 py-2 px-4 rounded-xl border border-blue-200 inline-block">
                {createdJobCard.job_card_number}
              </div>
              <p className="text-sm text-workshop-muted max-w-md mx-auto">
                Vehicle: <span className="font-semibold text-workshop-text">{createdJobCard.vehicle.registration_number}</span> ({createdJobCard.vehicle.make} {createdJobCard.vehicle.model}) &bull; Customer: <span className="font-semibold text-workshop-text">{createdJobCard.customer.name}</span>
              </p>

              <div className="flex justify-center gap-3 pt-4">
                <a
                  href={getPdfUrl(`/job-cards/${createdJobCard.id}/pdf`)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-workshop-text text-sm font-semibold rounded-lg transition cursor-pointer shadow-2xs"
                >
                  <Printer className="w-4 h-4" /> Print Job Card PDF
                </a>
                <button
                  type="button"
                  onClick={() => {
                    const msg = buildJobCardIntakeMessage({
                      customerName: createdJobCard.customer.name,
                      vehicleReg: createdJobCard.vehicle.registration_number,
                      vehicleModel: `${createdJobCard.vehicle.make || ''} ${createdJobCard.vehicle.model || ''}`.trim(),
                      jobCardNo: createdJobCard.job_card_number,
                      date: createdJobCard.date || new Date().toLocaleDateString('en-IN'),
                      odometer: createdJobCard.odometer,
                      fuelLevel: createdJobCard.fuel_level,
                      complaints: complaints.filter(Boolean),
                      workshop
                    });
                    setWhatsAppMessage(msg);
                    setShowWhatsAppModal(true);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#25D366] hover:bg-[#1DA851] text-white text-sm font-bold rounded-lg transition cursor-pointer shadow-md"
                >
                  <MessageCircle className="w-4 h-4 fill-white" /> Send WhatsApp Gatepass
                </button>
                <button
                  onClick={() => {
                    onClose();
                  }}
                  className="px-5 py-2.5 bg-brand hover:bg-brand-deep text-white text-sm font-semibold rounded-lg transition cursor-pointer"
                >
                  Go to Job Card Details
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer Navigation Buttons */}
        {step < 6 && (
          <div className="px-6 py-4 border-t border-workshop-border bg-gray-50 flex items-center justify-between shrink-0">
            <button
              type="button"
              disabled={step === 1}
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-workshop-text bg-white border border-workshop-border rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>

            {step < 5 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-brand rounded-lg hover:bg-brand-deep cursor-pointer shadow-xs"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={handleFinalSubmit}
                className="flex items-center gap-1.5 px-6 py-2.5 text-sm font-bold text-white bg-workshop-green rounded-lg hover:opacity-90 cursor-pointer shadow-md disabled:opacity-50"
              >
                {loading ? 'Creating Job Card...' : '✓ Open & Save Job Card'}
              </button>
            )}
          </div>
        )}

      </div>

      {/* Discard Confirmation Modal */}
      {showDiscardModal && (
        <div
          className="fixed inset-0 z-60 overflow-y-auto overscroll-contain bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setShowDiscardModal(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-workshop-border p-6 space-y-4 my-auto shrink-0 animate-in zoom-in-95 duration-150 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 mb-1">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-display font-bold text-lg text-workshop-text">
                Discard Unsaved Job Card?
              </h4>
              <p className="text-xs text-workshop-muted mt-1.5 leading-relaxed">
                You have active, unsubmitted intake data for this vehicle. If you exit now, entered complaints, inspections, and estimate lines will not be saved.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-workshop-border-soft">
              <button
                type="button"
                onClick={() => setShowDiscardModal(false)}
                className="px-4 py-2 border border-workshop-border rounded-lg text-xs font-semibold hover:bg-gray-50 transition cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={handleConfirmDiscard}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs transition cursor-pointer shadow-xs"
              >
                Discard &amp; Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Gatepass Modal */}
      {createdJobCard && (
        <WhatsAppPreviewModal
          isOpen={showWhatsAppModal}
          onClose={() => setShowWhatsAppModal(false)}
          title="Send Intake Gatepass on WhatsApp"
          customerName={createdJobCard.customer.name}
          customerPhone={createdJobCard.customer.phone}
          altPhone={createdJobCard.customer.alt_phone}
          initialMessage={whatsAppMessage}
        />
      )}

    </div>
  );
};

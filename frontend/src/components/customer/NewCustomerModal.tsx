import React, { useState } from 'react';
import { X, UserPlus, AlertTriangle } from 'lucide-react';
import { apiRequest } from '../../lib/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCustomerCreated: (id: number) => void;
}

export const NewCustomerModal: React.FC<Props> = ({ isOpen, onClose, onCustomerCreated }) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    alt_phone: '',
    address: '',
    email: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      setLoading(true);
      const res = await apiRequest('/customers', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      onCustomerCreated(res.id);
      onClose();
    } catch (err: any) {
      if (err.message && err.message.includes('already exists')) {
        setError('A customer with this mobile number is already registered in the system.');
      } else {
        setError(err.message || 'Failed to create customer');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-workshop-border overflow-hidden">
        <div className="px-5 py-4 border-b border-workshop-border bg-[#F8FAFC] flex items-center justify-between">
          <h3 className="font-bold text-base text-workshop-text flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-brand" /> Add New Customer
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-200 text-workshop-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 text-xs rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-workshop-text mb-1">Customer Full Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Ramesh Varma"
              className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-workshop-text mb-1">Primary Mobile Number *</label>
            <input
              type="text"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="e.g. 9876543210"
              className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-workshop-text mb-1">Alternate Phone</label>
              <input
                type="text"
                value={formData.alt_phone}
                onChange={(e) => setFormData({ ...formData, alt_phone: e.target.value })}
                className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-workshop-text mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-workshop-text mb-1">Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="e.g. Auto Nagar, Vijayawada"
              className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-workshop-border-soft">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-workshop-border rounded-lg text-xs font-semibold hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-brand text-white font-bold rounded-lg text-xs hover:bg-brand-deep cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

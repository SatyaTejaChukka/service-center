import React, { useState } from 'react';
import { Shield, Building2, Wrench, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export const SetupWizardPage: React.FC = () => {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    admin_username: '',
    admin_password: '',
    admin_confirm_password: '',
    admin_full_name: '',
    business_name: '',
    business_address: '',
    business_phone: '',
    business_email: '',
    business_gstin: '',
    business_upi_id: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.admin_password) {
      setError('Please provide a secure Admin password');
      return;
    }

    if (formData.admin_password !== formData.admin_confirm_password) {
      setError('Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      const res = await apiRequest<{ access_token: string; user: any }>('/auth/setup', {
        method: 'POST',
        body: JSON.stringify({
          admin_username: formData.admin_username,
          admin_password: formData.admin_password,
          admin_full_name: formData.admin_full_name,
          business_name: formData.business_name,
          business_address: formData.business_address,
          business_phone: formData.business_phone,
          business_email: formData.business_email,
          business_gstin: formData.business_gstin,
          business_upi_id: formData.business_upi_id,
        }),
      });

      login(res.access_token, res.user);
    } catch (err: any) {
      setError(err.message || 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto overscroll-contain bg-[#F5F6F8] flex flex-col items-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-workshop-border overflow-hidden my-auto shrink-0">
        
        {/* Header Banner */}
        <div className="bg-brand p-6 text-white text-center">
          <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Wrench className="w-6 h-6 text-white" />
          </div>
          <h2 className="font-display font-bold text-2xl md:text-3xl tracking-tight">
            PUSHPA RAJ AUTOMOTIVE SERVICES
          </h2>
          <p className="text-sm text-blue-100 mt-1">
            First-Run System Setup Wizard &bull; Offline Desktop Installation
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          {/* Section 1: Admin Account */}
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-brand-deep uppercase tracking-wider mb-3">
              <Shield className="w-4 h-4 text-brand" /> 1. Administrator Account Setup
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-workshop-text mb-1">
                  Admin Username *
                </label>
                <input
                  type="text"
                  name="admin_username"
                  required
                  value={formData.admin_username}
                  onChange={handleChange}
                  placeholder="e.g. admin or workshop_owner"
                  className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm focus:outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-workshop-text mb-1">
                  Full Name / Owner Name *
                </label>
                <input
                  type="text"
                  name="admin_full_name"
                  required
                  value={formData.admin_full_name}
                  onChange={handleChange}
                  placeholder="e.g. Pushpa Raj"
                  className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm focus:outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-workshop-text mb-1">
                  Admin Password *
                </label>
                <input
                  type="password"
                  name="admin_password"
                  required
                  value={formData.admin_password}
                  onChange={handleChange}
                  placeholder="Enter strong password"
                  className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm focus:outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-workshop-text mb-1">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  name="admin_confirm_password"
                  required
                  value={formData.admin_confirm_password}
                  onChange={handleChange}
                  placeholder="Re-enter password"
                  className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm focus:outline-none focus:border-brand"
                />
              </div>
            </div>
          </div>

          <hr className="border-workshop-border-soft" />

          {/* Section 2: Workshop Business Profile */}
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-brand-deep uppercase tracking-wider mb-3">
              <Building2 className="w-4 h-4 text-brand" /> 2. Workshop Profile (Printed on Invoices & Job Cards)
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-workshop-text mb-1">
                  Workshop Name *
                </label>
                <input
                  type="text"
                  name="business_name"
                  required
                  value={formData.business_name}
                  onChange={handleChange}
                  placeholder="e.g. Pushpa Raj Automotive Services"
                  className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm focus:outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-workshop-text mb-1">
                  Workshop Address *
                </label>
                <textarea
                  name="business_address"
                  rows={2}
                  required
                  value={formData.business_address}
                  onChange={handleChange}
                  placeholder="e.g. Main Road, Autonagar, Industrial Estate"
                  className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm focus:outline-none focus:border-brand"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-workshop-text mb-1">
                    Contact Phone *
                  </label>
                  <input
                    type="text"
                    name="business_phone"
                    required
                    value={formData.business_phone}
                    onChange={handleChange}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm focus:outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-workshop-text mb-1">
                    UPI ID for Customer Payments
                  </label>
                  <input
                    type="text"
                    name="business_upi_id"
                    value={formData.business_upi_id}
                    onChange={handleChange}
                    placeholder="e.g. pushparajauto@upi"
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm focus:outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-workshop-text mb-1">
                    GSTIN (Optional)
                  </label>
                  <input
                    type="text"
                    name="business_gstin"
                    value={formData.business_gstin}
                    onChange={handleChange}
                    placeholder="e.g. 37AAAAA0000A1Z5"
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm focus:outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-workshop-text mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    name="business_email"
                    value={formData.business_email}
                    onChange={handleChange}
                    placeholder="e.g. service@pushparajauto.com"
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm focus:outline-none focus:border-brand"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-brand hover:bg-brand-deep text-white font-semibold rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              'Initializing System...'
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" /> Initialize Workshop System &amp; Start
              </>
            )}
          </button>

        </form>

      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Users, Search, PlusCircle, Car, ArrowRight, X, AlertTriangle } from 'lucide-react';
import { apiRequest } from '../lib/api';

interface CustomerItem {
  id: number;
  name: string;
  phone: string;
  alt_phone?: string;
  address?: string;
  email?: string;
  notes?: string;
}

interface Props {
  onNavigate: (page: string, id?: number) => void;
  onOpenNewCustomerModal: () => void;
}

export const CustomersPage: React.FC<Props> = ({ onNavigate, onOpenNewCustomerModal }) => {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const url = search.trim() ? `/customers?search=${encodeURIComponent(search.trim())}` : '/customers';
      const res = await apiRequest<CustomerItem[]>(url);
      setCustomers(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [search]);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-2xl md:text-3xl text-workshop-text tracking-tight">
            Customer Directory
          </h2>
          <p className="text-sm text-workshop-muted">
            Manage customer accounts, contact details, and vehicle ownership.
          </p>
        </div>
        <button
          onClick={onOpenNewCustomerModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-deep text-white font-semibold text-sm rounded-lg shadow-sm transition cursor-pointer self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" /> + Add New Customer
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-workshop-border">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-workshop-muted absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by customer name or mobile number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-workshop-border rounded-lg bg-[#FAFAF8] focus:outline-none"
          />
        </div>
      </div>

      {/* Customers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-sm text-workshop-muted animate-pulse">
            Loading customer directory...
          </div>
        ) : customers.length === 0 ? (
          <div className="col-span-full py-12 text-center text-sm text-workshop-muted">
            No customers found. Click <span className="font-semibold text-brand">+ Add New Customer</span> to create one.
          </div>
        ) : (
          customers.map((c) => (
            <div
              key={c.id}
              onClick={() => onNavigate('customer_detail', c.id)}
              className="p-5 bg-white rounded-xl border border-workshop-border hover:border-brand/40 hover:shadow-md cursor-pointer transition flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-base text-workshop-text">{c.name}</h4>
                  <span className="font-mono text-xs bg-gray-100 text-workshop-muted px-2 py-0.5 rounded">
                    {c.phone}
                  </span>
                </div>
                {c.address && (
                  <p className="text-xs text-workshop-muted mt-2 line-clamp-2">
                    {c.address}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-workshop-border-soft flex items-center justify-between text-xs text-brand font-semibold">
                <span>View Full Profile &rarr;</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
};

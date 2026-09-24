import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Car, User, FileText, Receipt, ArrowRight } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { formatINR } from '../../lib/formatters';

interface SearchResult {
  vehicles: Array<{
    id: number;
    registration_number: string;
    make: string;
    model: string;
    customer_name: string;
    customer_phone: string;
    total_services: number;
    last_service_date: string | null;
  }>;
  customers: Array<{
    id: number;
    name: string;
    phone: string;
    address: string;
    vehicles_count: number;
  }>;
  job_cards: Array<{
    id: number;
    job_card_number: string;
    customer_name: string;
    vehicle_reg: string;
    vehicle_model: string;
    status: string;
    date: string;
  }>;
  invoices: Array<{
    id: number;
    invoice_number: string;
    job_card_number: string;
    grand_total: number;
    payment_status: string;
    status: string;
    customer_name: string;
  }>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: string, id?: number) => void;
}

export const GlobalSearchModal: React.FC<Props> = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input and add global ESC key listener
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults(null);
      return;
    }

    const timer = setTimeout(() => inputRef.current?.focus(), 50);

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isOpen, onClose]);

  // Debounced search query
  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await apiRequest<SearchResult>(`/search?q=${encodeURIComponent(query.trim())}`);
        setResults(res);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const totalResults = results
    ? (results.vehicles.length + results.customers.length + results.job_cards.length + results.invoices.length)
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain flex flex-col items-center justify-start pt-10 sm:pt-16 bg-black/60 backdrop-blur-sm p-3 sm:p-4 cursor-pointer"
      onClick={onClose}
    >
      {/* Inner modal dialog - stops click propagation so clicking inside does not close */}
      <div
        className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-workshop-border overflow-hidden animate-in fade-in zoom-in-95 duration-150 cursor-default shrink-0 mb-8"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-workshop-border bg-white gap-2">
          <Search className="w-5 h-5 text-workshop-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent text-base text-workshop-text placeholder-workshop-muted focus:outline-none"
            placeholder="Search vehicle reg (AP 31 XX 1234), phone, name, JC#, invoice..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 hover:bg-gray-100 rounded text-workshop-muted"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Close button in header */}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-workshop-muted hover:text-workshop-text hover:bg-gray-100 rounded-lg border border-workshop-border transition cursor-pointer shrink-0"
            title="Close search modal (Esc)"
          >
            <X className="w-3.5 h-3.5" />
            <span>Close</span>
          </button>
        </div>

        {/* Results Area */}
        <div className="max-h-[60vh] overflow-y-auto overscroll-contain p-4 space-y-5 bg-[#FAFAF8]">
          {loading && (
            <div className="py-8 text-center text-sm text-workshop-muted animate-pulse">
              Searching database...
            </div>
          )}

          {!loading && query && totalResults === 0 && (
            <div className="py-12 text-center text-sm text-workshop-muted">
              No matching vehicles, customers, job cards, or invoices found for "{query}".
            </div>
          )}

          {!loading && !query && (
            <div className="py-8 text-center text-xs text-workshop-muted">
              Tip: Type registration numbers with or without spaces (e.g. <span className="font-mono font-semibold">AP31</span> or <span className="font-mono font-semibold">1234</span>).
            </div>
          )}

          {/* 1. Vehicles */}
          {results && results.vehicles.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-workshop-muted uppercase tracking-wider mb-2">
                <Car className="w-3.5 h-3.5 text-brand" /> Vehicles ({results.vehicles.length})
              </div>
              <div className="space-y-1.5">
                {results.vehicles.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => {
                      onNavigate('vehicle_detail', v.id);
                      onClose();
                    }}
                    className="flex items-center justify-between p-2.5 bg-white hover:bg-brand-light/30 border border-workshop-border rounded-lg cursor-pointer transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm bg-gray-100 px-2 py-0.5 rounded border border-gray-300">
                          {v.registration_number}
                        </span>
                        <span className="font-semibold text-sm text-workshop-text">
                          {v.make} {v.model}
                        </span>
                      </div>
                      <div className="text-xs text-workshop-muted mt-0.5">
                        Customer: <span className="text-workshop-text font-medium">{v.customer_name}</span> ({v.customer_phone}) &bull; {v.total_services} past services
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-workshop-muted" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Customers */}
          {results && results.customers.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-workshop-muted uppercase tracking-wider mb-2">
                <User className="w-3.5 h-3.5 text-blue-600" /> Customers ({results.customers.length})
              </div>
              <div className="space-y-1.5">
                {results.customers.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      onNavigate('customer_detail', c.id);
                      onClose();
                    }}
                    className="flex items-center justify-between p-2.5 bg-white hover:bg-brand-light/30 border border-workshop-border rounded-lg cursor-pointer transition"
                  >
                    <div>
                      <span className="font-semibold text-sm text-workshop-text">{c.name}</span>
                      <span className="ml-2 font-mono text-xs text-workshop-muted">{c.phone}</span>
                      {c.address && <div className="text-xs text-workshop-muted">{c.address}</div>}
                    </div>
                    <div className="text-xs font-medium text-workshop-muted">
                      {c.vehicles_count} vehicles
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Job Cards */}
          {results && results.job_cards.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-workshop-muted uppercase tracking-wider mb-2">
                <FileText className="w-3.5 h-3.5 text-amber-600" /> Job Cards ({results.job_cards.length})
              </div>
              <div className="space-y-1.5">
                {results.job_cards.map((jc) => (
                  <div
                    key={jc.id}
                    onClick={() => {
                      onNavigate('jobcard_detail', jc.id);
                      onClose();
                    }}
                    className="flex items-center justify-between p-2.5 bg-white hover:bg-brand-light/30 border border-workshop-border rounded-lg cursor-pointer transition"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-brand-deep">{jc.job_card_number}</span>
                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">{jc.vehicle_reg}</span>
                        <span className="text-xs text-workshop-muted">{jc.vehicle_model}</span>
                      </div>
                      <div className="text-xs text-workshop-muted mt-0.5">
                        {jc.customer_name} &bull; {jc.date}
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-50 text-brand">
                      {jc.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Invoices */}
          {results && results.invoices.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-workshop-muted uppercase tracking-wider mb-2">
                <Receipt className="w-3.5 h-3.5 text-green-600" /> Invoices ({results.invoices.length})
              </div>
              <div className="space-y-1.5">
                {results.invoices.map((inv) => (
                  <div
                    key={inv.id}
                    onClick={() => {
                      onNavigate('invoices', inv.id);
                      onClose();
                    }}
                    className="flex items-center justify-between p-2.5 bg-white hover:bg-brand-light/30 border border-workshop-border rounded-lg cursor-pointer transition"
                  >
                    <div>
                      <span className="font-mono font-bold text-sm text-workshop-text">{inv.invoice_number || 'DRAFT'}</span>
                      <div className="text-xs text-workshop-muted">
                        Job Card: {inv.job_card_number} &bull; {inv.customer_name}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-sm text-workshop-text">{formatINR(inv.grand_total)}</div>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        inv.payment_status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {inv.payment_status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2.5 bg-gray-50 border-t border-workshop-border flex items-center justify-between text-xs text-workshop-muted">
          <span>Fast Global Omnibox Search</span>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline">Press <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded font-mono">ESC</kbd> or click outside to close</span>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded-md text-xs font-semibold text-workshop-text cursor-pointer transition shadow-2xs"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

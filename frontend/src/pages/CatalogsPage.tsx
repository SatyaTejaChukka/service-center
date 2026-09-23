import React, { useState, useEffect } from 'react';
import { Package, Wrench, Plus, Trash2 } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { formatINR } from '../lib/formatters';
import { useAuth } from '../context/AuthContext';

export const CatalogsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'LABOUR' | 'PARTS'>('LABOUR');
  const [labour, setLabour] = useState<any[]>([]);
  const [parts, setParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New labour form
  const [newLabourName, setNewLabourName] = useState('');
  const [newLabourRate, setNewLabourRate] = useState<number>(500);

  // New part form
  const [newPartName, setNewPartName] = useState('');
  const [newPartNumber, setNewPartNumber] = useState('');
  const [newPartUnit, setNewPartUnit] = useState('pcs');
  const [newPartPrice, setNewPartPrice] = useState<number>(500);

  const fetchCatalogs = async () => {
    try {
      setLoading(true);
      const [lRes, pRes] = await Promise.all([
        apiRequest<any[]>('/catalogs/labour'),
        apiRequest<any[]>('/catalogs/parts'),
      ]);
      setLabour(lRes);
      setParts(pRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalogs();
  }, []);

  const handleAddLabour = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabourName.trim()) return;
    try {
      await apiRequest('/catalogs/labour', {
        method: 'POST',
        body: JSON.stringify({
          name: newLabourName.trim(),
          default_rate: Math.round(newLabourRate * 100),
        }),
      });
      setNewLabourName('');
      fetchCatalogs();
    } catch (err: any) {
      alert(err.message || 'Failed to add labour item');
    }
  };

  const handleAddPart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartName.trim()) return;
    try {
      await apiRequest('/catalogs/parts', {
        method: 'POST',
        body: JSON.stringify({
          name: newPartName.trim(),
          part_number: newPartNumber.trim() || undefined,
          unit: newPartUnit,
          default_price: Math.round(newPartPrice * 100),
        }),
      });
      setNewPartName('');
      setNewPartNumber('');
      fetchCatalogs();
    } catch (err: any) {
      alert(err.message || 'Failed to add part item');
    }
  };

  const handleDeleteLabour = async (id: number) => {
    if (!window.confirm('Deactivate this labour item?')) return;
    try {
      await apiRequest(`/catalogs/labour/${id}`, { method: 'DELETE' });
      fetchCatalogs();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeletePart = async (id: number) => {
    if (!window.confirm('Deactivate this part item?')) return;
    try {
      await apiRequest(`/catalogs/parts/${id}`, { method: 'DELETE' });
      fetchCatalogs();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      
      <div>
        <h2 className="font-display font-bold text-2xl md:text-3xl text-workshop-text tracking-tight">
          Parts &amp; Labour Catalogs
        </h2>
        <p className="text-sm text-workshop-muted">
          Pre-defined rates and part descriptions. Catalog changes never affect past job cards or invoices.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-workshop-border pb-3">
        <button
          onClick={() => setActiveTab('LABOUR')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
            activeTab === 'LABOUR' ? 'bg-brand text-white shadow-xs' : 'bg-white text-workshop-muted hover:bg-gray-100'
          }`}
        >
          <Wrench className="w-4 h-4" /> Labour &amp; Service Rates ({labour.length})
        </button>
        <button
          onClick={() => setActiveTab('PARTS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
            activeTab === 'PARTS' ? 'bg-brand text-white shadow-xs' : 'bg-white text-workshop-muted hover:bg-gray-100'
          }`}
        >
          <Package className="w-4 h-4" /> Spare Parts &amp; Consumables ({parts.length})
        </button>
      </div>

      {/* Content */}
      {activeTab === 'LABOUR' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Table */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-workshop-border overflow-hidden shadow-2xs">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F8FAFC] border-b border-workshop-border text-xs uppercase text-workshop-muted">
                <tr>
                  <th className="px-4 py-3">Service Name</th>
                  <th className="px-4 py-3 text-right">Standard Rate</th>
                  <th className="px-4 py-3 text-center w-16">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-workshop-border-soft">
                {labour.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-workshop-text">{l.name}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">{formatINR(l.default_rate)}</td>
                    <td className="px-4 py-3 text-center">
                      {user?.role === 'ADMIN' && (
                        <button onClick={() => handleDeleteLabour(l.id)} className="text-workshop-muted hover:text-workshop-red p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Form */}
          {user?.role === 'ADMIN' && (
            <div className="bg-white p-5 rounded-xl border border-workshop-border shadow-2xs space-y-4 h-fit">
              <h4 className="font-bold text-sm text-workshop-text">+ Add New Labour Item</h4>
              <form onSubmit={handleAddLabour} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-workshop-text mb-1">Service Description *</label>
                  <input
                    type="text"
                    required
                    value={newLabourName}
                    onChange={(e) => setNewLabourName(e.target.value)}
                    placeholder="e.g. Throttle Body Cleaning"
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-workshop-text mb-1">Default Rate (₹) *</label>
                  <input
                    type="number"
                    required
                    value={newLabourRate}
                    onChange={(e) => setNewLabourRate(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm font-mono"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-brand text-white font-semibold text-xs rounded-lg hover:bg-brand-deep cursor-pointer"
                >
                  Save to Labour Catalog
                </button>
              </form>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Table */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-workshop-border overflow-hidden shadow-2xs">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F8FAFC] border-b border-workshop-border text-xs uppercase text-workshop-muted">
                <tr>
                  <th className="px-4 py-3">Part Name</th>
                  <th className="px-4 py-3">Part #</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3 text-right">Default Price</th>
                  <th className="px-4 py-3 text-center w-16">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-workshop-border-soft">
                {parts.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-workshop-text">{p.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-workshop-muted">{p.part_number || '-'}</td>
                    <td className="px-4 py-3 text-xs">{p.unit}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold">{formatINR(p.default_price)}</td>
                    <td className="px-4 py-3 text-center">
                      {user?.role === 'ADMIN' && (
                        <button onClick={() => handleDeletePart(p.id)} className="text-workshop-muted hover:text-workshop-red p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Form */}
          {user?.role === 'ADMIN' && (
            <div className="bg-white p-5 rounded-xl border border-workshop-border shadow-2xs space-y-4 h-fit">
              <h4 className="font-bold text-sm text-workshop-text">+ Add New Part Item</h4>
              <form onSubmit={handleAddPart} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-workshop-text mb-1">Part Name *</label>
                  <input
                    type="text"
                    required
                    value={newPartName}
                    onChange={(e) => setNewPartName(e.target.value)}
                    placeholder="e.g. Brake Disc"
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-workshop-text mb-1">Part Number (Optional)</label>
                  <input
                    type="text"
                    value={newPartNumber}
                    onChange={(e) => setNewPartNumber(e.target.value)}
                    placeholder="e.g. BD-FRONT-12"
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-workshop-text mb-1">Unit</label>
                    <select
                      value={newPartUnit}
                      onChange={(e) => setNewPartUnit(e.target.value)}
                      className="w-full px-2 py-2 border border-workshop-border rounded-lg text-xs bg-white"
                    >
                      <option value="pcs">pcs</option>
                      <option value="litre">litre</option>
                      <option value="set">set</option>
                      <option value="can">can</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-workshop-text mb-1">Price (₹) *</label>
                    <input
                      type="number"
                      required
                      value={newPartPrice}
                      onChange={(e) => setNewPartPrice(Number(e.target.value))}
                      className="w-full px-2 py-2 border border-workshop-border rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-brand text-white font-semibold text-xs rounded-lg hover:bg-brand-deep cursor-pointer"
                >
                  Save to Parts Catalog
                </button>
              </form>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

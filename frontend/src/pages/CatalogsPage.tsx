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
  const [newLabourCost, setNewLabourCost] = useState<number>(150);
  const [newLabourSac, setNewLabourSac] = useState('998729');
  const [newLabourGst, setNewLabourGst] = useState<number>(18);

  // New part form
  const [newPartName, setNewPartName] = useState('');
  const [newPartNumber, setNewPartNumber] = useState('');
  const [newPartUnit, setNewPartUnit] = useState('pcs');
  const [newPartPrice, setNewPartPrice] = useState<number>(500);
  const [newPartCost, setNewPartCost] = useState<number>(300);
  const [newPartHsn, setNewPartHsn] = useState('8708');
  const [newPartGst, setNewPartGst] = useState<number>(18);

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
          cost_price: Math.round(newLabourCost * 100),
          sac_code: newLabourSac.trim() || '998729',
          gst_rate: Number(newLabourGst) || 18,
        }),
      });
      setNewLabourName('');
      setNewLabourRate(500);
      setNewLabourCost(150);
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
          purchase_cost: Math.round(newPartCost * 100),
          cost_price: Math.round(newPartCost * 100),
          hsn_code: newPartHsn.trim() || '8708',
          gst_rate: Number(newPartGst) || 18,
        }),
      });
      setNewPartName('');
      setNewPartNumber('');
      setNewPartPrice(500);
      setNewPartCost(300);
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
          Pre-defined rates, purchase costs, HSN/SAC codes, and GST rates for CA-compliant billing &amp; margin tracking.
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
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F8FAFC] border-b border-workshop-border text-xs uppercase text-workshop-muted">
                  <tr>
                    <th className="px-4 py-3">Service Name</th>
                    <th className="px-3 py-3">SAC</th>
                    <th className="px-3 py-3 text-center">GST %</th>
                    <th className="px-3 py-3 text-right">Cost Price</th>
                    <th className="px-4 py-3 text-right">Selling Rate</th>
                    <th className="px-3 py-3 text-right">Margin %</th>
                    <th className="px-3 py-3 text-center w-12">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-workshop-border-soft">
                  {labour.map((l) => {
                    const rate = l.default_rate || 0;
                    const cost = l.cost_price || 0;
                    const profit = rate - cost;
                    const margin = rate > 0 ? Math.round((profit / rate) * 100) : 0;
                    return (
                      <tr key={l.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-medium text-workshop-text">{l.name}</td>
                        <td className="px-3 py-3 font-mono text-xs text-workshop-muted">{l.sac_code || '998729'}</td>
                        <td className="px-3 py-3 text-center font-mono text-xs">{l.gst_rate ?? 18}%</td>
                        <td className="px-3 py-3 text-right font-mono text-workshop-muted">{formatINR(cost)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-workshop-text">{formatINR(rate)}</td>
                        <td className="px-3 py-3 text-right font-mono text-xs">
                          <span className={`px-1.5 py-0.5 rounded font-bold ${margin >= 50 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                            {margin}%
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {user?.role === 'ADMIN' && (
                            <button onClick={() => handleDeleteLabour(l.id)} className="text-workshop-muted hover:text-workshop-red p-1 cursor-pointer">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Form */}
          {user?.role === 'ADMIN' && (
            <div className="bg-white p-5 rounded-xl border border-workshop-border shadow-2xs space-y-4 h-fit">
              <h4 className="font-bold text-sm text-workshop-text flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-brand" /> Add Labour Service
              </h4>
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
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-workshop-text mb-1">Selling Rate (₹) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={newLabourRate}
                      onChange={(e) => setNewLabourRate(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-workshop-text mb-1">Cost / Payout (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={newLabourCost}
                      onChange={(e) => setNewLabourCost(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm font-mono"
                      title="Estimated mechanic cost or contractor payout"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-workshop-text mb-1">SAC Code</label>
                    <input
                      type="text"
                      value={newLabourSac}
                      onChange={(e) => setNewLabourSac(e.target.value)}
                      placeholder="998729"
                      className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-workshop-text mb-1">GST Rate %</label>
                    <select
                      value={newLabourGst}
                      onChange={(e) => setNewLabourGst(Number(e.target.value))}
                      className="w-full px-2 py-2 border border-workshop-border rounded-lg text-xs bg-white"
                    >
                      <option value={18}>18% (Standard Labour)</option>
                      <option value={28}>28%</option>
                      <option value={12}>12%</option>
                      <option value={5}>5%</option>
                      <option value={0}>0% (Exempt)</option>
                    </select>
                  </div>
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
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F8FAFC] border-b border-workshop-border text-xs uppercase text-workshop-muted">
                  <tr>
                    <th className="px-4 py-3">Part Name</th>
                    <th className="px-3 py-3">Part #</th>
                    <th className="px-3 py-3">HSN</th>
                    <th className="px-2 py-3 text-center">GST %</th>
                    <th className="px-3 py-3 text-right">Purchase (₹)</th>
                    <th className="px-4 py-3 text-right">Selling Price</th>
                    <th className="px-3 py-3 text-right">Margin %</th>
                    <th className="px-3 py-3 text-center w-12">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-workshop-border-soft">
                  {parts.map((p) => {
                    const price = p.default_price || 0;
                    const cost = p.purchase_cost || p.cost_price || 0;
                    const profit = price - cost;
                    const margin = price > 0 ? Math.round((profit / price) * 100) : 0;
                    return (
                      <tr key={p.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-medium text-workshop-text">
                          {p.name}
                          <span className="text-[11px] text-workshop-muted ml-1.5">({p.unit})</span>
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-workshop-muted">{p.part_number || '-'}</td>
                        <td className="px-3 py-3 font-mono text-xs text-workshop-muted">{p.hsn_code || '8708'}</td>
                        <td className="px-2 py-3 text-center font-mono text-xs">{p.gst_rate ?? 18}%</td>
                        <td className="px-3 py-3 text-right font-mono text-workshop-muted">{formatINR(cost)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-workshop-text">{formatINR(price)}</td>
                        <td className="px-3 py-3 text-right font-mono text-xs">
                          <span className={`px-1.5 py-0.5 rounded font-bold ${margin >= 30 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                            {margin}%
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {user?.role === 'ADMIN' && (
                            <button onClick={() => handleDeletePart(p.id)} className="text-workshop-muted hover:text-workshop-red p-1 cursor-pointer">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Form */}
          {user?.role === 'ADMIN' && (
            <div className="bg-white p-5 rounded-xl border border-workshop-border shadow-2xs space-y-4 h-fit">
              <h4 className="font-bold text-sm text-workshop-text flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-brand" /> Add Spare Part
              </h4>
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
                      <option value="kg">kg</option>
                      <option value="metre">metre</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-workshop-text mb-1">HSN Code</label>
                    <input
                      type="text"
                      value={newPartHsn}
                      onChange={(e) => setNewPartHsn(e.target.value)}
                      placeholder="8708"
                      className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-workshop-text mb-1">Purchase Cost (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={newPartCost}
                      onChange={(e) => setNewPartCost(Number(e.target.value))}
                      className="w-full px-2 py-2 border border-workshop-border rounded-lg text-xs font-mono"
                      title="Workshop wholesale / purchase cost"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-workshop-text mb-1">Selling Price (₹) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={newPartPrice}
                      onChange={(e) => setNewPartPrice(Number(e.target.value))}
                      className="w-full px-2 py-2 border border-workshop-border rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-workshop-text mb-1">GST Rate %</label>
                  <select
                    value={newPartGst}
                    onChange={(e) => setNewPartGst(Number(e.target.value))}
                    className="w-full px-2 py-2 border border-workshop-border rounded-lg text-xs bg-white"
                  >
                    <option value={18}>18% (Standard Auto Parts)</option>
                    <option value={28}>28% (Batteries, Tyres, Luxury)</option>
                    <option value={12}>12%</option>
                    <option value={5}>5%</option>
                    <option value={0}>0%</option>
                  </select>
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

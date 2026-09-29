import React, { useState, useEffect } from 'react';
import { Package, Wrench, Plus, Trash2, Pencil, X, Sparkles, Percent } from 'lucide-react';
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
  const [newLabourRate, setNewLabourRate] = useState<number | string>('');
  const [newLabourCost, setNewLabourCost] = useState<number | string>('');
  const [newLabourSac, setNewLabourSac] = useState('998729');
  const [newLabourGst, setNewLabourGst] = useState<number>(18);

  // Edit labour modal state
  const [editingLabour, setEditingLabour] = useState<any | null>(null);
  const [editLabourName, setEditLabourName] = useState('');
  const [editLabourRate, setEditLabourRate] = useState<number | string>('');
  const [editLabourCost, setEditLabourCost] = useState<number | string>('');
  const [editLabourSac, setEditLabourSac] = useState('');
  const [editLabourGst, setEditLabourGst] = useState<number>(18);
  const [editLabourSaving, setEditLabourSaving] = useState(false);

  // New part form
  const [newPartName, setNewPartName] = useState('');
  const [newPartNumber, setNewPartNumber] = useState('');
  const [newPartUnit, setNewPartUnit] = useState('pcs');
  const [newPartPrice, setNewPartPrice] = useState<number | string>('');
  const [newPartCost, setNewPartCost] = useState<number | string>('');
  const [newPartHsn, setNewPartHsn] = useState('8708');
  const [newPartGst, setNewPartGst] = useState<number>(18);

  // Edit part modal state
  const [editingPart, setEditingPart] = useState<any | null>(null);
  const [editPartName, setEditPartName] = useState('');
  const [editPartNumber, setEditPartNumber] = useState('');
  const [editPartUnit, setEditPartUnit] = useState('pcs');
  const [editPartPrice, setEditPartPrice] = useState<number | string>('');
  const [editPartCost, setEditPartCost] = useState<number | string>('');
  const [editPartHsn, setEditPartHsn] = useState('');
  const [editPartGst, setEditPartGst] = useState<number>(18);
  const [editPartSaving, setEditPartSaving] = useState(false);

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

  const handleOpenEditLabour = (item: any) => {
    setEditingLabour(item);
    setEditLabourName(item.name);
    setEditLabourRate(item.default_rate ? Math.round(item.default_rate / 100) : '');
    setEditLabourCost(item.cost_price ? Math.round(item.cost_price / 100) : '');
    setEditLabourSac(item.sac_code || '998729');
    setEditLabourGst(item.gst_rate ?? 18);
  };

  const handleSaveEditLabour = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLabour || !editLabourName.trim()) return;
    try {
      setEditLabourSaving(true);
      await apiRequest(`/catalogs/labour/${editingLabour.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editLabourName.trim(),
          default_rate: Math.round(Number(editLabourRate || 0) * 100),
          cost_price: Math.round(Number(editLabourCost || 0) * 100),
          sac_code: editLabourSac.trim() || '998729',
          gst_rate: Number(editLabourGst) || 18,
        }),
      });
      setEditingLabour(null);
      fetchCatalogs();
    } catch (err: any) {
      alert(err.message || 'Failed to update labour item');
    } finally {
      setEditLabourSaving(false);
    }
  };

  const handleOpenEditPart = (item: any) => {
    setEditingPart(item);
    setEditPartName(item.name);
    setEditPartNumber(item.part_number || '');
    setEditPartUnit(item.unit || 'pcs');
    setEditPartPrice(item.default_price ? Math.round(item.default_price / 100) : '');
    setEditPartCost((item.purchase_cost || item.cost_price) ? Math.round((item.purchase_cost || item.cost_price) / 100) : '');
    setEditPartHsn(item.hsn_code || '8708');
    setEditPartGst(item.gst_rate ?? 18);
  };

  const handleSaveEditPart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPart || !editPartName.trim()) return;
    try {
      setEditPartSaving(true);
      await apiRequest(`/catalogs/parts/${editingPart.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editPartName.trim(),
          part_number: editPartNumber.trim() || undefined,
          unit: editPartUnit,
          default_price: Math.round(Number(editPartPrice || 0) * 100),
          purchase_cost: Math.round(Number(editPartCost || 0) * 100),
          cost_price: Math.round(Number(editPartCost || 0) * 100),
          hsn_code: editPartHsn.trim() || '8708',
          gst_rate: Number(editPartGst) || 18,
        }),
      });
      setEditingPart(null);
      fetchCatalogs();
    } catch (err: any) {
      alert(err.message || 'Failed to update part item');
    } finally {
      setEditPartSaving(false);
    }
  };

  const handleAddLabour = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabourName.trim()) return;
    try {
      await apiRequest('/catalogs/labour', {
        method: 'POST',
        body: JSON.stringify({
          name: newLabourName.trim(),
          default_rate: Math.round(Number(newLabourRate || 0) * 100),
          cost_price: Math.round(Number(newLabourCost || 0) * 100),
          sac_code: newLabourSac.trim() || '998729',
          gst_rate: Number(newLabourGst) || 18,
        }),
      });
      setNewLabourName('');
      setNewLabourRate('');
      setNewLabourCost('');
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
          default_price: Math.round(Number(newPartPrice || 0) * 100),
          purchase_cost: Math.round(Number(newPartCost || 0) * 100),
          cost_price: Math.round(Number(newPartCost || 0) * 100),
          hsn_code: newPartHsn.trim() || '8708',
          gst_rate: Number(newPartGst) || 18,
        }),
      });
      setNewPartName('');
      setNewPartNumber('');
      setNewPartPrice('');
      setNewPartCost('');
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
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleOpenEditLabour(l)}
                                className="text-workshop-muted hover:text-brand p-1.5 hover:bg-blue-50 rounded transition cursor-pointer"
                                title="Edit rate, cost & margin"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteLabour(l.id)}
                                className="text-workshop-muted hover:text-workshop-red p-1.5 hover:bg-red-50 rounded transition cursor-pointer"
                                title="Deactivate item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
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
                      placeholder="0"
                      value={newLabourRate === 0 || newLabourRate === '0' || newLabourRate === '' ? '' : newLabourRate}
                      onChange={(e) => setNewLabourRate(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-workshop-text mb-1">Cost / Payout (₹)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={newLabourCost === 0 || newLabourCost === '0' || newLabourCost === '' ? '' : newLabourCost}
                      onChange={(e) => setNewLabourCost(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm font-mono"
                      title="Estimated mechanic cost or contractor payout"
                    />
                  </div>
                </div>

                {/* Dynamic Margin Indicator for Add Form */}
                {Number(newLabourRate) > 0 && (
                  <div className="p-2 bg-blue-50/60 rounded-lg border border-blue-100 flex items-center justify-between text-xs">
                    <span className="text-workshop-muted font-medium">Estimated Margin:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-workshop-text font-semibold">
                        Profit: ₹{Math.max(0, (Number(newLabourRate) || 0) - (Number(newLabourCost) || 0))}
                      </span>
                      <span className={`px-2 py-0.5 rounded font-bold font-mono text-[11px] ${
                        Math.round((((Number(newLabourRate) || 0) - (Number(newLabourCost) || 0)) / (Number(newLabourRate) || 1)) * 100) >= 40
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {Math.round((((Number(newLabourRate) || 0) - (Number(newLabourCost) || 0)) / (Number(newLabourRate) || 1)) * 100)}%
                      </span>
                    </div>
                  </div>
                )}

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
                    <th className="px-3 py-3 text-center w-16">Action</th>
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
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleOpenEditPart(p)}
                                className="text-workshop-muted hover:text-brand p-1.5 hover:bg-blue-50 rounded transition cursor-pointer"
                                title="Edit price, cost & margin"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeletePart(p.id)}
                                className="text-workshop-muted hover:text-workshop-red p-1.5 hover:bg-red-50 rounded transition cursor-pointer"
                                title="Deactivate item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
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
                      placeholder="0"
                      value={newPartCost === 0 || newPartCost === '0' || newPartCost === '' ? '' : newPartCost}
                      onChange={(e) => setNewPartCost(e.target.value === '' ? '' : Number(e.target.value))}
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
                      placeholder="0"
                      value={newPartPrice === 0 || newPartPrice === '0' || newPartPrice === '' ? '' : newPartPrice}
                      onChange={(e) => setNewPartPrice(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-2 py-2 border border-workshop-border rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Dynamic Margin Indicator for Add Form */}
                {Number(newPartPrice) > 0 && (
                  <div className="p-2 bg-blue-50/60 rounded-lg border border-blue-100 flex items-center justify-between text-xs">
                    <span className="text-workshop-muted font-medium">Estimated Margin:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-workshop-text font-semibold">
                        Profit: ₹{Math.max(0, (Number(newPartPrice) || 0) - (Number(newPartCost) || 0))}
                      </span>
                      <span className={`px-2 py-0.5 rounded font-bold font-mono text-[11px] ${
                        Math.round((((Number(newPartPrice) || 0) - (Number(newPartCost) || 0)) / (Number(newPartPrice) || 1)) * 100) >= 30
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {Math.round((((Number(newPartPrice) || 0) - (Number(newPartCost) || 0)) / (Number(newPartPrice) || 1)) * 100)}%
                      </span>
                    </div>
                  </div>
                )}

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

      {/* Edit Labour Modal */}
      {editingLabour && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-workshop-border shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-workshop-border bg-gradient-to-r from-blue-50 to-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-blue-100 text-brand rounded-lg">
                  <Wrench className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-display font-bold text-base text-workshop-text">
                    Edit Labour Service
                  </h3>
                  <p className="text-[11px] text-workshop-muted">
                    Update rate, payout cost, SAC code, or target margin
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingLabour(null)}
                className="p-1.5 text-workshop-muted hover:text-workshop-text rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditLabour} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-workshop-text mb-1">Service Description *</label>
                <input
                  type="text"
                  required
                  value={editLabourName}
                  onChange={(e) => setEditLabourName(e.target.value)}
                  className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-workshop-text mb-1">
                    Mechanic Payout / Cost (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={editLabourCost === 0 || editLabourCost === '0' || editLabourCost === '' ? '' : editLabourCost}
                    onChange={(e) => setEditLabourCost(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm font-mono"
                    title="Estimated mechanic cost or contractor payout"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-workshop-text mb-1">
                    Selling Rate (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="0"
                    value={editLabourRate === 0 || editLabourRate === '0' || editLabourRate === '' ? '' : editLabourRate}
                    onChange={(e) => setEditLabourRate(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm font-mono font-bold text-brand-deep"
                  />
                </div>
              </div>

              {/* Real-time Profit & Margin Calculator */}
              <div className="p-3 bg-gradient-to-r from-emerald-50/60 to-blue-50/60 rounded-xl border border-emerald-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] text-workshop-text uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    Live Profitability &amp; Margin
                  </span>
                  <span className={`px-2 py-0.5 rounded-full font-bold font-mono text-[11px] ${
                    Number(editLabourRate) > 0 && Math.round((((Number(editLabourRate) || 0) - (Number(editLabourCost) || 0)) / (Number(editLabourRate) || 1)) * 100) >= 40
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {Number(editLabourRate) > 0 ? Math.round((((Number(editLabourRate) || 0) - (Number(editLabourCost) || 0)) / (Number(editLabourRate) || 1)) * 100) : 0}% Gross Margin
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-workshop-muted">Gross Profit per job:</span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">
                    ₹{((Number(editLabourRate) || 0) - (Number(editLabourCost) || 0)).toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Quick Target Margin Buttons */}
                <div className="pt-2 border-t border-emerald-100/70 flex items-center justify-between">
                  <span className="text-[10px] text-workshop-muted font-medium">Quick target margin:</span>
                  <div className="flex items-center gap-1">
                    {[25, 35, 50, 60].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          const cost = Number(editLabourCost) || 0;
                          if (cost > 0) {
                            setEditLabourRate(Math.round(cost / (1 - pct / 100)));
                          }
                        }}
                        className="px-2 py-0.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-[10px] font-mono font-semibold transition cursor-pointer"
                        title={`Auto-calculate selling rate for ${pct}% margin`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
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

              <div className="pt-3 border-t border-workshop-border-soft flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingLabour(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-workshop-text rounded-lg font-semibold cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLabourSaving}
                  className="px-4 py-2 bg-brand hover:bg-brand-deep text-white rounded-lg font-semibold shadow-xs cursor-pointer transition"
                >
                  {editLabourSaving ? 'Saving...' : 'Update Labour Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Part Modal */}
      {editingPart && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-workshop-border shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-workshop-border bg-gradient-to-r from-blue-50 to-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-blue-100 text-brand rounded-lg">
                  <Package className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-display font-bold text-base text-workshop-text">
                    Edit Spare Part Price &amp; Margin
                  </h3>
                  <p className="text-[11px] text-workshop-muted">
                    Update wholesale cost, customer selling price, or target margin
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingPart(null)}
                className="p-1.5 text-workshop-muted hover:text-workshop-text rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditPart} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-workshop-text mb-1">Part Name *</label>
                <input
                  type="text"
                  required
                  value={editPartName}
                  onChange={(e) => setEditPartName(e.target.value)}
                  className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-workshop-text mb-1">Part Number</label>
                  <input
                    type="text"
                    value={editPartNumber}
                    onChange={(e) => setEditPartNumber(e.target.value)}
                    placeholder="e.g. BP-FRONT-12"
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-workshop-text mb-1">Unit</label>
                  <select
                    value={editPartUnit}
                    onChange={(e) => setEditPartUnit(e.target.value)}
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-workshop-text mb-1">
                    Purchase Cost (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={editPartCost === 0 || editPartCost === '0' || editPartCost === '' ? '' : editPartCost}
                    onChange={(e) => setEditPartCost(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm font-mono"
                    title="Wholesale purchase cost from supplier"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-workshop-text mb-1">
                    Selling Price (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="0"
                    value={editPartPrice === 0 || editPartPrice === '0' || editPartPrice === '' ? '' : editPartPrice}
                    onChange={(e) => setEditPartPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm font-mono font-bold text-brand-deep"
                  />
                </div>
              </div>

              {/* Real-time Profit & Margin Calculator */}
              <div className="p-3 bg-gradient-to-r from-emerald-50/60 to-blue-50/60 rounded-xl border border-emerald-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] text-workshop-text uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    Live Profitability &amp; Margin
                  </span>
                  <span className={`px-2 py-0.5 rounded-full font-bold font-mono text-[11px] ${
                    Number(editPartPrice) > 0 && Math.round((((Number(editPartPrice) || 0) - (Number(editPartCost) || 0)) / (Number(editPartPrice) || 1)) * 100) >= 25
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {Number(editPartPrice) > 0 ? Math.round((((Number(editPartPrice) || 0) - (Number(editPartCost) || 0)) / (Number(editPartPrice) || 1)) * 100) : 0}% Gross Margin
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-workshop-muted">Gross Profit per unit:</span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">
                    ₹{((Number(editPartPrice) || 0) - (Number(editPartCost) || 0)).toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Quick Target Margin Buttons */}
                <div className="pt-2 border-t border-emerald-100/70 flex items-center justify-between">
                  <span className="text-[10px] text-workshop-muted font-medium">Quick target margin:</span>
                  <div className="flex items-center gap-1">
                    {[15, 20, 30, 40, 50].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          const cost = Number(editPartCost) || 0;
                          if (cost > 0) {
                            setEditPartPrice(Math.round(cost / (1 - pct / 100)));
                          }
                        }}
                        className="px-2 py-0.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-[10px] font-mono font-semibold transition cursor-pointer"
                        title={`Auto-calculate selling price for ${pct}% margin`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
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
                    className="w-full px-2 py-2 border border-workshop-border rounded-lg text-xs bg-white"
                  >
                    <option value={18}>18% (Standard Auto Parts)</option>
                    <option value={28}>28% (Batteries, Tyres, Luxury)</option>
                    <option value={12}>12%</option>
                    <option value={5}>5%</option>
                    <option value={0}>0%</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-workshop-border-soft flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPart(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-workshop-text rounded-lg font-semibold cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editPartSaving}
                  className="px-4 py-2 bg-brand hover:bg-brand-deep text-white rounded-lg font-semibold shadow-xs cursor-pointer transition"
                >
                  {editPartSaving ? 'Saving...' : 'Update Spare Part'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

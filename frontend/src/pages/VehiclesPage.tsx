import React, { useState, useEffect } from 'react';
import { Car, Search, ArrowRight } from 'lucide-react';
import { apiRequest } from '../lib/api';

interface VehicleItem {
  id: number;
  registration_number: string;
  registration_normalized: string;
  make: string;
  model: string;
  variant?: string;
  fuel_type: string;
  current_odometer: number;
  customer_id: number;
}

interface Props {
  onNavigate: (page: string, id?: number) => void;
}

export const VehiclesPage: React.FC<Props> = ({ onNavigate }) => {
  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const url = search.trim() ? `/vehicles?search=${encodeURIComponent(search.trim())}` : '/vehicles';
      const res = await apiRequest<VehicleItem[]>(url);
      setVehicles(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, [search]);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Header */}
      <div>
        <h2 className="font-display font-bold text-2xl md:text-3xl text-workshop-text tracking-tight">
          Vehicle Registry
        </h2>
        <p className="text-sm text-workshop-muted">
          All customer vehicles, service logs, and registration details.
        </p>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-xl border border-workshop-border">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-workshop-muted absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by registration (with or without spaces)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-workshop-border rounded-lg bg-[#FAFAF8] focus:outline-none"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-sm text-workshop-muted animate-pulse">
            Loading vehicle registry...
          </div>
        ) : vehicles.length === 0 ? (
          <div className="col-span-full py-12 text-center text-sm text-workshop-muted">
            No vehicles registered yet. Create a Job Card to register a vehicle.
          </div>
        ) : (
          vehicles.map((v) => (
            <div
              key={v.id}
              onClick={() => onNavigate('vehicle_detail', v.id)}
              className="p-5 bg-white rounded-xl border border-workshop-border hover:border-brand/40 hover:shadow-md cursor-pointer transition flex flex-col justify-between space-y-3"
            >
              <div>
                <span className="font-mono font-bold text-sm bg-gray-100 px-2.5 py-1 rounded border border-gray-300 inline-block mb-2">
                  {v.registration_number}
                </span>
                <h4 className="font-bold text-base text-workshop-text">{v.make} {v.model}</h4>
                <div className="text-xs text-workshop-muted mt-1 space-y-0.5">
                  <div>Fuel: <span className="font-semibold">{v.fuel_type}</span></div>
                  <div>Odometer: <span className="font-mono font-semibold">{v.current_odometer.toLocaleString('en-IN')} km</span></div>
                </div>
              </div>

              <div className="pt-3 border-t border-workshop-border-soft flex items-center justify-between text-xs text-brand font-semibold">
                <span>View Service History &rarr;</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
};

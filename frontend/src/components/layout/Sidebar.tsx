import React from 'react';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Users,
  Car,
  Package,
  Receipt,
  BarChart3,
  Settings,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface Props {
  activePage: string;
  onNavigate: (page: string) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<Props> = ({
  activePage,
  onNavigate,
  mobileOpen,
  onCloseMobile,
}) => {
  const { user } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'job_cards', label: 'Job Cards', icon: FileSpreadsheet },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'vehicles', label: 'Vehicles', icon: Car },
    { id: 'catalogs', label: 'Parts & Labour', icon: Package },
    { id: 'invoices', label: 'Invoices', icon: Receipt },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed md:static top-16 bottom-0 z-40 md:z-auto h-[calc(100vh-4rem)] md:h-full bg-white border-r border-workshop-border transition-all duration-200 shrink-0 flex flex-col ${
          mobileOpen ? 'left-0 w-64 md:w-16 lg:w-56' : '-left-64 w-64 md:w-16 lg:w-56 md:left-auto'
        }`}
      >
        {/* Mobile close button */}
        <div className="flex md:hidden items-center justify-between p-4 border-b border-workshop-border">
          <span className="font-bold text-sm text-workshop-text">Navigation</span>
          <button onClick={onCloseMobile} className="p-1 rounded hover:bg-gray-100">
            <X className="w-5 h-5 text-workshop-muted" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id || (activePage === 'jobcard_detail' && item.id === 'job_cards');

            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition group ${
                  isActive
                    ? 'bg-brand text-white shadow-xs font-semibold'
                    : 'text-workshop-text hover:bg-gray-100/80 hover:text-brand'
                }`}
                title={item.label}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-workshop-muted group-hover:text-brand'}`} />
                <span className={`truncate ${mobileOpen ? 'block' : 'hidden lg:block'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Footer info in desktop full view */}
        <div className="hidden lg:block p-4 border-t border-workshop-border bg-gray-50/50">
          <div className="text-[11px] text-workshop-muted leading-relaxed">
            <div className="font-semibold text-workshop-text">Pushpa Raj v1.0</div>
            <div>Offline Single-Computer</div>
          </div>
        </div>
      </aside>
    </>
  );
};

import React, { useState, useEffect } from 'react';
import { Search, LogOut, Shield, Wrench, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface Props {
  onOpenSearch: () => void;
  onToggleMobileMenu: () => void;
}

export const Header: React.FC<Props> = ({ onOpenSearch, onToggleMobileMenu }) => {
  const { user, logout } = useAuth();
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleDateString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }) + ' • ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      );
    };
    update();
    const interval = setInterval(update, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 w-full shrink-0 bg-white border-b border-workshop-border px-4 md:px-6 flex items-center justify-between sticky top-0 z-30">
      
      {/* Left: Mobile Toggle & Brand */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 rounded-lg text-workshop-muted hover:bg-gray-100"
          aria-label="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center text-white font-bold text-sm shadow-sm">
            PR
          </div>
          <div>
            <h1 className="font-display font-bold text-lg md:text-xl tracking-tight leading-tight text-workshop-text">
              PUSHPA RAJ AUTOMOTIVE
            </h1>
            <p className="text-[11px] text-workshop-muted font-medium hidden sm:block">
              Workshop Management System &bull; Offline
            </p>
          </div>
        </div>
      </div>

      {/* Center: Omnibox Search Button */}
      <div className="flex-1 max-w-md mx-4 hidden sm:block">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between px-3.5 py-2 bg-gray-50 hover:bg-gray-100 border border-workshop-border rounded-lg text-sm text-workshop-muted transition group"
        >
          <span className="flex items-center gap-2">
            <Search className="w-4 h-4 text-workshop-muted group-hover:text-brand transition" />
            <span>Search vehicles, customers, jobs, invoices...</span>
          </span>
          <kbd className="hidden md:inline-flex items-center gap-1 font-mono text-[11px] font-semibold bg-white px-2 py-0.5 border border-gray-300 rounded shadow-2xs">
            Ctrl + K
          </kbd>
        </button>
      </div>

      {/* Right: Date/Time + User Profile + Logout */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-workshop-muted hidden lg:block">
          {timeStr}
        </span>

        {/* Mobile Search Icon */}
        <button
          onClick={onOpenSearch}
          className="sm:hidden p-2 rounded-lg text-workshop-muted hover:bg-gray-100"
          aria-label="Search"
        >
          <Search className="w-5 h-5" />
        </button>

        {user && (
          <div className="flex items-center gap-2 pl-3 border-l border-workshop-border">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-workshop-text">{user.full_name}</div>
              <div className="flex items-center justify-end gap-1 text-[10px] uppercase font-semibold text-workshop-muted">
                {user.role === 'ADMIN' ? (
                  <span className="text-brand-deep flex items-center gap-0.5">
                    <Shield className="w-3 h-3" /> Admin
                  </span>
                ) : (
                  <span className="text-workshop-green flex items-center gap-0.5">
                    <Wrench className="w-3 h-3" /> Service Staff
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={logout}
              title="Logout"
              className="p-2 text-workshop-muted hover:text-workshop-red hover:bg-red-50 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

    </header>
  );
};

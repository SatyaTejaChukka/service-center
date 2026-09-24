import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { GlobalSearchModal } from './components/search/GlobalSearchModal';
import { NewJobCardModal } from './components/jobcard/NewJobCardModal';
import { NewCustomerModal } from './components/customer/NewCustomerModal';

import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { JobCardsPage } from './pages/JobCardsPage';
import { JobCardDetailPage } from './pages/JobCardDetailPage';
import { CustomersPage } from './pages/CustomersPage';
import { CustomerDetailPage } from './pages/CustomerDetailPage';
import { VehiclesPage } from './pages/VehiclesPage';
import { VehicleDetailPage } from './pages/VehicleDetailPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { CatalogsPage } from './pages/CatalogsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  const { user, loading, isSetupComplete } = useAuth();
  
  // Navigation State
  interface NavHistoryItem {
    page: string;
    id?: number;
    label?: string;
  }

  const [activePage, setActivePage] = useState<string>('dashboard');
  const [selectedJobCardId, setSelectedJobCardId] = useState<number | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [navHistory, setNavHistory] = useState<NavHistoryItem[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Global Modals State
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [newJobCardModalOpen, setNewJobCardModalOpen] = useState(false);
  const [newCustomerModalOpen, setNewCustomerModalOpen] = useState(false);

  // Global Keyboard Shortcut: Ctrl+K or / opens Omnibox Search (FR-SRC-001)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA')) {
        e.preventDefault();
        setSearchModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navigateTo = (page: string, id?: number, preserveHistory: boolean = true) => {
    if (preserveHistory) {
      const currentItem: NavHistoryItem = {
        page: activePage,
        id:
          activePage === 'jobcard_detail'
            ? selectedJobCardId ?? undefined
            : activePage === 'customer_detail'
            ? selectedCustomerId ?? undefined
            : activePage === 'vehicle_detail'
            ? selectedVehicleId ?? undefined
            : activePage === 'invoices'
            ? selectedInvoiceId ?? undefined
            : undefined,
      };

      setNavHistory((prev) => {
        if (
          prev.length > 0 &&
          prev[prev.length - 1].page === currentItem.page &&
          prev[prev.length - 1].id === currentItem.id
        ) {
          return prev;
        }
        return [...prev, currentItem];
      });
    }

    if (page === 'jobcard_detail' && id) {
      setSelectedJobCardId(id);
      setActivePage('jobcard_detail');
    } else if (page === 'customer_detail' && id) {
      setSelectedCustomerId(id);
      setActivePage('customer_detail');
    } else if (page === 'vehicle_detail' && id) {
      setSelectedVehicleId(id);
      setActivePage('vehicle_detail');
    } else if (page === 'invoices') {
      setSelectedInvoiceId(id ?? null);
      setActivePage('invoices');
    } else {
      setActivePage(page);
    }
  };

  const goBack = () => {
    if (navHistory.length > 0) {
      const prev = navHistory[navHistory.length - 1];
      setNavHistory((prevHistory) => prevHistory.slice(0, -1));
      navigateTo(prev.page, prev.id, false);
    } else {
      // Intelligent fallbacks
      if (activePage === 'jobcard_detail') setActivePage('job_cards');
      else if (activePage === 'customer_detail') setActivePage('customers');
      else if (activePage === 'vehicle_detail') setActivePage('vehicles');
      else if (activePage === 'invoices') setActivePage('dashboard');
      else setActivePage('dashboard');
    }
  };

  const getBackLabel = () => {
    if (navHistory.length > 0) {
      const top = navHistory[navHistory.length - 1];
      if (top.page === 'customer_detail') return 'Back to Customer';
      if (top.page === 'vehicle_detail') return 'Back to Vehicle';
      if (top.page === 'jobcard_detail') return 'Back to Job Card';
      if (top.page === 'invoices') return 'Back to Invoices';
      if (top.page === 'job_cards') return 'Back to Job Cards';
      if (top.page === 'customers') return 'Back to Customers';
      if (top.page === 'vehicles') return 'Back to Vehicles';
    }
    return undefined;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="font-display font-bold text-xl text-workshop-text">
            PUSHPA RAJ AUTOMOTIVE
          </div>
          <p className="text-xs text-workshop-muted">Loading local workshop database...</p>
        </div>
      </div>
    );
  }

  // 1. If no authenticated session -> Consistent Home Page (Login & Registration with integrated Setup Wizard)
  if (!user) {
    return <LoginPage />;
  }

  // 3. Main Workshop Application
  return (
    <div className="h-screen w-screen max-w-full max-h-full flex flex-col bg-[#F5F6F8] selection:bg-brand selection:text-white overflow-hidden overscroll-none select-none md:select-auto">
      
      {/* Header */}
      <Header
        onOpenSearch={() => setSearchModalOpen(true)}
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden items-stretch">
        {/* Responsive Sidebar */}
        <Sidebar
          activePage={activePage}
          onNavigate={(page) => {
            setNavHistory([]);
            navigateTo(page, undefined, false);
          }}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 h-full overflow-y-auto overscroll-contain">
          {activePage === 'dashboard' && (
            <DashboardPage
              onNavigate={(page, id) => navigateTo(page, id)}
              onOpenSearch={() => setSearchModalOpen(true)}
              onNewJobCard={() => setNewJobCardModalOpen(true)}
              onNewCustomer={() => setNewCustomerModalOpen(true)}
            />
          )}

          {activePage === 'job_cards' && (
            <JobCardsPage
              onNavigate={(page, id) => navigateTo(page, id)}
              onNewJobCard={() => setNewJobCardModalOpen(true)}
            />
          )}

          {activePage === 'jobcard_detail' && selectedJobCardId && (
            <JobCardDetailPage
              jobCardId={selectedJobCardId}
              onBack={goBack}
              backLabel={getBackLabel()}
              onNavigateToInvoice={(invId) => navigateTo('invoices', invId)}
              onNavigateToCustomer={(cId) => navigateTo('customer_detail', cId)}
              onNavigateToVehicle={(vId) => navigateTo('vehicle_detail', vId)}
            />
          )}

          {activePage === 'customers' && (
            <CustomersPage
              onNavigate={(page, id) => navigateTo(page, id)}
              onOpenNewCustomerModal={() => setNewCustomerModalOpen(true)}
            />
          )}

          {activePage === 'customer_detail' && selectedCustomerId && (
            <CustomerDetailPage
              customerId={selectedCustomerId}
              onBack={goBack}
              onNavigateToJobCard={(id) => navigateTo('jobcard_detail', id)}
              onNavigateToVehicle={(id) => navigateTo('vehicle_detail', id)}
              onNavigateToInvoice={(invId) => navigateTo('invoices', invId)}
            />
          )}

          {activePage === 'vehicles' && (
            <VehiclesPage
              onNavigate={(page, id) => navigateTo(page, id)}
            />
          )}

          {activePage === 'vehicle_detail' && selectedVehicleId && (
            <VehicleDetailPage
              vehicleId={selectedVehicleId}
              onBack={goBack}
              onNavigateToJobCard={(id) => navigateTo('jobcard_detail', id)}
              onNavigateToInvoice={(id) => navigateTo('invoices', id)}
              onNavigateToCustomer={(cId) => navigateTo('customer_detail', cId)}
            />
          )}

          {activePage === 'catalogs' && <CatalogsPage />}

          {activePage === 'invoices' && (
            <InvoicesPage
              initialInvoiceId={selectedInvoiceId}
              onClearInitialInvoiceId={() => setSelectedInvoiceId(null)}
              onNavigateToJobCard={(jcId) => navigateTo('jobcard_detail', jcId)}
              onNavigateToCustomer={(cId) => navigateTo('customer_detail', cId)}
              onNavigateToVehicle={(vId) => navigateTo('vehicle_detail', vId)}
              onBack={navHistory.length > 0 ? goBack : undefined}
              backLabel={getBackLabel()}
            />
          )}

          {activePage === 'reports' && <ReportsPage />}

          {activePage === 'settings' && <SettingsPage />}
        </main>
      </div>

      {/* Global Modals */}
      <GlobalSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onNavigate={(page, id) => navigateTo(page, id)}
      />

      <NewJobCardModal
        isOpen={newJobCardModalOpen}
        onClose={() => setNewJobCardModalOpen(false)}
        onJobCardCreated={(jcId) => {
          setSelectedJobCardId(jcId);
          setActivePage('jobcard_detail');
        }}
      />

      <NewCustomerModal
        isOpen={newCustomerModalOpen}
        onClose={() => setNewCustomerModalOpen(false)}
        onCustomerCreated={(cId) => {
          setSelectedCustomerId(cId);
          setActivePage('customer_detail');
        }}
      />

    </div>
  );
};

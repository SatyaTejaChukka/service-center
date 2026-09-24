import React, { useState } from 'react';
import {
  Lock,
  User as UserIcon,
  LogIn,
  UserPlus,
  Wrench,
  Shield,
  CheckCircle2,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  QrCode,
  KeyRound,
  Briefcase,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { login, isSetupComplete } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [regStep, setRegStep] = useState<1 | 2>(1);

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Register common state
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regRole, setRegRole] = useState<'STAFF' | 'ADMIN'>(isSetupComplete === false ? 'ADMIN' : 'STAFF');

  // Staff specific state
  const [regDesignation, setRegDesignation] = useState('Technician / Mechanic');
  const [regPhone, setRegPhone] = useState('');

  // Admin specific state (Workshop Setup Wizard)
  const [regBusinessName, setRegBusinessName] = useState('');
  const [regBusinessPhone, setRegBusinessPhone] = useState('');
  const [regBusinessAddress, setRegBusinessAddress] = useState('');
  const [regBusinessEmail, setRegBusinessEmail] = useState('');
  const [regBusinessGstin, setRegBusinessGstin] = useState('');
  const [regBusinessUpiId, setRegBusinessUpiId] = useState('');
  const [regAdminKey, setRegAdminKey] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    try {
      setLoading(true);
      const res = await apiRequest<{ access_token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), password }),
      });
      login(res.access_token, res.user);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleNextToSetupWizard = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!regFullName.trim()) {
      setError('Please provide your Full Name.');
      return;
    }

    if (!regUsername.trim()) {
      setError('Please provide a Username.');
      return;
    }

    if (regPassword.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    setRegStep(2);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!regFullName.trim()) {
      setError('Please provide your Full Name.');
      return;
    }

    if (!regUsername.trim()) {
      setError('Please provide a Username.');
      return;
    }

    if (regPassword.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    // Role-specific validations
    if (regRole === 'ADMIN') {
      if (!regBusinessName.trim()) {
        setError('Workshop / Business Name is required for Administrator registration.');
        return;
      }
      if (!regBusinessPhone.trim()) {
        setError('Official Workshop Phone number is required for Administrator registration.');
        return;
      }
      if (isSetupComplete && !regAdminKey.trim()) {
        setError('Admin Authorization Key is required to create an Administrator account.');
        return;
      }
    }

    try {
      setLoading(true);
      const payload: Record<string, any> = {
        username: regUsername.trim(),
        password: regPassword,
        full_name: regFullName.trim(),
        role: regRole,
      };

      if (regRole === 'ADMIN') {
        payload.business_name = regBusinessName.trim();
        payload.business_phone = regBusinessPhone.trim();
        payload.business_address = regBusinessAddress.trim() || undefined;
        payload.business_email = regBusinessEmail.trim() || undefined;
        payload.business_gstin = regBusinessGstin.trim() || undefined;
        payload.business_upi_id = regBusinessUpiId.trim() || undefined;
        if (isSetupComplete) {
          payload.admin_secret_key = regAdminKey.trim();
        }
      } else {
        payload.phone = regPhone.trim() || undefined;
        payload.designation = regDesignation.trim();
      }

      const res = await apiRequest<{ access_token: string; user: any }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setSuccessMsg(`Welcome, ${res.user.full_name}! Account created successfully. Signing in...`);
      setTimeout(() => {
        login(res.access_token, res.user);
      }, 600);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please check inputs or username uniqueness.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto overscroll-contain bg-[#F5F6F8] flex flex-col items-center p-4 sm:p-6 md:p-8">
      <div
        className={`w-full ${
          mode === 'register' && (regRole === 'ADMIN' || regStep === 2) ? 'max-w-2xl' : 'max-w-md'
        } transition-all duration-300 bg-white rounded-2xl shadow-xl border border-workshop-border overflow-hidden my-auto shrink-0`}
      >
        {/* Banner */}
        <div className="bg-brand p-5 text-white text-center">
          <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center mx-auto mb-2.5">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <h2 className="font-display font-bold text-xl md:text-2xl tracking-tight">
            PUSHPA RAJ AUTOMOTIVE
          </h2>
          <p className="text-xs text-blue-100 mt-0.5">
            Service Workshop Management System &bull; Offline
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 border-b border-workshop-border bg-gray-50/80">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setRegStep(1);
              setError(null);
              setSuccessMsg(null);
            }}
            className={`py-3 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'login'
                ? 'bg-white text-brand border-b-2 border-brand shadow-2xs'
                : 'text-workshop-muted hover:text-workshop-text'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" /> Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setRegStep(1);
              setError(null);
              setSuccessMsg(null);
            }}
            className={`py-3 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'register'
                ? 'bg-white text-brand border-b-2 border-brand shadow-2xs'
                : 'text-workshop-muted hover:text-workshop-text'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" /> Register New Account
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 md:p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium leading-relaxed">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-workshop-green text-xs rounded-lg font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* --- LOGIN MODE --- */}
          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              {isSetupComplete === false && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl flex items-start gap-2.5">
                  <Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Initial System Launch:</span> No workshop administrator has been registered yet. Click{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('register');
                        setRegRole('ADMIN');
                        setRegStep(1);
                        setError(null);
                      }}
                      className="font-bold underline text-amber-950 hover:text-brand cursor-pointer"
                    >
                      Register New Account
                    </button>{' '}
                    to launch the initial workshop setup wizard.
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-workshop-text mb-1">
                  Username
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-workshop-muted absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border border-workshop-border rounded-lg text-sm focus:outline-none focus:border-brand"
                    placeholder="Enter your username"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-workshop-text mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-workshop-muted absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border border-workshop-border rounded-lg text-sm focus:outline-none focus:border-brand"
                    placeholder="Enter your password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 px-4 bg-brand hover:bg-brand-deep text-white font-semibold rounded-lg transition shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  'Authenticating...'
                ) : (
                  <>
                    <LogIn className="w-4 h-4" /> Sign In to Workshop
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setRegStep(1);
                    setError(null);
                  }}
                  className="text-xs text-brand hover:underline font-semibold cursor-pointer"
                >
                  Need a new account? Register user &rarr;
                </button>
              </div>
            </form>
          ) : (
            /* --- REGISTRATION MODE WITH INTEGRATED SETUP WIZARD --- */
            <div>
              {/* Stepper Header for Admin registration */}
              {regRole === 'ADMIN' && (
                <div className="mb-5 pb-3 border-b border-workshop-border">
                  <div className="flex items-center justify-between">
                    <div
                      onClick={() => setRegStep(1)}
                      className={`flex items-center gap-2 cursor-pointer transition ${
                        regStep === 1 ? 'text-brand font-bold' : 'text-emerald-700 font-semibold'
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                          regStep === 1
                            ? 'bg-brand text-white shadow-sm'
                            : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {regStep === 2 ? '✓' : '1'}
                      </span>
                      <span className="text-xs">1. Account Setup</span>
                    </div>

                    <div className="h-0.5 flex-1 mx-4 bg-gray-200 relative">
                      <div
                        className="h-full bg-brand transition-all duration-300"
                        style={{ width: regStep === 2 ? '100%' : '0%' }}
                      />
                    </div>

                    <div
                      className={`flex items-center gap-2 ${
                        regStep === 2 ? 'text-brand font-bold' : 'text-workshop-muted font-medium'
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                          regStep === 2
                            ? 'bg-brand text-white shadow-sm'
                            : 'bg-gray-100 text-workshop-muted border border-gray-300'
                        }`}
                      >
                        2
                      </span>
                      <span className="text-xs">2. Workshop Setup Wizard</span>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 1: ACCOUNT DETAILS */}
              {regStep === 1 ? (
                <form onSubmit={regRole === 'ADMIN' ? handleNextToSetupWizard : handleRegister} className="space-y-4">
                  {/* Role Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-workshop-text mb-1.5">
                      Select Role *
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setRegRole('STAFF');
                          setError(null);
                        }}
                        className={`p-2.5 rounded-xl border text-left flex items-start gap-2 transition cursor-pointer ${
                          regRole === 'STAFF'
                            ? 'border-brand bg-blue-50/70 text-brand ring-1 ring-brand'
                            : 'border-workshop-border text-workshop-muted hover:border-gray-300 bg-white'
                        }`}
                      >
                        <Wrench className={`w-4 h-4 shrink-0 mt-0.5 ${regRole === 'STAFF' ? 'text-brand' : 'text-gray-400'}`} />
                        <div>
                          <div className="text-xs font-bold text-workshop-text">Staff / Tech</div>
                          <div className="text-[10px] text-workshop-muted mt-0.5">Job cards, intake &amp; service</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setRegRole('ADMIN');
                          setError(null);
                        }}
                        className={`p-2.5 rounded-xl border text-left flex items-start gap-2 transition cursor-pointer ${
                          regRole === 'ADMIN'
                            ? 'border-brand bg-blue-50/70 text-brand ring-1 ring-brand'
                            : 'border-workshop-border text-workshop-muted hover:border-gray-300 bg-white'
                        }`}
                      >
                        <Shield className={`w-4 h-4 shrink-0 mt-0.5 ${regRole === 'ADMIN' ? 'text-brand' : 'text-gray-400'}`} />
                        <div>
                          <div className="text-xs font-bold text-workshop-text flex items-center gap-1.5">
                            Administrator
                            {isSetupComplete === false && (
                              <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1 py-0.2 rounded">
                                Initial Setup
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-workshop-muted mt-0.5">Workshop owner &amp; settings</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Personal Account Information */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-workshop-text mb-1">
                        Full Name / Owner Name *
                      </label>
                      <div className="relative">
                        <UserIcon className="w-3.5 h-3.5 text-workshop-muted absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          required
                          value={regFullName}
                          onChange={(e) => setRegFullName(e.target.value)}
                          className="w-full pl-8 pr-2.5 py-2 border border-workshop-border rounded-lg text-xs focus:outline-none focus:border-brand"
                          placeholder="e.g. Pushpa Raj"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-workshop-text mb-1">
                        Username *
                      </label>
                      <div className="relative">
                        <UserIcon className="w-3.5 h-3.5 text-workshop-muted absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          required
                          value={regUsername}
                          onChange={(e) => setRegUsername(e.target.value)}
                          className="w-full pl-8 pr-2.5 py-2 border border-workshop-border rounded-lg text-xs focus:outline-none focus:border-brand"
                          placeholder="e.g. pushparaj"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Staff Specific Details */}
                  {regRole === 'STAFF' && (
                    <div className="p-3 bg-blue-50/40 border border-blue-100 rounded-xl space-y-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-brand pb-0.5">
                        <Briefcase className="w-3.5 h-3.5" /> Staff Details
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-workshop-text mb-1">
                            Designation / Role
                          </label>
                          <select
                            value={regDesignation}
                            onChange={(e) => setRegDesignation(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-workshop-border rounded-lg text-xs bg-white focus:outline-none focus:border-brand"
                          >
                            <option value="Technician / Mechanic">Technician / Mechanic</option>
                            <option value="Service Advisor">Service Advisor</option>
                            <option value="Electrician">Electrician</option>
                            <option value="Painter / Denter">Painter / Denter</option>
                            <option value="Inventory / Store Manager">Inventory / Store Manager</option>
                            <option value="Washing & Detailing Specialist">Washing &amp; Detailing Specialist</option>
                            <option value="Apprentice / Helper">Apprentice / Helper</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-workshop-text mb-1">
                            Mobile Number (Optional)
                          </label>
                          <div className="relative">
                            <Phone className="w-3 h-3 text-workshop-muted absolute left-2.5 top-2.5" />
                            <input
                              type="tel"
                              value={regPhone}
                              onChange={(e) => setRegPhone(e.target.value)}
                              className="w-full pl-7 pr-2.5 py-1.5 border border-workshop-border rounded-lg text-xs bg-white focus:outline-none focus:border-brand"
                              placeholder="+91 98765 00000"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Password & Confirm */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-workshop-text mb-1">
                        Password *
                      </label>
                      <div className="relative">
                        <Lock className="w-3.5 h-3.5 text-workshop-muted absolute left-2.5 top-2.5" />
                        <input
                          type="password"
                          required
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          className="w-full pl-8 pr-2.5 py-2 border border-workshop-border rounded-lg text-xs focus:outline-none focus:border-brand"
                          placeholder="Min 4 characters"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-workshop-text mb-1">
                        Confirm Password *
                      </label>
                      <div className="relative">
                        <Lock className="w-3.5 h-3.5 text-workshop-muted absolute left-2.5 top-2.5" />
                        <input
                          type="password"
                          required
                          value={regConfirmPassword}
                          onChange={(e) => setRegConfirmPassword(e.target.value)}
                          className="w-full pl-8 pr-2.5 py-2 border border-workshop-border rounded-lg text-xs focus:outline-none focus:border-brand"
                          placeholder="Re-enter password"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Submit / Next Button */}
                  {regRole === 'ADMIN' ? (
                    <button
                      type="submit"
                      className="w-full mt-2 py-2.5 px-4 bg-brand hover:bg-brand-deep text-white font-semibold rounded-lg transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                    >
                      Next: Workshop Setup Wizard <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full mt-2 py-2.5 px-4 bg-brand hover:bg-brand-deep text-white font-semibold rounded-lg transition shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {loading ? 'Creating Account...' : (
                        <>
                          <UserPlus className="w-4 h-4" /> Complete Staff Registration
                        </>
                      )}
                    </button>
                  )}

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setError(null);
                      }}
                      className="text-xs text-brand hover:underline font-semibold cursor-pointer"
                    >
                      Already have an account? Sign In &rarr;
                    </button>
                  </div>
                </form>
              ) : (
                /* STEP 2: WORKSHOP SETUP WIZARD (ADMIN PROFILE) */
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-brand-deep">
                      <Building2 className="w-4 h-4 text-brand" /> Workshop Profile Setup Wizard
                    </div>
                    <p className="text-[11px] text-workshop-muted">
                      Enter your workshop details. These are printed on all official job cards, customer invoices, and gate passes.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-workshop-text mb-1">
                        Workshop / Business Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={regBusinessName}
                        onChange={(e) => setRegBusinessName(e.target.value)}
                        placeholder="e.g. Pushpa Raj Automotive Services"
                        className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs focus:outline-none focus:border-brand"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-workshop-text mb-1">
                        Workshop Address *
                      </label>
                      <textarea
                        rows={2}
                        required
                        value={regBusinessAddress}
                        onChange={(e) => setRegBusinessAddress(e.target.value)}
                        placeholder="e.g. Main Road, Autonagar, Industrial Estate"
                        className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs focus:outline-none focus:border-brand resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-workshop-text mb-1">
                          Contact Phone *
                        </label>
                        <input
                          type="text"
                          required
                          value={regBusinessPhone}
                          onChange={(e) => setRegBusinessPhone(e.target.value)}
                          placeholder="e.g. +91 98765 43210"
                          className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs focus:outline-none focus:border-brand"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-workshop-text mb-1">
                          UPI ID for Customer Payments
                        </label>
                        <input
                          type="text"
                          value={regBusinessUpiId}
                          onChange={(e) => setRegBusinessUpiId(e.target.value)}
                          placeholder="e.g. pushparajauto@upi"
                          className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs focus:outline-none focus:border-brand"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-workshop-text mb-1">
                          GSTIN (Optional)
                        </label>
                        <input
                          type="text"
                          value={regBusinessGstin}
                          onChange={(e) => setRegBusinessGstin(e.target.value)}
                          placeholder="e.g. 37AAAAA0000A1Z5"
                          className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs focus:outline-none focus:border-brand font-mono uppercase"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-workshop-text mb-1">
                          Official Email (Optional)
                        </label>
                        <input
                          type="email"
                          value={regBusinessEmail}
                          onChange={(e) => setRegBusinessEmail(e.target.value)}
                          placeholder="e.g. service@pushparajauto.com"
                          className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs focus:outline-none focus:border-brand"
                        />
                      </div>
                    </div>

                    {/* Master Authorization Key (only if system is already set up and another admin exists) */}
                    {isSetupComplete && (
                      <div className="pt-2 border-t border-workshop-border-soft">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-amber-900 flex items-center gap-1">
                            <KeyRound className="w-3.5 h-3.5 text-amber-600" /> Admin Authorization Master Key *
                          </label>
                          <span className="text-[10px] text-amber-800 font-mono font-medium">
                            Default: <code className="bg-amber-100 px-1 py-0.5 rounded font-bold">PUSHPARAJ-ADMIN</code>
                          </span>
                        </div>
                        <input
                          type="password"
                          required
                          value={regAdminKey}
                          onChange={(e) => setRegAdminKey(e.target.value)}
                          className="w-full px-3 py-2 border border-amber-300 bg-amber-50/40 rounded-lg text-xs focus:outline-none focus:border-amber-500"
                          placeholder="Enter master key or active Admin password"
                        />
                      </div>
                    )}
                  </div>

                  {/* Actions: Back and Complete */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setRegStep(1)}
                      className="px-4 py-2.5 border border-workshop-border rounded-lg text-xs font-semibold text-workshop-text hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Back
                    </button>

                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-2.5 px-4 bg-brand hover:bg-brand-deep text-white font-semibold rounded-lg transition shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {loading ? (
                        'Configuring & Launching...'
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" /> Complete Setup &amp; Launch System
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

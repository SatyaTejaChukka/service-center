import React, { useState, useEffect } from 'react';
import {
  Building2,
  HardDrive,
  Users,
  Shield,
  Clock,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  KeyRound,
  FileCheck
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { formatINR } from '../lib/formatters';
import { useAuth } from '../context/AuthContext';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'BACKUP' | 'USERS' | 'AUDIT'>('PROFILE');
  
  // Profile state
  const [profile, setProfile] = useState<any>({
    name: '', address: '', phone: '', email: '', gstin: '', upi_id: '', terms: '', footer: ''
  });
  const [profileSaved, setProfileSaved] = useState(false);

  // Backup state
  const [backupStatus, setBackupStatus] = useState<any>(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState<any>(null);

  // Users state
  const [usersList, setUsersList] = useState<any[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState('STAFF');

  // Audit state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const fetchProfile = async () => {
    try {
      const res = await apiRequest('/settings/business');
      setProfile(res);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBackupStatus = async () => {
    try {
      const res = await apiRequest('/backup/status');
      setBackupStatus(res);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    if (user?.role !== 'ADMIN') return;
    try {
      const res = await apiRequest('/users');
      setUsersList(res);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAuditLogs = async () => {
    if (user?.role !== 'ADMIN') return;
    try {
      const res = await apiRequest('/audit');
      setAuditLogs(res);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchBackupStatus();
    if (user?.role === 'ADMIN') {
      fetchUsers();
      fetchAuditLogs();
    }
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/settings/business', {
        method: 'PUT',
        body: JSON.stringify(profile),
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update profile');
    }
  };

  const handleBackupNow = async () => {
    try {
      setBackupLoading(true);
      setBackupSuccess(null);
      const res = await apiRequest('/backup/now', { method: 'POST' });
      setBackupSuccess(res);
      fetchBackupStatus();
    } catch (err: any) {
      alert(err.message || 'Backup failed');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestore = async (folderPath: string) => {
    if (!window.confirm('WARNING: Restoring will overwrite the current database with this snapshot. A safety backup of the current database will be saved automatically. Do you want to proceed?')) {
      return;
    }
    try {
      const res = await apiRequest('/backup/restore', {
        method: 'POST',
        body: JSON.stringify({ backup_folder_path: folderPath }),
      });
      alert(res.message);
      window.location.reload();
    } catch (err: any) {
      alert(err.message || 'Restore failed');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
          full_name: newFullName.trim(),
          role: newRole,
        }),
      });
      setNewUsername('');
      setNewPassword('');
      setNewFullName('');
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to create user');
    }
  };

  const handleToggleUser = async (uid: number) => {
    try {
      await apiRequest(`/users/${uid}/toggle-status`, { method: 'PATCH' });
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      
      <div>
        <h2 className="font-display font-bold text-2xl md:text-3xl text-workshop-text tracking-tight">
          System Settings &amp; Data Safety
        </h2>
        <p className="text-sm text-workshop-muted">
          Configure workshop branding, manage staff accounts, audit trails, and transactional database backups.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-workshop-border pb-3">
        <button
          onClick={() => setActiveTab('PROFILE')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
            activeTab === 'PROFILE' ? 'bg-brand text-white shadow-xs' : 'bg-white text-workshop-muted hover:bg-gray-100'
          }`}
        >
          <Building2 className="w-4 h-4" /> Workshop Profile
        </button>
        <button
          onClick={() => setActiveTab('BACKUP')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
            activeTab === 'BACKUP' ? 'bg-brand text-white shadow-xs' : 'bg-white text-workshop-muted hover:bg-gray-100'
          }`}
        >
          <HardDrive className="w-4 h-4" /> Backup &amp; Restore
        </button>
        {user?.role === 'ADMIN' && (
          <>
            <button
              onClick={() => setActiveTab('USERS')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
                activeTab === 'USERS' ? 'bg-brand text-white shadow-xs' : 'bg-white text-workshop-muted hover:bg-gray-100'
              }`}
            >
              <Users className="w-4 h-4" /> User Management
            </button>
            <button
              onClick={() => setActiveTab('AUDIT')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
                activeTab === 'AUDIT' ? 'bg-brand text-white shadow-xs' : 'bg-white text-workshop-muted hover:bg-gray-100'
              }`}
            >
              <Shield className="w-4 h-4" /> Audit Trail
            </button>
          </>
        )}
      </div>

      {/* 1. Workshop Profile Tab */}
      {activeTab === 'PROFILE' && (
        <form onSubmit={handleSaveProfile} className="bg-white p-6 rounded-xl border border-workshop-border shadow-2xs space-y-5 max-w-2xl">
          {profileSaved && (
            <div className="p-3 bg-green-50 text-workshop-green border border-green-200 text-xs font-semibold rounded-lg flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Workshop profile updated successfully!
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-workshop-text mb-1">Workshop Name *</label>
              <input
                type="text"
                required
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-workshop-text mb-1">Workshop Address *</label>
              <textarea
                rows={2}
                required
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-workshop-text mb-1">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-workshop-text mb-1">UPI ID (for payments)</label>
                <input
                  type="text"
                  value={profile.upi_id}
                  onChange={(e) => setProfile({ ...profile, upi_id: e.target.value })}
                  className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-workshop-text mb-1">GSTIN (if registered)</label>
                <input
                  type="text"
                  value={profile.gstin}
                  onChange={(e) => setProfile({ ...profile, gstin: e.target.value })}
                  className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-workshop-text mb-1">Email</label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-workshop-text mb-1">Invoice Terms &amp; Conditions</label>
              <textarea
                rows={3}
                value={profile.terms}
                onChange={(e) => setProfile({ ...profile, terms: e.target.value })}
                className="w-full px-3 py-2 border border-workshop-border rounded-lg text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-workshop-text mb-1">Invoice Footer Message</label>
              <input
                type="text"
                value={profile.footer}
                onChange={(e) => setProfile({ ...profile, footer: e.target.value })}
                className="w-full px-3 py-2 border border-workshop-border rounded-lg text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            className="py-2.5 px-5 bg-brand text-white font-semibold text-xs rounded-lg hover:bg-brand-deep cursor-pointer"
          >
            Save Workshop Profile
          </button>
        </form>
      )}

      {/* 2. Backup & Restore Tab (Section 16) */}
      {activeTab === 'BACKUP' && (
        <div className="space-y-6 max-w-4xl">
          
          {/* 3-Day Age Alert Banner (FR-BAK-004) */}
          {backupStatus?.warning_needed && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <span className="font-bold text-sm text-amber-950">Backup Needed!</span>
                  <div>{backupStatus.warning_message} To protect workshop data against disk failure, take a backup now.</div>
                </div>
              </div>
              <button
                onClick={handleBackupNow}
                disabled={backupLoading}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs shrink-0 cursor-pointer"
              >
                Backup Now
              </button>
            </div>
          )}

          {/* Backup Action Card */}
          <div className="bg-white p-6 rounded-xl border border-workshop-border shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-base text-workshop-text flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-brand" /> Offline Database &amp; Documents Snapshot
                </h3>
                <p className="text-xs text-workshop-muted mt-1">
                  Uses SQLite's online backup API to take a 100% consistent transactional copy of the database and documents with SHA-256 checksums.
                </p>
              </div>
              <button
                onClick={handleBackupNow}
                disabled={backupLoading}
                className="px-5 py-2.5 bg-workshop-green hover:opacity-90 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
              >
                {backupLoading ? 'Creating Snapshot...' : '✓ Backup Now'}
              </button>
            </div>

            {backupSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-900 text-xs rounded-lg">
                <span className="font-bold">✓ Snapshot Created:</span> {backupSuccess.folder_name} ({backupSuccess.total_files} files, {Math.round(backupSuccess.total_size_bytes / 1024)} KB).
              </div>
            )}
          </div>

          {/* Past Backups List */}
          <div className="bg-white rounded-xl border border-workshop-border overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-workshop-border">
              <h4 className="font-bold text-sm text-workshop-text">Available Backup Snapshots</h4>
              <span className="text-xs text-workshop-muted">Location: {backupStatus?.backups_directory}</span>
            </div>

            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] border-b border-workshop-border text-workshop-muted uppercase">
                <tr>
                  <th className="px-4 py-3">Snapshot Folder</th>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Files</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3 text-right">Restore Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-workshop-border-soft">
                {backupStatus?.backups?.map((b: any) => (
                  <tr key={b.folder_name} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-mono font-bold text-brand-deep">{b.folder_name}</td>
                    <td className="px-4 py-3 text-workshop-muted">{b.created_at}</td>
                    <td className="px-4 py-3 font-mono">{b.total_files} files</td>
                    <td className="px-4 py-3 font-mono">{Math.round(b.total_size_bytes / 1024)} KB</td>
                    <td className="px-4 py-3 text-right">
                      {user?.role === 'ADMIN' && (
                        <button
                          onClick={() => handleRestore(b.full_path)}
                          className="px-3 py-1 bg-white hover:bg-red-50 text-workshop-red border border-red-200 rounded font-semibold text-[11px] cursor-pointer"
                        >
                          Restore from Snapshot
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {(!backupStatus?.backups || backupStatus.backups.length === 0) && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-workshop-muted">No backup snapshots found. Click Backup Now above.</td></tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* 3. User Management Tab (Admin Only) */}
      {activeTab === 'USERS' && user?.role === 'ADMIN' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-workshop-border overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-workshop-border">
              <h3 className="font-bold text-sm text-workshop-text">Workshop Staff Accounts</h3>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] border-b border-workshop-border text-workshop-muted uppercase">
                <tr>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Full Name</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-workshop-border-soft">
                {usersList.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3 font-mono font-bold text-workshop-text">{u.username}</td>
                    <td className="px-4 py-3 font-medium">{u.full_name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${u.role === 'ADMIN' ? 'bg-blue-100 text-brand-deep' : 'bg-green-100 text-green-800'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold ${u.is_active ? 'text-workshop-green' : 'text-workshop-red'}`}>
                        {u.is_active ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.id !== user.id && (
                        <button
                          onClick={() => handleToggleUser(u.id)}
                          className="text-[11px] text-brand hover:underline font-semibold"
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Create User Form */}
          <div className="bg-white p-5 rounded-xl border border-workshop-border shadow-2xs space-y-4 h-fit">
            <h4 className="font-bold text-sm text-workshop-text">+ Create Staff Account</h4>
            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-workshop-text mb-1">Username *</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-3 py-1.5 border border-workshop-border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-workshop-text mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-workshop-border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-workshop-text mb-1">Password *</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-1.5 border border-workshop-border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-workshop-text mb-1">Role *</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-3 py-1.5 border border-workshop-border rounded-lg text-xs bg-white"
                >
                  <option value="STAFF">Service Staff (Day-to-day operations)</option>
                  <option value="ADMIN">Administrator (Full settings &amp; void access)</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-brand text-white font-semibold text-xs rounded-lg hover:bg-brand-deep cursor-pointer"
              >
                Create Account
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4. Audit Trail Tab (Admin Only) */}
      {activeTab === 'AUDIT' && user?.role === 'ADMIN' && (
        <div className="bg-white rounded-xl border border-workshop-border overflow-hidden shadow-2xs">
          <div className="p-4 border-b border-workshop-border">
            <h3 className="font-bold text-sm text-workshop-text">Append-Only Audit Log</h3>
            <p className="text-xs text-workshop-muted">Every sensitive action, invoice finalisation, status change, and payment is permanently logged.</p>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFC] border-b border-workshop-border text-workshop-muted uppercase">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Entity ID</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-workshop-border-soft">
              {auditLogs.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 font-mono text-workshop-muted">{a.at}</td>
                  <td className="px-4 py-2.5 font-semibold text-workshop-text">{a.user}</td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono font-bold bg-gray-100 px-1.5 py-0.5 rounded text-[11px]">
                      {a.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-workshop-muted">{a.entity}</td>
                  <td className="px-4 py-2.5 font-mono">{a.entity_id}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-workshop-muted truncate max-w-xs">
                    {a.after_json || a.before_json || '-'}
                  </td>
                </tr>
              ))}
              {auditLogs.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-workshop-muted">No audit entries found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
};

import { useEffect, useState } from 'react';
import {
  ShieldCheck, UserPlus, Lock, Key, Users, CheckCircle2,
  AlertTriangle, Eye, Shield, RefreshCw
} from 'lucide-react';
import { api, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

type AdminUser = {
  _id: string;
  name: string;
  email: string;
  adminRole?: string;
  isSuspended?: boolean;
  suspensionReason?: string;
  createdAt: string;
};

const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: [
    'manage_admins',
    'manage_properties',
    'manage_partners',
    'manage_bookings',
    'manage_finance',
    'manage_refunds',
    'manage_settlements',
    'manage_users',
    'manage_support',
    'view_reports',
    'view_audit_logs',
  ],
  operations_admin: [
    'manage_properties',
    'manage_partners',
    'manage_bookings',
    'view_reports',
    'view_audit_logs',
  ],
  finance_admin: [
    'manage_finance',
    'manage_refunds',
    'manage_settlements',
    'manage_bookings',
    'view_reports',
    'view_audit_logs',
  ],
  support_admin: [
    'manage_support',
    'view_bookings',
    'view_customers',
    'view_reports',
  ],
};

const formatDate = (val?: string) => (val ? new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

const AdminRoles = () => {
  const token = useAuthStore((s) => s.token);
  const currentUser = useAuthStore((s) => s.user);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [selectedRole, setSelectedRole] = useState('operations_admin');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newAdminRole, setNewAdminRole] = useState('operations_admin');
  const [message, setMessage] = useState<string | null>(null);

  const fetchAdmins = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api.get('/users/admin-users', withAuth(token));
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setAdmins(res.data.data);
      }
    } catch {
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAdmins();
  }, [token]);

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingAdmin) return;
    try {
      const res = await api.put(
        `/users/admin-users/${editingAdmin._id}/role`,
        { adminRole: selectedRole },
        withAuth(token)
      );
      if (res.data?.success) {
        setMessage(`Role for ${editingAdmin.name} updated to ${selectedRole}`);
        setTimeout(() => setMessage(null), 4000);
        setEditingAdmin(null);
        void fetchAdmins();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update admin role');
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await api.post(
        '/users/admin-users',
        {
          name: newName,
          email: newEmail,
          password: newPassword,
          adminRole: newAdminRole,
        },
        withAuth(token)
      );
      if (res.data?.success) {
        setMessage(`New administrator ${newName} provisioned successfully.`);
        setTimeout(() => setMessage(null), 4000);
        setShowCreateModal(false);
        setNewName('');
        setNewEmail('');
        setNewPassword('');
        void fetchAdmins();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create admin');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-card border border-border p-4 rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-heading font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="text-brand-crimson" size={20} />
            Role-Based Access Control (RBAC) Governance
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Admin privilege separation: Super Admin, Operations Admin, Finance Admin, Support Admin
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3.5 py-2 bg-brand-crimson hover:bg-brand-crimson/90 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
        >
          <UserPlus size={14} /> Add Administrator
        </button>
      </div>

      {message && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 size={16} />
          {message}
        </div>
      )}

      {/* Role-Permission Matrix Card */}
      <div className="bg-card border border-border p-4 rounded-xl shadow-xs space-y-3">
        <h3 className="font-heading font-bold text-foreground text-xs uppercase tracking-wider flex items-center gap-1.5">
          <Lock size={14} className="text-brand-crimson" /> Authoritative Role-to-Permission Mapping
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-muted/40 rounded-lg space-y-1.5 border border-border">
            <span className="font-bold text-brand-crimson block">Super Admin</span>
            <p className="text-[11px] text-muted-foreground">Unrestricted platform authority, admin management, and policy overrides.</p>
            <span className="text-[10px] bg-brand-crimson/10 text-brand-crimson px-2 py-0.5 rounded-full font-semibold inline-block">11 Permissions</span>
          </div>

          <div className="p-3 bg-muted/40 rounded-lg space-y-1.5 border border-border">
            <span className="font-bold text-foreground block">Operations Admin</span>
            <p className="text-[11px] text-muted-foreground">Property reviews, partner approvals, room inventory, and check-in desks.</p>
            <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-semibold inline-block">5 Permissions</span>
          </div>

          <div className="p-3 bg-muted/40 rounded-lg space-y-1.5 border border-border">
            <span className="font-bold text-foreground block">Finance Admin</span>
            <p className="text-[11px] text-muted-foreground">Partner settlements, refund approvals, ledger audits, and payout cycles.</p>
            <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-semibold inline-block">6 Permissions</span>
          </div>

          <div className="p-3 bg-muted/40 rounded-lg space-y-1.5 border border-border">
            <span className="font-bold text-foreground block">Support Admin</span>
            <p className="text-[11px] text-muted-foreground">Grievance ticketing, customer inquiries, and dispute resolution.</p>
            <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-semibold inline-block">4 Permissions</span>
          </div>
        </div>
      </div>

      {/* Admin Users Table */}
      <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="p-3">Administrator Name</th>
                <th className="p-3">Email Address</th>
                <th className="p-3">Assigned RBAC Role</th>
                <th className="p-3">Permissions Scope</th>
                <th className="p-3">Created Date</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Loading admin accounts...
                  </td>
                </tr>
              ) : admins.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No administrators found.
                  </td>
                </tr>
              ) : (
                admins.map((adm) => (
                  <tr key={adm._id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-semibold text-foreground">
                      {adm.name}
                      {adm.email === currentUser?.email && (
                        <span className="ml-2 text-[10px] bg-brand-crimson/10 text-brand-crimson px-1.5 py-0.5 rounded font-bold">You</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-muted-foreground">{adm.email}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                        adm.adminRole === 'super_admin'
                          ? 'bg-brand-crimson/10 text-brand-crimson font-bold'
                          : 'bg-muted text-foreground'
                      }`}>
                        {(adm.adminRole || 'super_admin').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground text-[11px]">
                      {(ROLE_PERMISSIONS[adm.adminRole || 'super_admin'] || []).length} Granted
                    </td>
                    <td className="p-3 text-muted-foreground text-[11px]">{formatDate(adm.createdAt)}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          setEditingAdmin(adm);
                          setSelectedRole(adm.adminRole || 'operations_admin');
                        }}
                        className="px-2.5 py-1 text-xs border border-border hover:bg-muted rounded-md transition-colors font-medium"
                      >
                        Change Role
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Role Modal */}
      {editingAdmin && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleUpdateRole} className="bg-card border border-border rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-heading font-bold text-foreground">Modify Administrator Role</h3>
                <p className="text-xs text-muted-foreground">{editingAdmin.name} ({editingAdmin.email})</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingAdmin(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-foreground block mb-1.5">Select Role Group</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-gold"
                >
                  <option value="super_admin">Super Admin (All permissions)</option>
                  <option value="operations_admin">Operations Admin (Properties, Partners, Bookings)</option>
                  <option value="finance_admin">Finance Admin (Payouts, Refunds, Statements)</option>
                  <option value="support_admin">Support Admin (Grievances, Inquiries)</option>
                </select>
              </div>

              <div className="p-3 bg-muted/40 rounded-lg space-y-1">
                <span className="font-semibold text-foreground block text-[11px]">Assigned Privileges:</span>
                <ul className="list-disc list-inside text-[10px] text-muted-foreground space-y-0.5">
                  {(ROLE_PERMISSIONS[selectedRole] || []).map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setEditingAdmin(null)}
                className="px-3.5 py-1.5 border border-border rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-brand-crimson text-white rounded-lg text-xs font-semibold"
              >
                Save Role
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Admin Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateAdmin} className="bg-card border border-border rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-heading font-bold text-foreground">Provision Administrator Account</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-foreground block mb-1">Full Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-gold text-xs"
                  required
                />
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">Email Address</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-gold text-xs"
                  required
                />
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">Temporary Password (min 8 characters)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-gold text-xs"
                  required
                />
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">Role Classification</label>
                <select
                  value={newAdminRole}
                  onChange={(e) => setNewAdminRole(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-gold text-xs"
                >
                  <option value="operations_admin">Operations Admin</option>
                  <option value="finance_admin">Finance Admin</option>
                  <option value="support_admin">Support Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-3.5 py-1.5 border border-border rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-brand-crimson text-white rounded-lg text-xs font-semibold"
              >
                Provision Admin
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminRoles;

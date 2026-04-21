import { useEffect, useMemo, useState } from 'react';
import { Users, Trash2 } from 'lucide-react';
import { api, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import axios from 'axios';

type AdminUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  createdAt: string;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const getString = (obj: Record<string, unknown>, key: string) => (typeof obj[key] === 'string' ? obj[key] : '');

const normalizeUser = (u: unknown): AdminUser => {
  const obj = isRecord(u) ? u : {};
  return {
    id: getString(obj, '_id') || getString(obj, 'id'),
    name: getString(obj, 'name'),
    email: getString(obj, 'email'),
    phone: getString(obj, 'phone'),
    role: getString(obj, 'role') || 'user',
    createdAt: getString(obj, 'createdAt') || new Date().toISOString(),
  };
};

const getApiErrorMessage = (err: unknown, fallback: string) => {
  if (axios.isAxiosError(err)) {
    const msg = (err.response?.data as any)?.message;
    if (typeof msg === 'string') return msg;
    return err.message || fallback;
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
};

const ManageUsers = () => {
  const token = useAuthStore((s) => s.token);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const canLoad = Boolean(token);

  const loadUsers = async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const res = await api.get('/users', withAuth(token));
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      setUsers(data.map(normalizeUser));
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to load users'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!canLoad) return;
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoad]);

  const sorted = useMemo(
    () => [...users].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [users]
  );

  const handleDelete = async (id: string) => {
    if (!token) return;
    if (id === currentUserId) return toast.error("You can't delete your own admin account");
    try {
      await api.delete(`/users/${id}`, withAuth(token));
      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast.success('User deleted');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Delete failed'));
    }
  };

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="font-body text-sm text-muted-foreground">Loading usersâ€¦</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Users size={48} className="mx-auto mb-4 text-muted-foreground/30" />
          <p className="font-heading text-xl text-foreground mb-2">No Users Yet</p>
          <p className="font-body text-sm text-muted-foreground">Registered users will appear here.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden sm:table-cell">Phone</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden md:table-cell">Role</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden md:table-cell">Joined</th>
                <th className="text-right px-4 py-3 font-body text-xs font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-body text-sm font-medium text-foreground">{u.name}</td>
                  <td className="px-4 py-3 font-body text-sm text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3 font-body text-sm text-muted-foreground hidden sm:table-cell">{u.phone}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span
                      className={`font-body text-xs px-2 py-1 rounded-full ${
                        u.role === 'admin' ? 'bg-brand-crimson/10 text-brand-crimson' : 'bg-brand-green/10 text-brand-green'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-body text-xs text-muted-foreground hidden md:table-cell">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(u.id)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border border-border hover:bg-destructive/10 text-destructive transition-colors"
                      disabled={u.id === currentUserId}
                      title={u.id === currentUserId ? 'Cannot delete current admin' : 'Delete user'}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ManageUsers;

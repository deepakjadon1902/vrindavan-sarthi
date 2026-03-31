import { Users } from 'lucide-react';

// Shows registered users from localStorage
const STORAGE_KEY = 'vvs_users';

const ManageUsers = () => {
  let users: Array<{ id: string; name: string; email: string; phone: string; role: string; createdAt: string }> = [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) users = JSON.parse(data).map((u: any) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, createdAt: u.createdAt }));
  } catch {}

  return (
    <div className="space-y-6">
      {users.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Users size={48} className="mx-auto mb-4 text-muted-foreground/30" />
          <p className="font-heading text-xl text-foreground mb-2">No Users Yet</p>
          <p className="font-body text-sm text-muted-foreground">Registered users will appear here.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Name</th>
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Email</th>
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden sm:table-cell">Phone</th>
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden md:table-cell">Role</th>
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden md:table-cell">Joined</th>
            </tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-body text-sm font-medium text-foreground">{u.name}</td>
                  <td className="px-4 py-3 font-body text-sm text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3 font-body text-sm text-muted-foreground hidden sm:table-cell">{u.phone}</td>
                  <td className="px-4 py-3 hidden md:table-cell"><span className={`font-body text-xs px-2 py-1 rounded-full ${u.role === 'admin' ? 'bg-brand-crimson/10 text-brand-crimson' : 'bg-brand-green/10 text-brand-green'}`}>{u.role}</span></td>
                  <td className="px-4 py-3 font-body text-xs text-muted-foreground hidden md:table-cell">{new Date(u.createdAt).toLocaleDateString()}</td>
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

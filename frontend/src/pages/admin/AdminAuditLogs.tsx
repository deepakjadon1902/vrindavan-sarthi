import { useEffect, useState } from 'react';
import {
  ShieldAlert, Search, Filter, Calendar, Clock, User, Eye,
  RefreshCw, CheckCircle2, AlertTriangle, FileCode
} from 'lucide-react';
import { api, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

type AuditLogItem = {
  _id: string;
  action: string;
  targetEntityType: string;
  targetEntityId: string;
  reason?: string;
  bookingId?: string;
  actorRole: string;
  actorName: string;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  metadata?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  timestamp: string;
};

const ENTITY_TYPES = ['all', 'property', 'partner', 'booking', 'customer', 'refund', 'settlement', 'support_ticket', 'admin_user', 'system'];

const formatDate = (val?: string) => (val ? new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-');

const AdminAuditLogs = () => {
  const token = useAuthStore((s) => s.token);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [targetEntityType, setTargetEntityType] = useState('all');
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const fetchAuditLogs = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api.get('/admin/audit-logs', {
        ...withAuth(token),
        params: {
          q: search,
          targetEntityType: targetEntityType === 'all' ? undefined : targetEntityType,
        },
      });
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setLogs(res.data.data);
      }
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAuditLogs();
  }, [token, targetEntityType]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void fetchAuditLogs();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-card border border-border p-4 rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-heading font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="text-brand-crimson" size={20} />
            Centralized Platform Audit Trail
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Immutable security log recording all administrative modifications, KYC approvals, and financial decisions
          </p>
        </div>
        <span className="text-xs bg-muted px-3 py-1.5 rounded-lg border border-border text-foreground font-semibold">
          Total Captured: {logs.length}
        </span>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action, actor, reason, entity ID..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-gold"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-muted-foreground font-medium">Entity Type:</span>
          <select
            value={targetEntityType}
            onChange={(e) => setTargetEntityType(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-gold capitalize"
          >
            {ENTITY_TYPES.map((e) => (
              <option key={e} value={e}>{e.replace('_', ' ')}</option>
            ))}
          </select>

          <button
            onClick={() => void fetchAuditLogs()}
            disabled={loading}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg border border-border transition-colors ml-1"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="p-3">Timestamp</th>
                <th className="p-3">Action</th>
                <th className="p-3">Target Entity</th>
                <th className="p-3">Actor / Admin</th>
                <th className="p-3">Reason / Remarks</th>
                <th className="p-3 text-right">Inspection</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Querying audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No audit records found matching criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono text-[11px] text-muted-foreground">
                      {formatDate(log.timestamp)}
                    </td>
                    <td className="p-3 font-semibold text-foreground font-mono">
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-brand-crimson/10 text-brand-crimson">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="font-semibold text-foreground capitalize">{log.targetEntityType}</span>
                      <span className="block text-[10px] text-muted-foreground font-mono truncate max-w-xs">{log.targetEntityId}</span>
                    </td>
                    <td className="p-3">
                      <span className="font-medium text-foreground">{log.actorName}</span>
                      <span className="block text-[10px] text-muted-foreground uppercase">{log.actorRole}</span>
                    </td>
                    <td className="p-3 text-foreground max-w-xs truncate">
                      {log.reason || '-'}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 text-xs border border-border hover:bg-muted rounded-md transition-colors font-medium inline-flex items-center gap-1"
                      >
                        <Eye size={12} /> Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* State Inspection Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-2xl w-full p-5 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-heading font-bold text-foreground">Audit Record Inspection</h3>
                <p className="text-xs text-muted-foreground">Log ID: {selectedLog._id}</p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-lg">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Action</span>
                  <span className="font-semibold text-brand-crimson font-mono">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Timestamp</span>
                  <span className="font-semibold text-foreground">{formatDate(selectedLog.timestamp)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Admin Actor</span>
                  <span className="font-semibold text-foreground">{selectedLog.actorName} ({selectedLog.actorRole})</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Client IP / Agent</span>
                  <span className="font-mono text-[10px] text-foreground">{selectedLog.ip || 'Localhost'}</span>
                </div>
              </div>

              {selectedLog.reason && (
                <div className="p-3 border border-border rounded-lg">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase">Reason / Remarks</span>
                  <p className="text-foreground mt-0.5">{selectedLog.reason}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase">Before State</span>
                  <pre className="p-3 bg-muted/60 border border-border rounded-lg text-[10px] font-mono overflow-x-auto max-h-48 text-foreground">
                    {JSON.stringify(selectedLog.beforeState || {}, null, 2)}
                  </pre>
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase">After State</span>
                  <pre className="p-3 bg-muted/60 border border-border rounded-lg text-[10px] font-mono overflow-x-auto max-h-48 text-foreground">
                    {JSON.stringify(selectedLog.afterState || {}, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-border">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 border border-border rounded-lg hover:bg-muted text-xs font-medium"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAuditLogs;

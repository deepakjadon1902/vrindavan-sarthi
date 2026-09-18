import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { api, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

type OpsSummary = {
  bookings?: { pending?: number; expiredCandidates?: number };
  actionRequired?: Record<string, number>;
  queues?: { queues?: Array<{ queueName: string; available: boolean; counts?: Record<string, number>; paused?: boolean; error?: string }> };
};

const sections = [
  { key: 'payment-reconciliations', label: 'Payment Reconciliation', retry: true },
  { key: 'refunds', label: 'Refunds', retry: true },
  { key: 'webhooks', label: 'Webhooks', retry: true },
  { key: 'notifications', label: 'Notifications', retry: true },
  { key: 'channel-sync', label: 'Channel Sync', retry: true },
  { key: 'bookings', label: 'Bookings', retry: false },
];

const statusParam: Record<string, string> = {
  'payment-reconciliations': 'reconciliation_required',
  refunds: 'failed',
  webhooks: 'failed',
  notifications: 'failed',
  'channel-sync': 'failed',
};

const AdminOperations = () => {
  const token = useAuthStore((s) => s.token);
  const [summary, setSummary] = useState<OpsSummary | null>(null);
  const [health, setHealth] = useState<any>(null);
  const [active, setActive] = useState('payment-reconciliations');
  const [records, setRecords] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState('');

  const auth = useMemo(() => withAuth(token), [token]);

  const loadSummary = useCallback(async () => {
    if (!token) return;
    const [summaryRes, healthRes] = await Promise.all([
      api.get('/admin/operations/summary', auth),
      api.get('/admin/operations/health', auth),
    ]);
    setSummary(summaryRes.data?.data || null);
    setHealth(healthRes.data?.data || null);
  }, [auth, token]);

  const loadRecords = useCallback(async (nextPage = 1) => {
    if (!token) return;
    setLoading(true);
    try {
      const params: any = { page: nextPage, limit: 10 };
      if (statusParam[active]) params.status = statusParam[active];
      if (active === 'bookings') params.expirationCandidate = 'true';
      const res = await api.get(`/admin/operations/${active}`, { ...auth, params });
      setRecords(Array.isArray(res.data?.data) ? res.data.data : []);
      setPagination(res.data?.pagination || null);
      setPage(nextPage);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Operational records could not be loaded');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [active, auth, token]);

  useEffect(() => {
    void loadSummary().catch(() => toast.error('Operational summary could not be loaded'));
  }, [loadSummary, token]);

  useEffect(() => {
    void loadRecords(1);
  }, [active, loadRecords, token]);

  const retryRecord = async (record: any) => {
    if (!token || !record?._id) return;
    setActionId(record._id);
    try {
      await api.post(`/admin/operations/${active}/${record._id}/retry`, {}, auth);
      toast.success('Retry queued');
      await Promise.all([loadRecords(page), loadSummary()]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Retry failed');
    } finally {
      setActionId('');
    }
  };

  const actionRequired = summary?.actionRequired || {};
  const queueRows = summary?.queues?.queues || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-semibold">Operations</h2>
          <p className="text-sm text-muted-foreground">Reliability status, retries, and recoverable failures.</p>
        </div>
        <button
          onClick={() => Promise.all([loadSummary(), loadRecords(page)])}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm hover:bg-muted"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-6">
        {[
          ['Payment action', actionRequired.paymentReconciliations || 0],
          ['Refund action', actionRequired.refunds || 0],
          ['Failed webhooks', actionRequired.webhooks || 0],
          ['Failed notifications', actionRequired.notifications || 0],
          ['Channel action', actionRequired.channelSync || 0],
          ['OTA review', actionRequired.channelReconciliation || 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <section className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={18} />
            <h3 className="font-semibold">System Health</h3>
          </div>
          <div className="space-y-2 text-sm">
            {['api', 'mongo', 'redis', 'bullmq', 'worker'].map((key) => (
              <div key={key} className="flex items-center justify-between border-b py-2 last:border-b-0">
                <span className="capitalize">{key}</span>
                <span className={String(health?.[key]).includes('degraded') ? 'text-destructive' : 'text-brand-green'}>
                  {health?.[key] || 'unknown'}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border bg-card p-4">
          <h3 className="font-semibold mb-3">Queues</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr><th className="py-2">Queue</th><th>Waiting</th><th>Active</th><th>Failed</th><th>Status</th></tr>
              </thead>
              <tbody>
                {queueRows.map((queue) => (
                  <tr key={queue.queueName} className="border-t">
                    <td className="py-2">{queue.queueName}</td>
                    <td>{queue.counts?.waiting ?? '-'}</td>
                    <td>{queue.counts?.active ?? '-'}</td>
                    <td>{queue.counts?.failed ?? '-'}</td>
                    <td className={queue.available ? 'text-brand-green' : 'text-destructive'}>{queue.available ? 'available' : 'degraded'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="rounded-lg border bg-card">
        <div className="flex flex-wrap gap-2 border-b p-3">
          {sections.map((section) => (
            <button
              key={section.key}
              onClick={() => setActive(section.key)}
              className={`px-3 py-2 rounded-md text-sm ${active === section.key ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'}`}
            >
              {section.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading operational records...</p>
          ) : records.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><AlertTriangle size={16} /> No records need attention.</div>
          ) : (
            <div className="space-y-3">
              {records.map((record) => (
                <div key={record._id} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{record.notificationKey || record.reconciliationKey || record.operationKey || record.idempotencyKey || record.eventId || record.bookingId || record._id}</p>
                      <p className="text-muted-foreground">
                        {record.status || record.reconciliationStatus || record.bookingStatus} - {record.operation || record.eventType || record.template || record.provider || record.paymentStatus || ''}
                      </p>
                      {(record.lastError || record.failureReason) && <p className="mt-1 text-destructive">{record.lastError || record.failureReason}</p>}
                    </div>
                    {sections.find((section) => section.key === active)?.retry && (
                      <button
                        disabled={actionId === record._id}
                        onClick={() => retryRecord(record)}
                        className="px-3 py-1.5 rounded-md border text-xs hover:bg-muted disabled:opacity-50"
                      >
                        {actionId === record._id ? 'Retrying...' : 'Retry'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {pagination && pagination.pages > 1 && (
            <div className="mt-4 flex items-center justify-end gap-2">
              <button disabled={page <= 1} onClick={() => loadRecords(page - 1)} className="px-3 py-1.5 rounded-md border text-sm disabled:opacity-50">Previous</button>
              <span className="text-sm text-muted-foreground">Page {page} of {pagination.pages}</span>
              <button disabled={page >= pagination.pages} onClick={() => loadRecords(page + 1)} className="px-3 py-1.5 rounded-md border text-sm disabled:opacity-50">Next</button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default AdminOperations;

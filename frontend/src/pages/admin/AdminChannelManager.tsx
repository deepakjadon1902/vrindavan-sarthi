import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Send } from 'lucide-react';
import { toast } from 'sonner';
import { api, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

const emptyMapping = {
  provider: 'ezee',
  entityType: 'hotel',
  internalEntityId: '',
  externalEntityId: '',
  externalCode: '',
};

const AdminChannelManager = () => {
  const token = useAuthStore((s) => s.token);
  const auth = useMemo(() => withAuth(token), [token]);
  const [mappings, setMappings] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [operations, setOperations] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [reconciliation, setReconciliation] = useState<any[]>([]);
  const [form, setForm] = useState(emptyMapping);
  const [connectionForm, setConnectionForm] = useState({ provider: 'ezee', hotelId: '', externalHotelId: '', enabled: false, environment: 'disabled' });
  const [syncForm, setSyncForm] = useState({ provider: 'ezee', roomTypeId: '', ratePlanId: '', from: '', to: '' });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const [mappingRes, connectionRes, operationRes, reservationRes, reconciliationRes] = await Promise.all([
      api.get('/channel/mappings', auth),
      api.get('/channel/connections', auth),
      api.get('/channel/operations', auth),
      api.get('/channel/reservations', auth),
      api.get('/channel/reconciliation', auth),
    ]);
    setMappings(Array.isArray(mappingRes.data?.data) ? mappingRes.data.data : []);
    setConnections(Array.isArray(connectionRes.data?.data) ? connectionRes.data.data : []);
    setOperations(Array.isArray(operationRes.data?.data) ? operationRes.data.data : []);
    setReservations(Array.isArray(reservationRes.data?.data) ? reservationRes.data.data : []);
    setReconciliation(Array.isArray(reconciliationRes.data?.data) ? reconciliationRes.data.data : []);
  }, [auth, token]);

  useEffect(() => {
    void load().catch(() => toast.error('Channel manager data could not be loaded'));
  }, [load]);

  const saveMapping = async () => {
    if (!token) return;
    setLoading(true);
    try {
      await api.post('/channel/mappings', form, auth);
      toast.success('Channel mapping saved');
      setForm(emptyMapping);
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Channel mapping could not be saved');
    } finally {
      setLoading(false);
    }
  };

  const requestSync = async (kind: 'inventory' | 'rates') => {
    if (!token) return;
    setLoading(true);
    try {
      const path = kind === 'inventory' ? '/channel/sync/inventory' : '/channel/sync/rates';
      const payload = kind === 'inventory'
        ? { provider: syncForm.provider, roomTypeId: syncForm.roomTypeId, from: syncForm.from, to: syncForm.to }
        : { provider: syncForm.provider, ratePlanId: syncForm.ratePlanId, from: syncForm.from, to: syncForm.to };
      await api.post(path, payload, auth);
      toast.success(`${kind === 'inventory' ? 'Inventory' : 'Rate'} sync queued`);
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Sync could not be queued');
    } finally {
      setLoading(false);
    }
  };

  const saveConnection = async () => {
    if (!token) return;
    setLoading(true);
    try {
      await api.post('/channel/connections', connectionForm, auth);
      toast.success('Channel connection saved');
      setConnectionForm({ provider: 'ezee', hotelId: '', externalHotelId: '', enabled: false, environment: 'disabled' });
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Channel connection could not be saved');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-semibold">Channel Manager</h2>
          <p className="text-sm text-muted-foreground">Provider mappings, sync requests, and external reservation intake.</p>
        </div>
        <button onClick={() => load()} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="font-semibold">Connection</h3>
          <div className="mt-3 grid gap-3">
            <input className="rounded-md border bg-background px-3 py-2 text-sm" value={connectionForm.provider} onChange={(e) => setConnectionForm({ ...connectionForm, provider: e.target.value })} placeholder="Provider" />
            <input className="rounded-md border bg-background px-3 py-2 text-sm" value={connectionForm.hotelId} onChange={(e) => setConnectionForm({ ...connectionForm, hotelId: e.target.value })} placeholder="Hotel ID" />
            <input className="rounded-md border bg-background px-3 py-2 text-sm" value={connectionForm.externalHotelId} onChange={(e) => setConnectionForm({ ...connectionForm, externalHotelId: e.target.value })} placeholder="External hotel ID" />
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={connectionForm.environment} onChange={(e) => setConnectionForm({ ...connectionForm, environment: e.target.value })}>
              <option value="disabled">Disabled</option>
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
            </select>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={connectionForm.enabled} onChange={(e) => setConnectionForm({ ...connectionForm, enabled: e.target.checked })} /> Enabled</label>
          </div>
          <button disabled={loading} onClick={saveConnection} className="mt-3 rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">Save connection</button>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h3 className="font-semibold">Mapping</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input className="rounded-md border bg-background px-3 py-2 text-sm" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="Provider" />
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={form.entityType} onChange={(e) => setForm({ ...form, entityType: e.target.value })}>
              <option value="hotel">Hotel</option>
              <option value="room_type">Room type</option>
              <option value="rate_plan">Rate plan</option>
            </select>
            <input className="rounded-md border bg-background px-3 py-2 text-sm md:col-span-2" value={form.internalEntityId} onChange={(e) => setForm({ ...form, internalEntityId: e.target.value })} placeholder="Internal entity ID" />
            <input className="rounded-md border bg-background px-3 py-2 text-sm" value={form.externalEntityId} onChange={(e) => setForm({ ...form, externalEntityId: e.target.value })} placeholder="External entity ID" />
            <input className="rounded-md border bg-background px-3 py-2 text-sm" value={form.externalCode} onChange={(e) => setForm({ ...form, externalCode: e.target.value })} placeholder="External code" />
          </div>
          <button disabled={loading} onClick={saveMapping} className="mt-3 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">
            <Send size={16} /> Save mapping
          </button>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h3 className="font-semibold">Manual Sync</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input className="rounded-md border bg-background px-3 py-2 text-sm" value={syncForm.provider} onChange={(e) => setSyncForm({ ...syncForm, provider: e.target.value })} placeholder="Provider" />
            <input className="rounded-md border bg-background px-3 py-2 text-sm" type="date" value={syncForm.from} onChange={(e) => setSyncForm({ ...syncForm, from: e.target.value })} />
            <input className="rounded-md border bg-background px-3 py-2 text-sm" type="date" value={syncForm.to} onChange={(e) => setSyncForm({ ...syncForm, to: e.target.value })} />
            <input className="rounded-md border bg-background px-3 py-2 text-sm" value={syncForm.roomTypeId} onChange={(e) => setSyncForm({ ...syncForm, roomTypeId: e.target.value })} placeholder="Room type ID" />
            <input className="rounded-md border bg-background px-3 py-2 text-sm md:col-span-2" value={syncForm.ratePlanId} onChange={(e) => setSyncForm({ ...syncForm, ratePlanId: e.target.value })} placeholder="Rate plan ID" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={loading} onClick={() => requestSync('inventory')} className="rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">Queue inventory sync</button>
            <button disabled={loading} onClick={() => requestSync('rates')} className="rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">Queue rate sync</button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h3 className="font-semibold">Connections</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr><th className="py-2">Provider</th><th>Hotel</th><th>External hotel</th><th>Status</th><th>Enabled</th></tr></thead>
            <tbody>{connections.map((row) => <tr key={row._id} className="border-t"><td className="py-2">{row.provider}</td><td>{row.hotelId}</td><td>{row.externalHotelId || '-'}</td><td>{row.status}</td><td>{row.enabled ? 'yes' : 'no'}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h3 className="font-semibold">Mappings</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr><th className="py-2">Provider</th><th>Type</th><th>Internal</th><th>External</th><th>Status</th></tr></thead>
            <tbody>{mappings.map((row) => <tr key={row._id} className="border-t"><td className="py-2">{row.provider}</td><td>{row.entityType}</td><td>{row.internalEntityId}</td><td>{row.externalEntityId}</td><td>{row.active ? 'active' : 'inactive'}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="font-semibold">Recent Operations</h3>
          <div className="mt-3 space-y-2">{operations.slice(0, 8).map((row) => <div key={row._id} className="rounded-md border p-3 text-sm"><p className="font-medium">{row.operation}</p><p className="text-muted-foreground">{row.status} - {row.idempotencyKey}</p></div>)}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h3 className="font-semibold">External Reservations</h3>
          <div className="mt-3 space-y-2">{reservations.slice(0, 8).map((row) => <div key={row._id} className="rounded-md border p-3 text-sm"><p className="font-medium">{row.externalReservationId}</p><p className="text-muted-foreground">{row.status} - {row.guestName || 'Guest'}</p></div>)}</div>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h3 className="font-semibold">Reconciliation</h3>
        <div className="mt-3 space-y-2">{reconciliation.slice(0, 8).map((row) => <div key={row._id} className="rounded-md border p-3 text-sm"><p className="font-medium">{row.reason}</p><p className="text-muted-foreground">{row.status} - {row.reconciliationKey}</p></div>)}</div>
      </section>
    </div>
  );
};

export default AdminChannelManager;

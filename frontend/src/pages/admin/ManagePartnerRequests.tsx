import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Eye, X, Hotel, BedDouble, Car, Map, Clock, User, Phone, Mail, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { api, withAuth } from '@/lib/api';
import axios from 'axios';
import { publishAppEvent } from '@/lib/broadcast';

const ManagePartnerRequests = () => {
  const token = useAuthStore((s) => s.token);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'hotel' | 'room' | 'cab' | 'tour'>('all');
  const [viewItem, setViewItem] = useState<any>(null);
  const [remarkText, setRemarkText] = useState('');
  const [allItems, setAllItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const getApiErrorMessage = (err: unknown, fallback: string) => {
    if (axios.isAxiosError(err)) {
      const msg = (err.response?.data as any)?.message;
      if (typeof msg === 'string') return msg;
      return err.message || fallback;
    }
    if (err instanceof Error) return err.message || fallback;
    return fallback;
  };

  const loadRequests = async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const res = await api.get('/partner/requests', withAuth(token));
      const data = res.data?.data || {};
      const hotels = (Array.isArray(data.hotels) ? data.hotels : []).map((i: any) => ({ ...i, id: i._id || i.id, itemType: 'hotel' }));
      const rooms = (Array.isArray(data.rooms) ? data.rooms : []).map((i: any) => ({ ...i, id: i._id || i.id, itemType: 'room' }));
      const cabs = (Array.isArray(data.cabs) ? data.cabs : []).map((i: any) => ({ ...i, id: i._id || i.id, itemType: 'cab' }));
      const tours = (Array.isArray(data.tours) ? data.tours : []).map((i: any) => ({ ...i, id: i._id || i.id, itemType: 'tour' }));
      const all = [...hotels, ...rooms, ...cabs, ...tours].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAllItems(all);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to load partner requests'));
      setAllItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filteredByType = typeFilter === 'all' ? allItems : allItems.filter(i => i.itemType === typeFilter);
  const filtered = filter === 'all' ? filteredByType : filteredByType.filter(i => i.approvalStatus === filter);

  const updateStatus = async (item: any, status: 'approved' | 'rejected', remarks: string = '') => {
    if (!token) return;
    const url =
      item.itemType === 'hotel'
        ? `/partner/hotels/${item.id}/status`
        : item.itemType === 'room'
          ? `/partner/rooms/${item.id}/status`
          : item.itemType === 'cab'
            ? `/partner/cabs/${item.id}/status`
            : `/partner/tours/${item.id}/status`;
    try {
      const res = await api.put(url, { approvalStatus: status, adminRemarks: remarks }, withAuth(token));
      const updated = res.data?.data;
      setAllItems((prev) =>
        prev.map((p) => (p.id === item.id && p.itemType === item.itemType ? { ...p, ...updated, id: updated?._id || p.id, itemType: p.itemType } : p))
      );
      toast.success(`${item.itemType} ${status}`);
      publishAppEvent('listing:changed');
      setViewItem(null);
      setRemarkText('');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Update failed'));
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'approved') return 'bg-brand-green/10 text-brand-green';
    if (status === 'rejected') return 'bg-destructive/10 text-destructive';
    return 'bg-brand-saffron/10 text-brand-saffron';
  };

  const typeIcon = (type: string) => {
    if (type === 'hotel') return <Hotel size={16} className="text-brand-gold" />;
    if (type === 'room') return <BedDouble size={16} className="text-brand-saffron" />;
    if (type === 'cab') return <Car size={16} className="text-brand-green" />;
    return <Map size={16} className="text-brand-crimson" />;
  };

  const getItemName = (item: any) => item.name || item.vehicleName || 'Unnamed';
  const getItemPrice = (item: any) => {
    if (item.pricePerNight) return `₹${item.pricePerNight}/night`;
    if (item.basePrice) return `₹${item.basePrice}`;
    if (item.pricePerPerson) return `₹${item.pricePerPerson}/person`;
    return '-';
  };

  const pendingCount = allItems.filter(i => i.approvalStatus === 'pending').length;

  return (
    <div className="space-y-6">
      {pendingCount > 0 && (
        <div className="bg-brand-saffron/10 border border-brand-saffron/30 rounded-xl p-4 flex items-center gap-3">
          <Clock size={20} className="text-brand-saffron" />
          <p className="font-body text-sm text-foreground"><strong>{pendingCount}</strong> listing(s) awaiting your approval</p>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {(['all', 'hotel', 'room', 'cab', 'tour'] as const).map(f => (
          <button key={f} onClick={() => setTypeFilter(f)} className={`px-3 py-1.5 rounded-lg font-body text-xs capitalize transition-colors ${typeFilter === f ? 'bg-brand-gold text-foreground' : 'bg-card border border-border hover:bg-muted'}`}>
            {f === 'all' ? 'All Types' : `${f}s`}
          </button>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg font-body text-sm capitalize transition-colors ${filter === f ? 'bg-brand-crimson text-primary-foreground' : 'bg-card border border-border hover:bg-muted'}`}>
            {f} ({f === 'all' ? filteredByType.length : filteredByType.filter(i => i.approvalStatus === f).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Building2 size={48} className="mx-auto mb-4 text-muted-foreground/30" />
          <p className="font-body text-muted-foreground">No {filter === 'all' ? 'partner' : filter} requests</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Type</th>
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Name</th>
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden sm:table-cell">Partner</th>
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden md:table-cell">Business</th>
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Price</th>
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Status</th>
              <th className="text-right px-4 py-3 font-body text-xs font-medium text-muted-foreground">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">{typeIcon(item.itemType)}</td>
                  <td className="px-4 py-3 font-body text-sm font-medium text-foreground">{getItemName(item)}</td>
                  <td className="px-4 py-3 font-body text-sm text-muted-foreground hidden sm:table-cell">{item.partnerName}</td>
                  <td className="px-4 py-3 font-body text-sm text-muted-foreground hidden md:table-cell">{item.businessName || '-'}</td>
                  <td className="px-4 py-3 font-body text-sm text-foreground">{getItemPrice(item)}</td>
                  <td className="px-4 py-3"><span className={`font-body text-xs px-2 py-1 rounded-full ${statusBadge(item.approvalStatus)}`}>{item.approvalStatus}</span></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setViewItem(item); setRemarkText(item.adminRemarks || ''); }} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"><Eye size={14} /></button>
                      {item.approvalStatus !== 'approved' && (
                        <button onClick={() => updateStatus(item, 'approved')} className="p-1.5 rounded hover:bg-brand-green/10 transition-colors text-muted-foreground hover:text-brand-green" title="Approve"><CheckCircle size={14} /></button>
                      )}
                      {item.approvalStatus !== 'rejected' && (
                        <button onClick={() => { setViewItem(item); setRemarkText(''); }} className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive" title="Reject"><XCircle size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewItem && (
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-heading text-lg font-semibold">Listing Details — <span className="capitalize">{viewItem.itemType}</span></h3>
            <button onClick={() => setViewItem(null)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              {viewItem.image && viewItem.image !== '/placeholder.svg' && (
                <img src={viewItem.image} alt={getItemName(viewItem)} className="w-full h-48 object-cover rounded-lg mb-3" />
              )}
              {viewItem.images && viewItem.images.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {viewItem.images.map((img: string, i: number) => (
                    <img key={i} src={img} className="w-20 h-14 object-cover rounded" />
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3 font-body text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground block text-xs">Type</span><span className="font-medium capitalize">{viewItem.itemType}</span></div>
                <div><span className="text-muted-foreground block text-xs">Status</span><span className={`px-2 py-0.5 rounded-full text-xs ${statusBadge(viewItem.approvalStatus)}`}>{viewItem.approvalStatus}</span></div>
                <div><span className="text-muted-foreground block text-xs">Price</span><span className="font-medium">{getItemPrice(viewItem)}</span></div>
                {viewItem.location && <div><span className="text-muted-foreground block text-xs">Location</span><span>{viewItem.location}</span></div>}
                {viewItem.vehicleType && <div><span className="text-muted-foreground block text-xs">Vehicle Type</span><span>{viewItem.vehicleType}</span></div>}
                {viewItem.vehicleNumber && <div><span className="text-muted-foreground block text-xs">Vehicle No.</span><span>{viewItem.vehicleNumber}</span></div>}
                {viewItem.driverName && <div><span className="text-muted-foreground block text-xs">Driver</span><span>{viewItem.driverName} ({viewItem.driverPhone})</span></div>}
                {viewItem.duration && <div><span className="text-muted-foreground block text-xs">Duration</span><span>{viewItem.duration}</span></div>}
                {viewItem.groupSize && <div><span className="text-muted-foreground block text-xs">Group Size</span><span>Max {viewItem.groupSize}</span></div>}
              </div>

              {viewItem.description && <div><span className="text-muted-foreground block text-xs mb-1">Description</span><p className="text-foreground">{viewItem.description}</p></div>}
              {viewItem.amenities?.length > 0 && <div><span className="text-muted-foreground block text-xs mb-1">Amenities</span><div className="flex flex-wrap gap-1">{viewItem.amenities.map((a: string, i: number) => <span key={i} className="bg-muted px-2 py-0.5 rounded text-xs">{a}</span>)}</div></div>}
              {viewItem.features?.length > 0 && <div><span className="text-muted-foreground block text-xs mb-1">Features</span><div className="flex flex-wrap gap-1">{viewItem.features.map((a: string, i: number) => <span key={i} className="bg-muted px-2 py-0.5 rounded text-xs">{a}</span>)}</div></div>}
              {viewItem.includes?.length > 0 && <div><span className="text-muted-foreground block text-xs mb-1">Includes</span><div className="flex flex-wrap gap-1">{viewItem.includes.map((a: string, i: number) => <span key={i} className="bg-brand-green/10 px-2 py-0.5 rounded text-xs text-brand-green">{a}</span>)}</div></div>}

              <div className="border-t border-border pt-3 mt-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">PARTNER DETAILS</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2"><User size={12} className="text-muted-foreground" /><span>{viewItem.partnerName}</span></div>
                  <div className="flex items-center gap-2"><Mail size={12} className="text-muted-foreground" /><span>{viewItem.partnerEmail}</span></div>
                  {viewItem.partnerPhone && <div className="flex items-center gap-2"><Phone size={12} className="text-muted-foreground" /><span>{viewItem.partnerPhone}</span></div>}
                  {viewItem.businessName && <div className="flex items-center gap-2"><Building2 size={12} className="text-muted-foreground" /><span>{viewItem.businessName}</span></div>}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <div className="mb-3">
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Admin Remarks (optional)</label>
              <textarea rows={2} value={remarkText} onChange={(e) => setRemarkText(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none" placeholder="Add remarks for the partner..." />
            </div>
            <div className="flex gap-3">
              {viewItem.approvalStatus !== 'approved' && (
                <button onClick={() => updateStatus(viewItem, 'approved', remarkText)} className="px-5 py-2.5 rounded-lg text-sm font-body bg-brand-green text-primary-foreground hover:bg-brand-green/90 flex items-center gap-2">
                  <CheckCircle size={14} /> Approve & Add to Main Site
                </button>
              )}
              {viewItem.approvalStatus !== 'rejected' && (
                <button onClick={() => updateStatus(viewItem, 'rejected', remarkText)} className="px-5 py-2.5 rounded-lg text-sm font-body bg-destructive text-primary-foreground hover:bg-destructive/90 flex items-center gap-2">
                  <XCircle size={14} /> Reject
                </button>
              )}
              <button onClick={() => setViewItem(null)} className="px-5 py-2.5 rounded-lg text-sm border border-border font-body hover:bg-muted transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagePartnerRequests;

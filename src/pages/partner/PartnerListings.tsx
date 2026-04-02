import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { Hotel, BedDouble, CheckCircle, Clock, XCircle, Eye } from 'lucide-react';

const PartnerListings = () => {
  const { user } = useAuthStore();
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [viewItem, setViewItem] = useState<any>(null);

  const getItems = (key: string) => {
    try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : []; } catch { return []; }
  };

  const hotels = getItems('vvs_partner_hotels').filter((i: any) => i.partnerId === user?.id).map((i: any) => ({ ...i, itemType: 'hotel' }));
  const rooms = getItems('vvs_partner_rooms').filter((i: any) => i.partnerId === user?.id).map((i: any) => ({ ...i, itemType: 'room' }));
  const allItems = [...hotels, ...rooms];

  const filtered = filter === 'all' ? allItems : allItems.filter(i => i.approvalStatus === filter);

  const statusIcon = (status: string) => {
    if (status === 'approved') return <CheckCircle size={14} className="text-brand-green" />;
    if (status === 'rejected') return <XCircle size={14} className="text-destructive" />;
    return <Clock size={14} className="text-brand-saffron" />;
  };

  const statusBadge = (status: string) => {
    if (status === 'approved') return 'bg-brand-green/10 text-brand-green';
    if (status === 'rejected') return 'bg-destructive/10 text-destructive';
    return 'bg-brand-saffron/10 text-brand-saffron';
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg font-body text-sm capitalize transition-colors ${filter === f ? 'bg-brand-crimson text-primary-foreground' : 'bg-card border border-border hover:bg-muted'}`}>
            {f} ({f === 'all' ? allItems.length : allItems.filter(i => i.approvalStatus === f).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="font-body text-muted-foreground">No {filter === 'all' ? '' : filter} listings found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div key={item.id} className="bg-card rounded-xl border border-border p-4 flex items-center gap-4">
              <div className="w-16 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
                {item.image && item.image !== '/placeholder.svg' ? <img src={item.image} className="w-full h-full object-cover" /> : (
                  <div className="w-full h-full flex items-center justify-center">{item.itemType === 'hotel' ? <Hotel size={16} className="text-muted-foreground" /> : <BedDouble size={16} className="text-muted-foreground" />}</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-body text-sm font-medium text-foreground truncate">{item.name}</p>
                  <span className={`font-body text-[10px] px-2 py-0.5 rounded-full ${statusBadge(item.approvalStatus)}`}>{item.approvalStatus}</span>
                </div>
                <p className="font-body text-xs text-muted-foreground">{item.itemType === 'hotel' ? `Hotel • ${item.location}` : `Room • ${item.hotelName}`}</p>
                {item.adminRemarks && (
                  <p className="font-body text-xs text-destructive mt-1">Admin: {item.adminRemarks}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-body text-sm font-medium text-foreground">₹{item.pricePerNight}/night</span>
                <button onClick={() => setViewItem(viewItem?.id === item.id ? null : item)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"><Eye size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewItem && (
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-lg font-semibold">{viewItem.name}</h3>
            <button onClick={() => setViewItem(null)} className="text-muted-foreground hover:text-foreground text-sm font-body">Close</button>
          </div>
          <div className="grid grid-cols-2 gap-4 font-body text-sm">
            <div><span className="text-muted-foreground">Type:</span> <span className="text-foreground">{viewItem.itemType}</span></div>
            <div><span className="text-muted-foreground">Status:</span> <span className={`px-2 py-0.5 rounded-full text-xs ${statusBadge(viewItem.approvalStatus)}`}>{viewItem.approvalStatus}</span></div>
            <div><span className="text-muted-foreground">Price/Night:</span> <span className="text-foreground">₹{viewItem.pricePerNight}</span></div>
            <div><span className="text-muted-foreground">Submitted:</span> <span className="text-foreground">{new Date(viewItem.createdAt).toLocaleDateString()}</span></div>
            {viewItem.description && <div className="col-span-2"><span className="text-muted-foreground">Description:</span> <p className="text-foreground mt-1">{viewItem.description}</p></div>}
            {viewItem.adminRemarks && <div className="col-span-2 bg-destructive/5 p-3 rounded-lg"><span className="text-destructive font-medium">Admin Remarks:</span> <p className="text-foreground mt-1">{viewItem.adminRemarks}</p></div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerListings;

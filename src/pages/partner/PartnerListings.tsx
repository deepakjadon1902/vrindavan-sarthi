import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Hotel, BedDouble, Car, Map, Eye, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const STORAGE_KEYS: Record<string, string> = {
  hotel: 'vvs_partner_hotels',
  room: 'vvs_partner_rooms',
  cab: 'vvs_partner_cabs',
  tour: 'vvs_partner_tours',
};
const MAIN_KEYS: Record<string, string> = {
  hotel: 'vvs_hotels',
  room: 'vvs_rooms',
  cab: 'vvs_cabs',
  tour: 'vvs_tours',
};
const ADD_ROUTES: Record<string, string> = {
  hotel: '/partner/hotels',
  room: '/partner/rooms',
  cab: '/partner/cabs',
  tour: '/partner/tours',
};

const getItems = (key: string): any[] => {
  try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : []; } catch { return []; }
};

const PartnerListings = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'hotel' | 'room' | 'cab' | 'tour'>('all');
  const [viewItem, setViewItem] = useState<any>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [, setRefresh] = useState(0);

  const hotels = getItems(STORAGE_KEYS.hotel).filter((i: any) => i.partnerId === user?.id).map((i: any) => ({ ...i, itemType: 'hotel' }));
  const rooms = getItems(STORAGE_KEYS.room).filter((i: any) => i.partnerId === user?.id).map((i: any) => ({ ...i, itemType: 'room' }));
  const cabs = getItems(STORAGE_KEYS.cab).filter((i: any) => i.partnerId === user?.id).map((i: any) => ({ ...i, itemType: 'cab' }));
  const tours = getItems(STORAGE_KEYS.tour).filter((i: any) => i.partnerId === user?.id).map((i: any) => ({ ...i, itemType: 'tour' }));
  const allItems = [...hotels, ...rooms, ...cabs, ...tours];

  const filteredByType = typeFilter === 'all' ? allItems : allItems.filter(i => i.itemType === typeFilter);
  const filtered = filter === 'all' ? filteredByType : filteredByType.filter(i => i.approvalStatus === filter);

  const statusBadge = (status: string) => {
    if (status === 'approved') return 'bg-brand-green/10 text-brand-green';
    if (status === 'rejected') return 'bg-destructive/10 text-destructive';
    return 'bg-brand-saffron/10 text-brand-saffron';
  };

  const typeIcon = (type: string) => {
    if (type === 'hotel') return <Hotel size={14} className="text-brand-gold" />;
    if (type === 'room') return <BedDouble size={14} className="text-brand-saffron" />;
    if (type === 'cab') return <Car size={14} className="text-brand-green" />;
    return <Map size={14} className="text-brand-crimson" />;
  };

  const getItemName = (item: any) => item.name || item.vehicleName || 'Unnamed';
  const getItemPrice = (item: any) => {
    if (item.pricePerNight) return `₹${item.pricePerNight}/night`;
    if (item.basePrice) return `₹${item.basePrice}`;
    if (item.pricePerPerson) return `₹${item.pricePerPerson}/person`;
    return '-';
  };

  const handleEdit = (item: any) => {
    navigate(`${ADD_ROUTES[item.itemType]}?edit=${item.id}`);
  };

  const handleDelete = (item: any) => {
    const key = STORAGE_KEYS[item.itemType];
    const mainKey = MAIN_KEYS[item.itemType];
    const updated = getItems(key).filter((i: any) => i.id !== item.id);
    localStorage.setItem(key, JSON.stringify(updated));
    const updatedMain = getItems(mainKey).filter((i: any) => i.id !== item.id);
    localStorage.setItem(mainKey, JSON.stringify(updatedMain));
    setConfirmDeleteId(null);
    setRefresh(r => r + 1);
    toast.success(`${item.itemType.charAt(0).toUpperCase() + item.itemType.slice(1)} deleted`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold text-foreground">All My Listings</h2>
        <p className="font-body text-xs text-muted-foreground">Manage every hotel, room, cab and tour you've listed in one place. Editing an approved listing will send it back for admin re-approval.</p>
      </div>

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
          <p className="font-body text-muted-foreground">No {filter === 'all' ? '' : filter} listings found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div key={item.id} className="bg-card rounded-xl border border-border p-4 flex flex-wrap items-center gap-4">
              <div className="w-16 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
                {item.image && item.image !== '/placeholder.svg' ? <img src={item.image} alt="" className="w-full h-full object-cover" /> : (
                  <div className="w-full h-full flex items-center justify-center">{typeIcon(item.itemType)}</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {typeIcon(item.itemType)}
                  <p className="font-body text-sm font-medium text-foreground truncate">{getItemName(item)}</p>
                  <span className={`font-body text-[10px] px-2 py-0.5 rounded-full ${statusBadge(item.approvalStatus)}`}>{item.approvalStatus}</span>
                  {item.images?.length > 0 && (
                    <span className="font-body text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{1 + item.images.length} photos</span>
                  )}
                </div>
                <p className="font-body text-xs text-muted-foreground capitalize">{item.itemType} • {item.location || item.vehicleType || item.duration || ''}</p>
                {item.adminRemarks && (
                  <p className="font-body text-xs text-destructive mt-1">Admin: {item.adminRemarks}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-body text-sm font-medium text-foreground">{getItemPrice(item)}</span>
                <button onClick={() => setViewItem(viewItem?.id === item.id ? null : item)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="View"><Eye size={14} /></button>
                <button onClick={() => handleEdit(item)} className="p-1.5 rounded hover:bg-brand-gold/10 transition-colors text-muted-foreground hover:text-brand-gold" title="Edit"><Pencil size={14} /></button>
                {confirmDeleteId === item.id ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleDelete(item)} className="text-xs font-body text-destructive hover:underline">Confirm</button>
                    <button onClick={() => setConfirmDeleteId(null)} className="text-xs font-body text-muted-foreground hover:underline">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteId(item.id)} className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive" title="Delete"><Trash2 size={14} /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewItem && (
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-lg font-semibold">{getItemName(viewItem)}</h3>
            <div className="flex items-center gap-2">
              <button onClick={() => handleEdit(viewItem)} className="px-3 py-1.5 rounded-lg text-xs font-body border border-brand-gold text-brand-gold hover:bg-brand-gold/10 flex items-center gap-1"><Pencil size={12} /> Edit</button>
              <button onClick={() => setViewItem(null)} className="text-muted-foreground hover:text-foreground text-sm font-body">Close</button>
            </div>
          </div>
          {viewItem.images?.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-4">
              {viewItem.image && <img src={viewItem.image} alt="" className="w-24 h-16 rounded object-cover border border-border" />}
              {viewItem.images.map((img: string, i: number) => (
                <img key={i} src={img} alt="" className="w-24 h-16 rounded object-cover border border-border" />
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 font-body text-sm">
            <div><span className="text-muted-foreground">Type:</span> <span className="text-foreground capitalize">{viewItem.itemType}</span></div>
            <div><span className="text-muted-foreground">Status:</span> <span className={`px-2 py-0.5 rounded-full text-xs ${statusBadge(viewItem.approvalStatus)}`}>{viewItem.approvalStatus}</span></div>
            <div><span className="text-muted-foreground">Price:</span> <span className="text-foreground">{getItemPrice(viewItem)}</span></div>
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

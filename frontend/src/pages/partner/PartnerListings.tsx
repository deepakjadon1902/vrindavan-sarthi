import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { api, withAuth } from '@/lib/api';
import { Hotel, BedDouble, Car, Map, Eye, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { publishAppEvent } from '@/lib/broadcast';

type ItemType = 'hotel' | 'room' | 'cab' | 'tour';

const ADD_ROUTES: Record<ItemType, string> = {
  hotel: '/partner/hotels',
  room: '/partner/rooms',
  cab: '/partner/cabs',
  tour: '/partner/tours',
};

const PartnerListings = () => {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ItemType>('all');
  const [viewItem, setViewItem] = useState<any>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [allItems, setAllItems] = useState<any[]>([]);

  const load = async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const res = await api.get('/partner/my-listings', withAuth(token));
      const data = res.data?.data || {};
      const hotels = (Array.isArray(data.hotels) ? data.hotels : []).map((i: any) => ({ ...i, id: i._id, itemType: 'hotel' as const }));
      const rooms = (Array.isArray(data.rooms) ? data.rooms : []).map((i: any) => ({ ...i, id: i._id, itemType: 'room' as const }));
      const cabs = (Array.isArray(data.cabs) ? data.cabs : []).map((i: any) => ({ ...i, id: i._id, itemType: 'cab' as const }));
      const tours = (Array.isArray(data.tours) ? data.tours : []).map((i: any) => ({ ...i, id: i._id, itemType: 'tour' as const }));
      const all = [...hotels, ...rooms, ...cabs, ...tours].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAllItems(all);
    } catch {
      toast.error('Failed to load listings');
      setAllItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filteredByType = typeFilter === 'all' ? allItems : allItems.filter((i) => i.itemType === typeFilter);
  const filtered = filter === 'all' ? filteredByType : filteredByType.filter((i) => i.approvalStatus === filter);

  const statusBadge = (status: string) => {
    if (status === 'approved') return 'bg-brand-green/10 text-brand-green';
    if (status === 'rejected') return 'bg-destructive/10 text-destructive';
    return 'bg-brand-saffron/10 text-brand-saffron';
  };

  const typeIcon = (type: ItemType) => {
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

  const handleDelete = async (item: any) => {
    if (!token) return;
    const url =
      item.itemType === 'hotel'
        ? `/partner/hotels/${item.id}`
        : item.itemType === 'room'
          ? `/partner/rooms/${item.id}`
          : item.itemType === 'cab'
            ? `/partner/cabs/${item.id}`
            : `/partner/tours/${item.id}`;
    try {
      await api.delete(url, withAuth(token));
      setAllItems((prev) => prev.filter((x) => !(x.id === item.id && x.itemType === item.itemType)));
      toast.success('Deleted');
      publishAppEvent('listing:changed');
    } catch {
      toast.error('Delete failed');
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const pendingCount = allItems.filter((i) => i.approvalStatus === 'pending').length;

  const viewImages = useMemo(() => {
    if (!viewItem) return [];
    return [viewItem.image, ...(viewItem.images || [])].filter(Boolean);
  }, [viewItem]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold text-foreground">All My Listings</h2>
        <p className="font-body text-xs text-muted-foreground">
          Manage every hotel, room, cab and tour you&apos;ve listed in one place.
        </p>
      </div>

      {pendingCount > 0 && (
        <div className="bg-brand-saffron/10 border border-brand-saffron/30 rounded-xl p-4">
          <p className="font-body text-sm text-foreground">
            {pendingCount} listing(s) pending admin approval.
          </p>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {(['all', 'hotel', 'room', 'cab', 'tour'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setTypeFilter(f)}
            className={`px-3 py-1.5 rounded-lg font-body text-xs capitalize transition-colors ${
              typeFilter === f ? 'bg-brand-gold text-foreground' : 'bg-card border border-border hover:bg-muted'
            }`}
          >
            {f === 'all' ? 'All Types' : `${f}s`}
          </button>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg font-body text-sm capitalize transition-colors ${
              filter === f ? 'bg-brand-crimson text-primary-foreground' : 'bg-card border border-border hover:bg-muted'
            }`}
          >
            {f} ({f === 'all' ? filteredByType.length : filteredByType.filter((i) => i.approvalStatus === f).length})
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="font-body text-sm text-muted-foreground">Loading…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="font-heading text-xl text-foreground mb-2">No Listings</p>
          <p className="font-body text-sm text-muted-foreground">Create your first listing from the sidebar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div key={`${item.itemType}-${item.id}`} className="bg-card rounded-xl border border-border p-4 flex gap-3 items-center">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                {typeIcon(item.itemType)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {typeIcon(item.itemType)}
                  <p className="font-body text-sm font-medium text-foreground truncate">{getItemName(item)}</p>
                  <span className={`font-body text-[10px] px-2 py-0.5 rounded-full ${statusBadge(item.approvalStatus)}`}>
                    {item.approvalStatus}
                  </span>
                </div>
                <p className="font-body text-xs text-muted-foreground capitalize">
                  {item.itemType} • {item.location || item.hotelName || item.vehicleType || item.duration || ''}
                </p>
                {item.adminRemarks && (
                  <p className="font-body text-xs text-destructive mt-1">Admin: {item.adminRemarks}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-body text-sm font-medium text-foreground">{getItemPrice(item)}</span>
                <button
                  onClick={() => setViewItem(viewItem?.id === item.id && viewItem?.itemType === item.itemType ? null : item)}
                  className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  title="View"
                >
                  <Eye size={14} />
                </button>
                <button
                  onClick={() => handleEdit(item)}
                  className="p-1.5 rounded hover:bg-brand-gold/10 transition-colors text-muted-foreground hover:text-brand-gold"
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
                {confirmDeleteId === item.id ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleDelete(item)} className="text-xs font-body text-destructive hover:underline">
                      Confirm
                    </button>
                    <button onClick={() => setConfirmDeleteId(null)} className="text-xs font-body text-muted-foreground hover:underline">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(item.id)}
                    className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
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
              <button
                onClick={() => handleEdit(viewItem)}
                className="px-3 py-1.5 rounded-lg text-xs font-body border border-brand-gold text-brand-gold hover:bg-brand-gold/10 flex items-center gap-1"
              >
                <Pencil size={12} /> Edit
              </button>
              <button onClick={() => setViewItem(null)} className="text-muted-foreground hover:text-foreground text-sm font-body">
                Close
              </button>
            </div>
          </div>

          {viewImages.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-4">
              {viewImages.map((img: string, i: number) => (
                <img key={i} src={img} alt="" className="w-24 h-16 rounded object-cover border border-border" />
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 font-body text-sm">
            <div>
              <span className="text-muted-foreground">Type:</span> <span className="text-foreground capitalize">{viewItem.itemType}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>{' '}
              <span className={`px-2 py-0.5 rounded-full text-xs ${statusBadge(viewItem.approvalStatus)}`}>{viewItem.approvalStatus}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Price:</span> <span className="text-foreground">{getItemPrice(viewItem)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Submitted:</span>{' '}
              <span className="text-foreground">{new Date(viewItem.createdAt).toLocaleDateString()}</span>
            </div>
            {viewItem.description && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Description:</span>
                <p className="text-foreground mt-1">{viewItem.description}</p>
              </div>
            )}
            {viewItem.adminRemarks && (
              <div className="col-span-2 bg-destructive/5 p-3 rounded-lg">
                <span className="text-destructive font-medium">Admin Remarks:</span>
                <p className="text-foreground mt-1">{viewItem.adminRemarks}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerListings;

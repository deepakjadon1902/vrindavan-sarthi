import { useState } from 'react';
import { CheckCircle, XCircle, Eye, X, Hotel, BedDouble, Clock, User, Phone, Mail, Building2 } from 'lucide-react';
import { toast } from 'sonner';

const ManagePartnerRequests = () => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [viewItem, setViewItem] = useState<any>(null);
  const [remarkText, setRemarkText] = useState('');
  const [, setRefresh] = useState(0);

  const getItems = (key: string) => {
    try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : []; } catch { return []; }
  };

  const hotels = getItems('vvs_partner_hotels').map((i: any) => ({ ...i, itemType: 'hotel' }));
  const rooms = getItems('vvs_partner_rooms').map((i: any) => ({ ...i, itemType: 'room' }));
  const allItems = [...hotels, ...rooms].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filtered = filter === 'all' ? allItems : allItems.filter(i => i.approvalStatus === filter);

  const updateStatus = (item: any, status: 'approved' | 'rejected', remarks: string = '') => {
    const key = item.itemType === 'hotel' ? 'vvs_partner_hotels' : 'vvs_partner_rooms';
    const items = getItems(key);
    const updated = items.map((i: any) => i.id === item.id ? { ...i, approvalStatus: status, adminRemarks: remarks } : i);
    localStorage.setItem(key, JSON.stringify(updated));

    // If approved, also add to main listings
    if (status === 'approved') {
      if (item.itemType === 'hotel') {
        const mainHotels = getItems('vvs_hotels');
        const exists = mainHotels.find((h: any) => h.id === item.id);
        if (!exists) {
          mainHotels.push({
            id: item.id,
            name: item.name,
            location: item.location,
            pricePerNight: item.pricePerNight,
            rating: item.rating || 0,
            image: item.image,
            description: item.description,
            amenities: item.amenities,
            status: 'active',
            partnerSubmitted: true,
            partnerId: item.partnerId,
            partnerName: item.partnerName,
          });
          localStorage.setItem('vvs_hotels', JSON.stringify(mainHotels));
        }
      } else {
        const mainRooms = getItems('vvs_rooms');
        const exists = mainRooms.find((r: any) => r.id === item.id);
        if (!exists) {
          mainRooms.push({
            id: item.id,
            name: item.name,
            hotelName: item.hotelName,
            type: item.type,
            pricePerNight: item.pricePerNight,
            pricePerBed: item.pricePerBed,
            capacity: item.capacity,
            isAC: item.isAC,
            image: item.image,
            amenities: item.amenities,
            status: 'available',
            partnerSubmitted: true,
            partnerId: item.partnerId,
            partnerName: item.partnerName,
          });
          localStorage.setItem('vvs_rooms', JSON.stringify(mainRooms));
        }
      }
      toast.success(`${item.itemType === 'hotel' ? 'Hotel' : 'Room'} approved & added to main listings`);
    } else {
      // If rejected, remove from main listings if previously approved
      if (item.itemType === 'hotel') {
        const mainHotels = getItems('vvs_hotels').filter((h: any) => h.id !== item.id);
        localStorage.setItem('vvs_hotels', JSON.stringify(mainHotels));
      } else {
        const mainRooms = getItems('vvs_rooms').filter((r: any) => r.id !== item.id);
        localStorage.setItem('vvs_rooms', JSON.stringify(mainRooms));
      }
      toast.success(`${item.itemType === 'hotel' ? 'Hotel' : 'Room'} rejected`);
    }

    setViewItem(null);
    setRemarkText('');
    setRefresh(r => r + 1);
  };

  const statusBadge = (status: string) => {
    if (status === 'approved') return 'bg-brand-green/10 text-brand-green';
    if (status === 'rejected') return 'bg-destructive/10 text-destructive';
    return 'bg-brand-saffron/10 text-brand-saffron';
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
        {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg font-body text-sm capitalize transition-colors ${filter === f ? 'bg-brand-crimson text-primary-foreground' : 'bg-card border border-border hover:bg-muted'}`}>
            {f} ({f === 'all' ? allItems.length : allItems.filter(i => i.approvalStatus === f).length})
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
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">₹/Night</th>
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden lg:table-cell">Submitted</th>
              <th className="text-right px-4 py-3 font-body text-xs font-medium text-muted-foreground">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">{item.itemType === 'hotel' ? <Hotel size={16} className="text-brand-gold" /> : <BedDouble size={16} className="text-brand-saffron" />}</td>
                  <td className="px-4 py-3 font-body text-sm font-medium text-foreground">{item.name}</td>
                  <td className="px-4 py-3 font-body text-sm text-muted-foreground hidden sm:table-cell">{item.partnerName}</td>
                  <td className="px-4 py-3 font-body text-sm text-muted-foreground hidden md:table-cell">{item.businessName || '-'}</td>
                  <td className="px-4 py-3 font-body text-sm text-foreground">₹{item.pricePerNight}</td>
                  <td className="px-4 py-3"><span className={`font-body text-xs px-2 py-1 rounded-full ${statusBadge(item.approvalStatus)}`}>{item.approvalStatus}</span></td>
                  <td className="px-4 py-3 font-body text-xs text-muted-foreground hidden lg:table-cell">{new Date(item.createdAt).toLocaleDateString()}</td>
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

      {/* Detail Panel */}
      {viewItem && (
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-heading text-lg font-semibold">Listing Details</h3>
            <button onClick={() => setViewItem(null)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Images */}
            <div>
              {viewItem.image && viewItem.image !== '/placeholder.svg' && (
                <img src={viewItem.image} alt={viewItem.name} className="w-full h-48 object-cover rounded-lg mb-3" />
              )}
              {viewItem.images && viewItem.images.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {viewItem.images.map((img: string, i: number) => (
                    <img key={i} src={img} className="w-20 h-14 object-cover rounded" />
                  ))}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="space-y-3 font-body text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground block text-xs">Type</span><span className="font-medium capitalize">{viewItem.itemType}</span></div>
                <div><span className="text-muted-foreground block text-xs">Status</span><span className={`px-2 py-0.5 rounded-full text-xs ${statusBadge(viewItem.approvalStatus)}`}>{viewItem.approvalStatus}</span></div>
                <div><span className="text-muted-foreground block text-xs">Price/Night</span><span className="font-medium">₹{viewItem.pricePerNight}</span></div>
                {viewItem.pricePerBed > 0 && <div><span className="text-muted-foreground block text-xs">Price/Bed</span><span className="font-medium">₹{viewItem.pricePerBed}</span></div>}
                {viewItem.location && <div><span className="text-muted-foreground block text-xs">Location</span><span>{viewItem.location}</span></div>}
                {viewItem.totalRooms && <div><span className="text-muted-foreground block text-xs">Total Rooms</span><span>{viewItem.totalRooms}</span></div>}
              </div>

              {viewItem.description && <div><span className="text-muted-foreground block text-xs mb-1">Description</span><p className="text-foreground">{viewItem.description}</p></div>}
              {viewItem.amenities?.length > 0 && <div><span className="text-muted-foreground block text-xs mb-1">Amenities</span><div className="flex flex-wrap gap-1">{viewItem.amenities.map((a: string, i: number) => <span key={i} className="bg-muted px-2 py-0.5 rounded text-xs">{a}</span>)}</div></div>}

              {/* Partner Info */}
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

          {/* Actions */}
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

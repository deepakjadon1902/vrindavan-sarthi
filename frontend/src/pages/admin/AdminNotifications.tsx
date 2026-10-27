import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Megaphone,
  Search,
  Send,
  Building2,
  User,
  Radio,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, withAuth } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAuthStore } from '@/store/authStore';
import RecordPagination, { useRecordPagination } from '@/components/shared/RecordPagination';

type PropertyRecipient = {
  id: string;
  name: string;
  propertyType: string;
  propertyId?: string;
  location?: string;
  address?: string;
  partnerId?: string | null;
  partnerName?: string;
  partnerEmail?: string;
  partnerPhone?: string;
  hasAssignedPartner: boolean;
};

type PartnerUserRecipient = {
  id: string;
  name: string;
  contactName: string;
  businessName?: string;
  businessType?: string;
  email: string;
  phone?: string;
  status: string;
};

type NotificationRecord = {
  _id: string;
  title: string;
  message: string;
  type: 'notice' | 'notification';
  audience: 'all_partners' | 'partner' | 'admin';
  priority?: 'normal' | 'high' | 'critical';
  metadata?: {
    targetType?: string;
    targetDescription?: string;
    propertyName?: string;
    propertyType?: string;
    partnerName?: string;
    sentByAdminName?: string;
  };
  createdAt: string;
};

const AdminNotifications = () => {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  // Recipient lists from backend
  const [properties, setProperties] = useState<PropertyRecipient[]>([]);
  const [partners, setPartners] = useState<PartnerUserRecipient[]>([]);
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false);

  // Form state
  const [targetType, setTargetType] = useState<'property' | 'partner' | 'all'>('property');
  const [propertyFilter, setPropertyFilter] = useState<'all' | 'dharamshala' | 'hotel' | 'home_stay'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProperty, setSelectedProperty] = useState<PropertyRecipient | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<PartnerUserRecipient | null>(null);

  const [noticeType, setNoticeType] = useState<'notification' | 'notice'>('notification');
  const [priority, setPriority] = useState<'normal' | 'high' | 'critical'>('normal');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // History state
  const [history, setHistory] = useState<NotificationRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'all' | 'notice' | 'notification'>('all');

  // Load recipients
  const loadRecipients = async () => {
    if (!token) return;
    try {
      setIsLoadingRecipients(true);
      const res = await api.get('/partner/recipients', withAuth(token));
      if (res.data?.success) {
        setProperties(Array.isArray(res.data?.data?.properties) ? res.data.data.properties : []);
        setPartners(Array.isArray(res.data?.data?.partners) ? res.data.data.partners : []);
      }
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to load recipients'));
    } finally {
      setIsLoadingRecipients(false);
    }
  };

  // Load history
  const loadHistory = async () => {
    if (!token) return;
    try {
      setIsLoadingHistory(true);
      const res = await api.get('/partner/notifications/history', withAuth(token));
      if (res.data?.success) {
        setHistory(Array.isArray(res.data?.data) ? res.data.data : []);
      }
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to load history'));
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    void loadRecipients();
    void loadHistory();
  }, [token]);

  // Filtered properties
  const filteredProperties = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return properties.filter((p) => {
      if (propertyFilter !== 'all' && p.propertyType !== propertyFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.location && p.location.toLowerCase().includes(q)) ||
        (p.propertyId && p.propertyId.toLowerCase().includes(q)) ||
        (p.partnerName && p.partnerName.toLowerCase().includes(q))
      );
    });
  }, [properties, propertyFilter, searchQuery]);

  // Filtered partners
  const filteredPartners = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return partners.filter((p) => {
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        (p.phone && p.phone.includes(q)) ||
        (p.businessType && p.businessType.toLowerCase().includes(q))
      );
    });
  }, [partners, searchQuery]);

  // Handle send confirmation
  const handleInitiateSend = () => {
    if (!title.trim()) return toast.error('Please enter a title');
    if (!message.trim()) return toast.error('Please enter a message');

    if (targetType === 'property') {
      if (!selectedProperty) return toast.error('Please select a target property');
      if (!selectedProperty.hasAssignedPartner) {
        return toast.error('The selected property does not have a registered partner assigned');
      }
    } else if (targetType === 'partner') {
      if (!selectedPartner) return toast.error('Please select a target partner account');
    }

    setShowConfirmModal(true);
  };

  const handleConfirmSend = async () => {
    if (!token) return;
    setIsSending(true);
    try {
      const idempotencyKey = `adm_notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const payload: Record<string, unknown> = {
        title: title.trim(),
        message: message.trim(),
        type: noticeType,
        priority,
        targetType,
        idempotencyKey,
      };

      if (targetType === 'property' && selectedProperty) {
        payload.hotelId = selectedProperty.id;
      } else if (targetType === 'partner' && selectedPartner) {
        payload.partnerId = selectedPartner.id;
      }

      const res = await api.post('/partner/notifications', payload, withAuth(token));
      if (res.data?.success) {
        toast.success(res.data?.message || 'Notice dispatched successfully');
        setTitle('');
        setMessage('');
        setShowConfirmModal(false);
        void loadHistory();
      } else {
        toast.error(res.data?.message || 'Failed to dispatch notification');
      }
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to dispatch notification'));
    } finally {
      setIsSending(false);
    }
  };

  // Filtered history pagination
  const filteredHistory = useMemo(() => {
    return history.filter((h) => historyTypeFilter === 'all' || h.type === historyTypeFilter);
  }, [history, historyTypeFilter]);

  const { page, setPage, pageItems } = useRecordPagination(filteredHistory, [historyTypeFilter]);

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-border pb-5">
        <div>
          <p className="font-body text-xs font-bold uppercase tracking-wider text-brand-gold">Administrative Desk</p>
          <h1 className="font-heading text-2xl font-bold text-foreground">Targeted Partner Notifications & Notices</h1>
          <p className="font-body text-xs text-muted-foreground mt-0.5">
            Deliver targeted operational notices, guidelines, or announcements directly to specific properties or partner accounts.
          </p>
        </div>
        <button
          onClick={() => { void loadRecipients(); void loadHistory(); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw size={14} className={isLoadingRecipients || isLoadingHistory ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── Composer Form (7 cols) ── */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-6">
            <h2 className="font-heading text-lg font-bold text-foreground flex items-center gap-2">
              <Megaphone size={18} className="text-brand-crimson" /> Compose Notice or Notification
            </h2>

            {/* Recipient Target Type */}
            <div>
              <label className="block font-body text-xs font-bold text-foreground mb-2 uppercase tracking-wide">
                1. Recipient Scope
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => { setTargetType('property'); setSearchQuery(''); }}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-left font-body text-xs font-medium transition-all ${
                    targetType === 'property'
                      ? 'border-brand-crimson bg-brand-crimson/5 text-brand-crimson font-bold shadow-sm'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Building2 size={16} />
                  <span>Specific Property</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setTargetType('partner'); setSearchQuery(''); }}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-left font-body text-xs font-medium transition-all ${
                    targetType === 'partner'
                      ? 'border-brand-crimson bg-brand-crimson/5 text-brand-crimson font-bold shadow-sm'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <User size={16} />
                  <span>Partner Account</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setTargetType('all'); setSearchQuery(''); }}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-left font-body text-xs font-medium transition-all ${
                    targetType === 'all'
                      ? 'border-brand-crimson bg-brand-crimson/5 text-brand-crimson font-bold shadow-sm'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Radio size={16} />
                  <span>All Partners (Broadcast)</span>
                </button>
              </div>
            </div>

            {/* Sub-selector: Specific Property */}
            {targetType === 'property' && (
              <div className="space-y-3 bg-muted/30 rounded-xl p-4 border border-border/70">
                <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
                  <span className="font-body text-xs font-bold text-foreground">Select Target Property</span>
                  <div className="flex gap-1">
                    {(['all', 'dharamshala', 'hotel', 'home_stay'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setPropertyFilter(t)}
                        className={`px-2 py-1 rounded text-[11px] capitalize font-medium transition-colors ${
                          propertyFilter === t ? 'bg-brand-crimson text-white' : 'bg-background text-muted-foreground hover:bg-muted border border-border'
                        }`}
                      >
                        {t === 'home_stay' ? 'Homestay' : t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative">
                  <Search size={14} className="absolute left-3 top-3 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search property by name, location, or ID..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background font-body text-xs"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {filteredProperties.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 text-center">No matching properties found.</p>
                  ) : (
                    filteredProperties.map((p) => {
                      const isSelected = selectedProperty?.id === p.id;
                      return (
                        <div
                          key={p.id}
                          onClick={() => setSelectedProperty(p)}
                          className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-all ${
                            isSelected
                              ? 'border-brand-crimson bg-brand-crimson/10 font-medium'
                              : 'border-border bg-background hover:bg-muted'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-foreground">{p.name}</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-secondary uppercase font-semibold">
                                {p.propertyType}
                              </span>
                              {p.propertyId && (
                                <span className="text-[10px] text-muted-foreground">ID: {p.propertyId}</span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate max-w-sm mt-0.5">
                              {p.partnerName ? `Partner: ${p.partnerName} (${p.partnerEmail})` : '⚠️ No registered partner assigned'}
                            </p>
                          </div>
                          {isSelected && <CheckCircle2 size={16} className="text-brand-crimson shrink-0 ml-2" />}
                        </div>
                      );
                    })
                  )}
                </div>

                {selectedProperty && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 flex items-center justify-between text-xs text-emerald-900 mt-2">
                    <span className="truncate">
                      Selected: <strong>{selectedProperty.name}</strong> ({selectedProperty.propertyType})
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedProperty(null)}
                      className="text-xs underline text-emerald-800 ml-2 shrink-0"
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Sub-selector: Specific Partner Account */}
            {targetType === 'partner' && (
              <div className="space-y-3 bg-muted/30 rounded-xl p-4 border border-border/70">
                <span className="font-body text-xs font-bold text-foreground block">Select Partner Account</span>

                <div className="relative">
                  <Search size={14} className="absolute left-3 top-3 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search partner by name, business, or email..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background font-body text-xs"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {filteredPartners.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 text-center">No matching partners found.</p>
                  ) : (
                    filteredPartners.map((p) => {
                      const isSelected = selectedPartner?.id === p.id;
                      return (
                        <div
                          key={p.id}
                          onClick={() => setSelectedPartner(p)}
                          className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-all ${
                            isSelected
                              ? 'border-brand-crimson bg-brand-crimson/10 font-medium'
                              : 'border-border bg-background hover:bg-muted'
                          }`}
                        >
                          <div>
                            <span className="font-bold text-foreground">{p.name}</span>
                            <p className="text-[11px] text-muted-foreground truncate max-w-sm mt-0.5">
                              {p.email} {p.phone ? `• ${p.phone}` : ''}
                            </p>
                          </div>
                          {isSelected && <CheckCircle2 size={16} className="text-brand-crimson shrink-0 ml-2" />}
                        </div>
                      );
                    })
                  )}
                </div>

                {selectedPartner && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 flex items-center justify-between text-xs text-emerald-900 mt-2">
                    <span className="truncate">
                      Selected: <strong>{selectedPartner.name}</strong> ({selectedPartner.email})
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedPartner(null)}
                      className="text-xs underline text-emerald-800 ml-2 shrink-0"
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Broadcast Notice Banner */}
            {targetType === 'all' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900">
                <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Platform Broadcast:</strong> This notice will be published to the notification desks of all registered hotel and Dharamshala partners.
                </p>
              </div>
            )}

            {/* Notice Category & Priority */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-body text-xs font-bold text-foreground mb-1.5 uppercase tracking-wide">
                  2. Notice Type
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNoticeType('notification')}
                    className={`flex-1 py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      noticeType === 'notification'
                        ? 'border-brand-crimson bg-brand-crimson text-white'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Bell size={14} /> Notification (Alert)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNoticeType('notice')}
                    className={`flex-1 py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      noticeType === 'notice'
                        ? 'border-brand-gold bg-brand-gold text-foreground'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Megaphone size={14} /> Official Notice
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-body text-xs font-bold text-foreground mb-1.5 uppercase tracking-wide">
                  Priority Level
                </label>
                <div className="flex gap-2">
                  {(['normal', 'high', 'critical'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`flex-1 py-2 rounded-lg border text-xs font-medium capitalize transition-colors ${
                        priority === p
                          ? p === 'critical'
                            ? 'bg-destructive text-white border-destructive font-bold'
                            : p === 'high'
                            ? 'bg-amber-600 text-white border-amber-600 font-bold'
                            : 'bg-slate-900 text-white border-slate-900 font-bold'
                          : 'border-border bg-background text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Content Fields */}
            <div className="space-y-3">
              <div>
                <label className="block font-body text-xs font-bold text-foreground mb-1.5 uppercase tracking-wide">
                  3. Title / Subject
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Mandatory occupancy report update for October"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background font-body text-sm"
                  maxLength={120}
                />
              </div>

              <div>
                <label className="block font-body text-xs font-bold text-foreground mb-1.5 uppercase tracking-wide">
                  4. Message Body
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Provide complete guidelines, operational details, or instructions for the partner..."
                  rows={4}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background font-body text-sm resize-y"
                />
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleInitiateSend}
                disabled={isSending}
                className="btn-crimson px-6 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                <Send size={15} /> Send Notice
              </button>
            </div>
          </div>
        </div>

        {/* ── Dispatch History & Delivery Status (5 cols) ── */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-heading text-base font-bold text-foreground">Delivery History</h3>
                <p className="font-body text-xs text-muted-foreground">Notices & notifications sent from desk</p>
              </div>
              <div className="flex gap-1">
                {(['all', 'notice', 'notification'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setHistoryTypeFilter(t)}
                    className={`px-2 py-1 rounded text-[11px] capitalize font-medium transition-colors ${
                      historyTypeFilter === t ? 'bg-slate-900 text-white' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {isLoadingHistory ? (
              <div className="py-8 text-center text-xs text-muted-foreground">Loading dispatch history...</div>
            ) : filteredHistory.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">No dispatched notices found.</div>
            ) : (
              <div className="space-y-3">
                {pageItems.map((item) => (
                  <div key={item._id} className="p-3 rounded-xl border border-border bg-background space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                            item.type === 'notice' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {item.type}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            item.audience === 'all_partners' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {item.audience === 'all_partners' ? 'Broadcast' : item.metadata?.targetDescription || 'Targeted'}
                        </span>
                        {item.priority && item.priority !== 'normal' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-700 font-bold uppercase">
                            {item.priority}
                          </span>
                        )}
                      </div>
                      <span className="font-body text-[11px] text-muted-foreground whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </span>
                    </div>

                    <p className="font-body text-xs font-bold text-foreground leading-snug">{item.title}</p>
                    <p className="font-body text-xs text-muted-foreground line-clamp-2 leading-relaxed">{item.message}</p>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/50">
                      <span>Sender: {item.metadata?.sentByAdminName || 'Admin'}</span>
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 size={11} className="text-emerald-600" /> Dispatched
                      </span>
                    </div>
                  </div>
                ))}

                <RecordPagination page={page} total={filteredHistory.length} onPageChange={setPage} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Confirmation Modal ── */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-card rounded-2xl border border-border p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-crimson/10 flex items-center justify-center text-brand-crimson shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-heading text-lg font-bold text-foreground">Confirm Notice Dispatch</h3>
                <p className="font-body text-xs text-muted-foreground">Verify recipient and contents before sending</p>
              </div>
            </div>

            <div className="bg-muted/40 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recipient Target:</span>
                <span className="font-bold text-foreground text-right">
                  {targetType === 'all'
                    ? 'All Registered Partners'
                    : targetType === 'property'
                    ? `${selectedProperty?.name} (${selectedProperty?.propertyType})`
                    : selectedPartner?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Notice Type:</span>
                <span className="font-bold capitalize text-foreground">{noticeType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Priority:</span>
                <span className="font-bold capitalize text-foreground">{priority}</span>
              </div>
              <div className="pt-2 border-t border-border">
                <span className="text-muted-foreground block mb-0.5">Title:</span>
                <p className="font-bold text-foreground">{title}</p>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSending}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSend}
                disabled={isSending}
                className="btn-crimson px-5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
              >
                {isSending ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Sending...
                  </>
                ) : (
                  <>
                    <Send size={14} /> Confirm & Send
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotifications;

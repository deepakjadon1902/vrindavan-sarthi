import { useEffect, useState } from 'react';
import {
  HelpCircle, Search, MessageSquare, AlertCircle, CheckCircle2, Clock,
  User, Send, Plus, Filter, Tag
} from 'lucide-react';
import { api, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

type SupportTicket = {
  _id: string;
  ticketId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  bookingCode?: string;
  propertyName?: string;
  category: string;
  priority: string;
  status: string;
  subject: string;
  description: string;
  assignedAdminName?: string;
  internalNotes: Array<{
    note: string;
    authorName?: string;
    createdAt: string;
  }>;
  timeline: Array<{
    action: string;
    performedBy: string;
    performedByRole: string;
    note: string;
    timestamp: string;
  }>;
  resolutionNotes?: string;
  resolvedAt?: string;
  createdAt: string;
};

const CATEGORIES = ['All', 'Booking', 'Payment', 'Cancellation', 'Refund', 'Property', 'Partner', 'Check-in', 'Checkout', 'Other'];
const PRIORITIES = ['All', 'Low', 'Medium', 'High', 'Critical'];
const STATUSES = ['All', 'Open', 'In Progress', 'Waiting for Response', 'Resolved', 'Closed'];

const formatDate = (val?: string) => (val ? new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-');

const AdminSupport = () => {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [priority, setPriority] = useState('All');
  const [status, setStatus] = useState('All');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [newNote, setNewNote] = useState('');
  const [resolutionInput, setResolutionInput] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  const fetchTickets = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api.get('/support/admin/tickets', {
        ...withAuth(token),
        params: {
          q: search,
          category: category === 'All' ? undefined : category,
          priority: priority === 'All' ? undefined : priority,
          status: status === 'All' ? undefined : status,
        },
      });
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setTickets(res.data.data);
      }
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTickets();
  }, [token, category, priority, status]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void fetchTickets();
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedTicket || !newNote.trim()) return;
    setSubmittingNote(true);
    try {
      const res = await api.post(
        `/support/admin/tickets/${selectedTicket._id}/notes`,
        { note: newNote.trim() },
        withAuth(token)
      );
      if (res.data?.success) {
        setSelectedTicket({
          ...selectedTicket,
          internalNotes: res.data.data,
        });
        setNewNote('');
        void fetchTickets();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to add note');
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleUpdateStatus = async (ticketId: string, nextStatus: string, resolution?: string) => {
    if (!token) return;
    try {
      const res = await api.put(
        `/support/admin/tickets/${ticketId}`,
        { status: nextStatus, resolutionNotes: resolution },
        withAuth(token)
      );
      if (res.data?.success) {
        setSelectedTicket(res.data.data);
        setResolutionInput('');
        void fetchTickets();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update ticket status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-card border border-border p-4 rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-heading font-bold text-foreground flex items-center gap-2">
            <HelpCircle className="text-brand-crimson" size={20} />
            Customer Support & Grievance Redressal
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Resolve guest complaints, service issues, and partner disputes with audit tracking
          </p>
        </div>
        <span className="text-xs bg-muted px-3 py-1.5 rounded-lg border border-border text-foreground font-semibold">
          Active Cases: {tickets.filter((t) => t.status !== 'Closed').length}
        </span>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-card border border-border p-3.5 rounded-xl space-y-3">
        <form onSubmit={handleSearchSubmit} className="relative w-full">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets by ID, guest name, email, or subject..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-gold"
          />
        </form>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <Tag size={13} className="text-muted-foreground" />
            <span className="text-muted-foreground font-medium">Category:</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-2.5 py-1 text-xs rounded border border-border bg-background"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <AlertCircle size={13} className="text-muted-foreground" />
            <span className="text-muted-foreground font-medium">Priority:</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="px-2.5 py-1 text-xs rounded border border-border bg-background"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <Filter size={13} className="text-muted-foreground" />
            <span className="text-muted-foreground font-medium">Status:</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-2.5 py-1 text-xs rounded border border-border bg-background"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="p-3">Ticket ID</th>
                <th className="p-3">Subject</th>
                <th className="p-3">Guest</th>
                <th className="p-3">Category</th>
                <th className="p-3">Priority</th>
                <th className="p-3">Status</th>
                <th className="p-3">Created</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    Loading support cases...
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    No support cases match the selected filters.
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr key={t._id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono font-bold text-brand-crimson">
                      {t.ticketId}
                      {t.bookingCode && <span className="block text-[10px] text-muted-foreground font-mono">{t.bookingCode}</span>}
                    </td>
                    <td className="p-3 font-medium text-foreground max-w-xs truncate">
                      {t.subject}
                    </td>
                    <td className="p-3">
                      <span className="font-medium text-foreground">{t.userName}</span>
                      <span className="block text-[10px] text-muted-foreground">{t.userPhone || t.userEmail}</span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-foreground">
                        {t.category}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        t.priority === 'Critical' ? 'bg-rose-500/10 text-rose-600' :
                        t.priority === 'High' ? 'bg-amber-500/10 text-amber-600' :
                        'bg-blue-500/10 text-blue-600'
                      }`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        t.status === 'Resolved' || t.status === 'Closed' ? 'bg-emerald-500/10 text-emerald-600' :
                        t.status === 'In Progress' ? 'bg-blue-500/10 text-blue-600' :
                        'bg-amber-500/10 text-amber-600'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground text-[11px]">
                      {formatDate(t.createdAt)}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => setSelectedTicket(t)}
                        className="px-2.5 py-1 text-xs border border-border hover:bg-muted rounded-md transition-colors font-medium"
                      >
                        Open Case
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Case Detail Drawer / Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-2xl w-full p-5 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-brand-crimson text-sm">{selectedTicket.ticketId}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    selectedTicket.status === 'Resolved' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                  }`}>
                    {selectedTicket.status}
                  </span>
                </div>
                <h3 className="font-heading font-bold text-foreground mt-0.5">{selectedTicket.subject}</h3>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Requester Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-muted/40 rounded-lg">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Guest</span>
                  <span className="font-semibold text-foreground">{selectedTicket.userName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Contact</span>
                  <span className="font-semibold text-foreground">{selectedTicket.userPhone || selectedTicket.userEmail}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Category</span>
                  <span className="font-semibold text-foreground">{selectedTicket.category}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Booking PNR</span>
                  <span className="font-semibold font-mono text-foreground">{selectedTicket.bookingCode || 'N/A'}</span>
                </div>
              </div>

              {/* Description */}
              <div className="p-3 border border-border rounded-lg space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">Problem Statement</span>
                <p className="text-foreground leading-relaxed whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>

              {/* Status Controls */}
              <div className="p-3 bg-muted/20 border border-border rounded-lg space-y-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">Update Ticket Status</span>
                <div className="flex flex-wrap items-center gap-2">
                  {['Open', 'In Progress', 'Waiting for Response', 'Resolved', 'Closed'].map((s) => (
                    <button
                      key={s}
                      onClick={() => void handleUpdateStatus(selectedTicket._id, s, resolutionInput)}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        selectedTicket.status === s
                          ? 'bg-brand-crimson text-white'
                          : 'border border-border hover:bg-muted text-foreground'
                      }`}
                    >
                      Mark as {s}
                    </button>
                  ))}
                </div>
                {selectedTicket.status !== 'Resolved' && selectedTicket.status !== 'Closed' && (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={resolutionInput}
                      onChange={(e) => setResolutionInput(e.target.value)}
                      placeholder="Add resolution summary when marking Resolved..."
                      className="w-full px-3 py-1.5 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-gold"
                    />
                  </div>
                )}
                {selectedTicket.resolutionNotes && (
                  <div className="mt-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-800 dark:text-emerald-300">
                    <strong>Resolution:</strong> {selectedTicket.resolutionNotes}
                  </div>
                )}
              </div>

              {/* Internal Notes */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">Internal Administrator Notes</span>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedTicket.internalNotes.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground italic">No internal notes added yet.</p>
                  ) : (
                    selectedTicket.internalNotes.map((n, i) => (
                      <div key={i} className="p-2.5 bg-muted/40 rounded-lg text-xs space-y-0.5">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span className="font-semibold text-foreground">{n.authorName || 'Admin'}</span>
                          <span>{formatDate(n.createdAt)}</span>
                        </div>
                        <p className="text-foreground">{n.note}</p>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleAddNote} className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Write internal staff note..."
                    className="flex-1 px-3 py-1.5 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-brand-gold"
                  />
                  <button
                    type="submit"
                    disabled={submittingNote || !newNote.trim()}
                    className="px-3 py-1.5 bg-brand-crimson text-white text-xs font-semibold rounded hover:bg-brand-crimson/90 transition-colors flex items-center gap-1"
                  >
                    <Send size={12} /> Add
                  </button>
                </form>
              </div>

              {/* Activity Timeline */}
              {selectedTicket.timeline.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-border">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase">Audit History Timeline</span>
                  <div className="space-y-1">
                    {selectedTicket.timeline.map((evt, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="w-2 h-2 rounded-full bg-brand-crimson shrink-0" />
                        <span className="font-medium text-foreground">{evt.performedBy} ({evt.performedByRole}):</span>
                        <span>{evt.note}</span>
                        <span className="ml-auto">{formatDate(evt.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-border">
              <button
                onClick={() => setSelectedTicket(null)}
                className="px-4 py-2 border border-border rounded-lg hover:bg-muted text-xs font-medium"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSupport;

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Clock, Download, Eye, FileText, Mail, Phone, Search, User, X, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api, resolveBackendAssetUrl, withAuth } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAuthStore } from '@/store/authStore';

type PartnerStatus = 'pending' | 'approved' | 'rejected';

type PartnerDocument = {
  name?: string;
  type?: string;
  mimeType?: string;
  url?: string;
  uploadedAt?: string;
};

type PartnerUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  businessName?: string;
  gstNumber?: string;
  businessType?: string;
  businessAddress?: string;
  businessPhone?: string;
  businessEmail?: string;
  businessDescription?: string;
  partnerStatus: PartnerStatus;
  partnerDocuments: PartnerDocument[];
  createdAt: string;
};

type DocumentViewer = {
  doc: PartnerDocument;
  url: string;
  kind: 'image' | 'pdf' | 'file';
  index: number;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const getString = (obj: Record<string, unknown>, key: string) => (typeof obj[key] === 'string' ? obj[key] : '');

const normalizePartner = (value: unknown): PartnerUser => {
  const obj = isRecord(value) ? value : {};
  const status = getString(obj, 'partnerStatus');
  const partnerStatus: PartnerStatus = status === 'approved' || status === 'rejected' ? status : 'pending';
  const docs = Array.isArray(obj.partnerDocuments)
    ? obj.partnerDocuments.filter(isRecord).map((doc) => ({
      name: getString(doc, 'name') || 'Document',
      type: getString(doc, 'type') || 'other',
      mimeType: getString(doc, 'mimeType') || '',
      url: getString(doc, 'url'),
      uploadedAt: getString(doc, 'uploadedAt'),
    }))
    : [];

  return {
    id: getString(obj, '_id') || getString(obj, 'id'),
    name: getString(obj, 'name'),
    email: getString(obj, 'email'),
    phone: getString(obj, 'phone') || undefined,
    businessName: getString(obj, 'businessName') || undefined,
    gstNumber: getString(obj, 'gstNumber') || undefined,
    businessType: getString(obj, 'businessType') || undefined,
    businessAddress: getString(obj, 'businessAddress') || undefined,
    businessPhone: getString(obj, 'businessPhone') || undefined,
    businessEmail: getString(obj, 'businessEmail') || undefined,
    businessDescription: getString(obj, 'businessDescription') || undefined,
    partnerStatus,
    partnerDocuments: docs,
    createdAt: getString(obj, 'createdAt') || new Date().toISOString(),
  };
};

const statusBadge = (status: PartnerStatus) => {
  if (status === 'approved') return 'bg-brand-green/10 text-brand-green';
  if (status === 'rejected') return 'bg-destructive/10 text-destructive';
  return 'bg-brand-saffron/10 text-brand-saffron';
};

const getDocumentKind = (doc: PartnerDocument, url: string) => {
  const mime = String(doc.mimeType || '').toLowerCase();
  const cleanUrl = url.split('?')[0] || '';
  if (mime.startsWith('image/') || /^data:image\//i.test(url) || /\.(png|jpe?g|webp|gif)$/i.test(cleanUrl)) return 'image';
  if (mime === 'application/pdf' || /^data:application\/pdf/i.test(url) || /\.pdf$/i.test(cleanUrl)) return 'pdf';
  return 'file';
};

const ManagePartners = () => {
  const token = useAuthStore((s) => s.token);
  const [partners, setPartners] = useState<PartnerUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<PartnerStatus | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<PartnerUser | null>(null);
  const [viewer, setViewer] = useState<DocumentViewer | null>(null);

  const loadPartners = async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const res = await api.get('/users', withAuth(token));
      const users = Array.isArray(res.data?.data) ? res.data.data : [];
      setPartners(users.filter((u) => isRecord(u) && u.role === 'partner').map(normalizePartner));
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to load partners'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPartners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const counts = useMemo(() => ({
    all: partners.length,
    pending: partners.filter((p) => p.partnerStatus === 'pending').length,
    approved: partners.filter((p) => p.partnerStatus === 'approved').length,
    rejected: partners.filter((p) => p.partnerStatus === 'rejected').length,
  }), [partners]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return partners
      .filter((p) => filter === 'all' || p.partnerStatus === filter)
      .filter((p) => {
        if (!query) return true;
        return [p.name, p.email, p.phone, p.businessName, p.businessType, p.gstNumber]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [filter, partners, search]);

  const updateStatus = async (partner: PartnerUser, partnerStatus: PartnerStatus) => {
    if (!token) return;
    try {
      const res = await api.put(`/users/${partner.id}/partner-status`, { partnerStatus }, withAuth(token));
      const updated = normalizePartner(res.data?.data);
      setPartners((prev) => prev.map((p) => (p.id === partner.id ? updated : p)));
      setSelected((prev) => (prev?.id === partner.id ? updated : prev));
      toast.success(`Partner ${partnerStatus}`);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Status update failed'));
    }
  };

  const openViewer = (doc: PartnerDocument, index: number) => {
    const url = resolveBackendAssetUrl(doc.url);
    setViewer({ doc, url, kind: getDocumentKind(doc, url), index });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`rounded-xl border p-4 text-left transition-colors ${
              filter === status ? 'border-brand-gold bg-brand-gold/10' : 'border-border bg-card hover:bg-muted/40'
            }`}
          >
            <p className="font-body text-xs capitalize text-muted-foreground">{status}</p>
            <p className="font-heading text-2xl font-semibold text-foreground">{counts[status]}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground">Partner Verification</h2>
          <p className="font-body text-xs text-muted-foreground">Review partner business details and legal documents before allowing listings.</p>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search partners..."
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="font-body text-sm text-muted-foreground">Loading partners...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <User size={48} className="mx-auto mb-4 text-muted-foreground/30" />
          <p className="font-heading text-xl text-foreground mb-2">No partners found</p>
          <p className="font-body text-sm text-muted-foreground">New partner registrations will appear here.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Partner</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground hidden md:table-cell">Business</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Docs</th>
                <th className="text-left px-4 py-3 font-body text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-body text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((partner) => (
                <tr key={partner.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <p className="font-body text-sm font-medium text-foreground">{partner.name}</p>
                    <p className="font-body text-xs text-muted-foreground">{partner.email}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="font-body text-sm text-foreground">{partner.businessName || '-'}</p>
                    <p className="font-body text-xs text-muted-foreground">{partner.businessType || partner.gstNumber || '-'}</p>
                  </td>
                  <td className="px-4 py-3 font-body text-sm text-foreground">{partner.partnerDocuments.length}</td>
                  <td className="px-4 py-3">
                    <span className={`font-body text-xs px-2 py-1 rounded-full ${statusBadge(partner.partnerStatus)}`}>
                      {partner.partnerStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setSelected(partner)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="View details">
                        <Eye size={15} />
                      </button>
                      {partner.partnerStatus !== 'approved' && (
                        <button onClick={() => updateStatus(partner, 'approved')} className="p-1.5 rounded hover:bg-brand-green/10 text-muted-foreground hover:text-brand-green" title="Approve partner">
                          <CheckCircle size={15} />
                        </button>
                      )}
                      {partner.partnerStatus !== 'rejected' && (
                        <button onClick={() => updateStatus(partner, 'rejected')} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Reject partner">
                          <XCircle size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h3 className="font-heading text-lg font-semibold text-foreground">{selected.businessName || selected.name}</h3>
              <p className="font-body text-xs text-muted-foreground">Registered {new Date(selected.createdAt).toLocaleDateString()}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="font-body text-xs font-medium text-muted-foreground mb-2">CONTACT</p>
                <div className="space-y-2 font-body text-sm">
                  <div className="flex items-center gap-2"><User size={14} className="text-muted-foreground" />{selected.name}</div>
                  <div className="flex items-center gap-2"><Mail size={14} className="text-muted-foreground" />{selected.email}</div>
                  {selected.phone && <div className="flex items-center gap-2"><Phone size={14} className="text-muted-foreground" />{selected.phone}</div>}
                </div>
              </div>

              <div>
                <p className="font-body text-xs font-medium text-muted-foreground mb-2">BUSINESS DETAILS</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-body text-sm">
                  <div><span className="block text-xs text-muted-foreground">Business Name</span>{selected.businessName || '-'}</div>
                  <div><span className="block text-xs text-muted-foreground">Business Type</span>{selected.businessType || '-'}</div>
                  <div><span className="block text-xs text-muted-foreground">GST Number</span>{selected.gstNumber || '-'}</div>
                  <div><span className="block text-xs text-muted-foreground">Business Phone</span>{selected.businessPhone || '-'}</div>
                  <div><span className="block text-xs text-muted-foreground">Business Email</span>{selected.businessEmail || '-'}</div>
                  <div><span className="block text-xs text-muted-foreground">Status</span><span className={`px-2 py-1 rounded-full text-xs ${statusBadge(selected.partnerStatus)}`}>{selected.partnerStatus}</span></div>
                </div>
                {selected.businessAddress && (
                  <p className="font-body text-sm mt-3"><span className="block text-xs text-muted-foreground">Business Address</span>{selected.businessAddress}</p>
                )}
                {selected.businessDescription && (
                  <p className="font-body text-sm mt-3"><span className="block text-xs text-muted-foreground">Description</span>{selected.businessDescription}</p>
                )}
              </div>
            </div>

            <div>
              <p className="font-body text-xs font-medium text-muted-foreground mb-2">LEGAL DOCUMENTS</p>
              {selected.partnerDocuments.length === 0 ? (
                <div className="rounded-xl border border-border p-5 text-center">
                  <FileText size={28} className="mx-auto mb-2 text-muted-foreground/40" />
                  <p className="font-body text-sm text-muted-foreground">No documents uploaded.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selected.partnerDocuments.map((doc, index) => {
                    const url = resolveBackendAssetUrl(doc.url);
                    const kind = getDocumentKind(doc, url);
                    return (
                      <div key={`${doc.url}-${index}`} className="rounded-xl border border-border overflow-hidden bg-background">
                        {kind === 'image' ? (
                          <img src={url} alt={doc.name || 'Document'} className="w-full h-32 object-cover border-b border-border" />
                        ) : kind === 'pdf' ? (
                          <div className="h-32 border-b border-border bg-muted/30">
                            <iframe src={url} title={doc.name || `Document ${index + 1}`} className="w-full h-full" />
                          </div>
                        ) : (
                          <div className="h-32 flex items-center justify-center border-b border-border">
                            <FileText size={32} className="text-muted-foreground" />
                          </div>
                        )}
                        <div className="p-3">
                          <p className="font-body text-sm font-medium text-foreground">{doc.name || `Document ${index + 1}`}</p>
                          <p className="font-body text-xs text-muted-foreground">{doc.mimeType || doc.type || 'other'}</p>
                          <div className="flex flex-wrap gap-2 mt-3">
                            <button type="button" onClick={() => openViewer(doc, index)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 font-body text-xs hover:bg-muted">
                              <Eye size={12} /> View
                            </button>
                            <a href={url} download={doc.name || `partner-document-${index + 1}`} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 font-body text-xs hover:bg-muted">
                              <Download size={12} /> Download
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-4 flex flex-wrap gap-3">
            {selected.partnerStatus !== 'approved' && (
              <button onClick={() => updateStatus(selected, 'approved')} className="px-5 py-2.5 rounded-lg text-sm font-body bg-brand-green text-primary-foreground hover:bg-brand-green/90 inline-flex items-center gap-2">
                <CheckCircle size={15} /> Verify & Allow Listings
              </button>
            )}
            {selected.partnerStatus !== 'rejected' && (
              <button onClick={() => updateStatus(selected, 'rejected')} className="px-5 py-2.5 rounded-lg text-sm font-body bg-destructive text-primary-foreground hover:bg-destructive/90 inline-flex items-center gap-2">
                <XCircle size={15} /> Reject Partner
              </button>
            )}
            {selected.partnerStatus === 'approved' && (
              <span className="px-4 py-2.5 rounded-lg text-sm font-body bg-brand-green/10 text-brand-green inline-flex items-center gap-2">
                <Clock size={15} /> Approved partner can submit listings
              </span>
            )}
          </div>
        </div>
      )}

      {viewer && (
        <div className="fixed inset-0 z-[100] bg-black/70 p-3 sm:p-6" role="dialog" aria-modal="true">
          <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <h3 className="font-heading text-base font-semibold text-foreground truncate">
                  {viewer.doc.name || `Document ${viewer.index + 1}`}
                </h3>
                <p className="font-body text-xs text-muted-foreground truncate">
                  {viewer.doc.mimeType || viewer.doc.type || 'Legal document'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a href={viewer.url} download={viewer.doc.name || `partner-document-${viewer.index + 1}`} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 font-body text-xs hover:bg-muted">
                  <Download size={14} /> Download
                </a>
                <button onClick={() => setViewer(null)} className="rounded-lg border border-border p-2 hover:bg-muted" title="Close document viewer">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-muted/30 p-4">
              {viewer.kind === 'image' ? (
                <img src={viewer.url} alt={viewer.doc.name || 'Legal document'} className="mx-auto max-h-none max-w-full rounded-lg bg-background object-contain shadow-sm" />
              ) : viewer.kind === 'pdf' ? (
                <iframe src={viewer.url} title={viewer.doc.name || 'Legal document'} className="h-[78vh] min-h-[560px] w-full rounded-lg border border-border bg-background" />
              ) : (
                <div className="mx-auto max-w-xl rounded-xl border border-border bg-background p-8 text-center">
                  <FileText size={42} className="mx-auto mb-3 text-muted-foreground" />
                  <p className="font-body text-sm font-medium text-foreground">Preview is not available for this file type.</p>
                  <p className="font-body text-xs text-muted-foreground mt-2">
                    Download the document to inspect it.
                  </p>
                  <a href={viewer.url} download={viewer.doc.name || `partner-document-${viewer.index + 1}`} className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 font-body text-sm hover:bg-muted">
                    <Download size={15} /> Download Document
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagePartners;

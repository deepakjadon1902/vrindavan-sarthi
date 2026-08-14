import { useState } from 'react';
import { FileText, Image as ImageIcon, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import type { PartnerDocumentUpload } from '@/types/auth.types';
import { resolveBackendAssetUrl } from '@/lib/api';

const DOCUMENT_TYPES = [
  { value: 'aadhar_card', label: 'Aadhaar Card' },
  { value: 'pan_card', label: 'PAN Card' },
  { value: 'gstin_registration', label: 'GST Registration Certificate' },
  { value: 'property_registry_document', label: 'Property Registry / Lease Document' },
  { value: 'business_license', label: 'Business License' },
  { value: 'other', label: 'Other Government / Legal Document' },
] as const;

type DocumentType = (typeof DOCUMENT_TYPES)[number]['value'];

const ALLOWED_DOCUMENT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1600;

const getDocumentLabel = (value?: string) =>
  DOCUMENT_TYPES.find((item) => item.value === value)?.label || 'Other Government / Legal Document';

const formatKb = (bytes?: number) => {
  const size = Number(bytes || 0);
  if (!size) return '';
  return `${Math.max(1, Math.round(size / 1024)).toLocaleString('en-IN')} KB`;
};

const getFileMimeType = (file: File) => {
  const browserType = String(file.type || '').toLowerCase();
  if (browserType) return browserType;
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.doc')) return 'application/msword';
  if (name.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'application/octet-stream';
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });

const optimizeImageDocument = (file: File) =>
  new Promise<{ data: string; name: string; mimeType: string }>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const ratio = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * ratio));
      const height = Math.max(1, Math.round(image.height * ratio));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Image optimization failed'));
        return;
      }
      ctx.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);
      const data = canvas.toDataURL('image/webp', 0.72);
      const baseName = file.name.replace(/\.[^.]+$/, '') || 'legal-document';
      resolve({ data, name: `${baseName}.webp`, mimeType: 'image/webp' });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Image optimization failed'));
    };
    image.src = objectUrl;
  });

const PartnerProfileSettings = () => {
  const { user, updateProfile, uploadPartnerDocuments } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.profileDisplayName || user?.businessName || user?.name || '');
  const [bio, setBio] = useState(user?.profileBio || user?.businessDescription || '');
  const [profilePicture, setProfilePicture] = useState(user?.profilePicture || user?.avatar || '');
  const [businessName, setBusinessName] = useState(user?.businessName || '');
  const [gstNumber, setGstNumber] = useState(user?.gstNumber || '');
  const [businessType, setBusinessType] = useState(user?.businessType || '');
  const [businessAddress, setBusinessAddress] = useState(user?.businessAddress || '');
  const [businessPhone, setBusinessPhone] = useState(user?.businessPhone || user?.phone || '');
  const [businessEmail, setBusinessEmail] = useState(user?.businessEmail || user?.email || '');
  const [businessDescription, setBusinessDescription] = useState(user?.businessDescription || '');
  const [selectedDocumentType, setSelectedDocumentType] = useState<DocumentType>('aadhar_card');
  const [documents, setDocuments] = useState<PartnerDocumentUpload[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setProfilePicture(String(reader.result || ''));
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return toast.error('Display name is required');
    if (!businessName.trim()) return toast.error('Business name is required');
    setIsSaving(true);
    const res = await updateProfile({
      profileDisplayName: displayName.trim(),
      profileBio: bio.trim(),
      profilePicture,
      businessName: businessName.trim(),
      gstNumber: gstNumber.trim(),
      businessType: businessType.trim(),
      businessAddress: businessAddress.trim(),
      businessPhone: businessPhone.trim(),
      businessEmail: businessEmail.trim(),
      businessDescription: businessDescription.trim(),
    });
    setIsSaving(false);
    if (res.success) toast.success('Profile settings updated');
    else toast.error(res.error || 'Update failed');
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      const mimeType = getFileMimeType(file);
      if (!ALLOWED_DOCUMENT_TYPES.has(mimeType.toLowerCase())) {
        toast.error(`${file.name}: upload only PNG, JPG, WEBP, PDF, DOC, or DOCX legal documents.`);
        continue;
      }
      if (file.size > MAX_DOCUMENT_BYTES) {
        toast.error(`${file.name}: file must be 10 MB or smaller.`);
        continue;
      }
      try {
        const prepared = mimeType.startsWith('image/')
          ? await optimizeImageDocument(file)
          : { data: await readFileAsDataUrl(file), name: file.name, mimeType };
        if (!prepared.data) continue;
        setDocuments((prev) => [...prev, {
          data: prepared.data,
          name: prepared.name,
          type: selectedDocumentType,
          mimeType: prepared.mimeType,
        }]);
        if (mimeType.startsWith('image/')) {
          toast.success(`${file.name} optimized to ${prepared.name}`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `${file.name}: upload failed`);
      }
    }
    e.target.value = '';
  };

  const submitDocuments = async () => {
    if (!documents.length) return toast.error('Select at least one document');
    setIsUploading(true);
    const res = await uploadPartnerDocuments(documents);
    setIsUploading(false);
    if (res.success) {
      toast.success('Verification documents uploaded for admin review');
      setDocuments([]);
    } else {
      toast.error(res.error || 'Document upload failed');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="font-heading text-xl font-bold text-foreground">Profile Settings</h2>
        <p className="font-body text-xs text-muted-foreground">Customize the public host profile shown with your approved listings.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row gap-5">
          <div className="w-32">
            <div className="w-28 h-28 rounded-full overflow-hidden border border-border bg-muted">
              {profilePicture ? (
                <img src={profilePicture} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon size={24} className="text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <label className="px-3 py-1.5 rounded-lg border border-border text-xs font-body cursor-pointer hover:bg-muted">
                Upload
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
              {profilePicture && (
                <button type="button" onClick={() => setProfilePicture('')} className="p-1.5 rounded-lg border border-border hover:bg-muted" title="Remove photo">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Display Name *</label>
              <input
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
              />
            </div>
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Bio</label>
              <textarea
                rows={6}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-5">
          <h3 className="font-heading text-lg font-semibold text-foreground mb-4">Business Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Business Name *</label>
              <input required value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" />
            </div>
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Business Type</label>
              <input value={businessType} onChange={(e) => setBusinessType(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" />
            </div>
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">GST Number</label>
              <input value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" />
            </div>
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Business Phone</label>
              <input value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" />
            </div>
            <div className="sm:col-span-2">
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Business Email</label>
              <input type="email" value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" />
            </div>
            <div className="sm:col-span-2">
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Business Address</label>
              <input value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" />
            </div>
            <div className="sm:col-span-2">
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Business Description</label>
              <textarea rows={3} value={businessDescription} onChange={(e) => setBusinessDescription(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none" />
            </div>
          </div>
        </div>

        <button type="submit" disabled={isSaving} className="btn-crimson px-5 py-2.5 rounded-lg text-sm inline-flex items-center gap-2 disabled:opacity-60">
          <Save size={16} /> {isSaving ? 'Saving...' : 'Save Profile'}
        </button>
      </form>

      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div>
          <h3 className="font-heading text-lg font-semibold text-foreground">Verification Documents</h3>
          <p className="font-body text-xs text-muted-foreground">Choose the document type first, then upload one or more files. Files are stored as URLs; the database keeps only metadata.</p>
          <p className="mt-2 rounded-lg border border-brand-gold/30 bg-brand-gold/10 px-3 py-2 font-body text-xs font-semibold text-foreground">
            Upload only clear legal documents in PNG, JPG, WEBP, PDF, DOC, or DOCX format. Image documents are automatically optimized to small WebP files before storage.
          </p>
        </div>

        {user?.partnerDocuments?.length ? (
          <div className="grid gap-2">
            {user.partnerDocuments.map((doc, index) => (
              <div key={`${doc.url}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                <div className="min-w-0">
                  <p className="font-body text-sm text-foreground truncate">{doc.name || doc.originalName || `Document ${index + 1}`}</p>
                  <p className="font-body text-xs text-muted-foreground">{getDocumentLabel(doc.type)}{doc.mimeType ? ` - ${doc.mimeType}` : ''}{doc.sizeBytes ? ` - ${formatKb(doc.sizeBytes)}` : ''}</p>
                </div>
                {doc.url && <a href={resolveBackendAssetUrl(doc.url)} target="_blank" rel="noreferrer" className="font-body text-xs text-brand-gold hover:underline">View</a>}
              </div>
            ))}
          </div>
        ) : (
          <p className="font-body text-sm text-muted-foreground">No verification documents uploaded yet.</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
          <select value={selectedDocumentType} onChange={(e) => setSelectedDocumentType(e.target.value as DocumentType)} className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50">
            {DOCUMENT_TYPES.map((docType) => <option key={docType.value} value={docType.value}>{docType.label}</option>)}
          </select>
          <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border font-body text-sm cursor-pointer hover:bg-muted">
            <FileText size={16} /> Select Files
            <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple onChange={handleDocumentUpload} className="hidden" />
          </label>
        </div>

        {documents.length > 0 && (
          <div className="space-y-2">
            {documents.map((doc, index) => (
              <div key={`${doc.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
                <div className="min-w-0">
                  <p className="font-body text-sm text-foreground truncate">{doc.name}</p>
                  <p className="font-body text-xs text-muted-foreground">{getDocumentLabel(doc.type)} - {doc.mimeType}</p>
                </div>
                <button type="button" onClick={() => setDocuments((prev) => prev.filter((_, i) => i !== index))} className="font-body text-xs text-destructive hover:underline">Remove</button>
              </div>
            ))}
          </div>
        )}

        <button type="button" onClick={submitDocuments} disabled={isUploading || !documents.length} className="btn-gold px-5 py-2.5 rounded-lg text-sm disabled:opacity-60">
          {isUploading ? 'Uploading...' : 'Upload Documents'}
        </button>
      </div>
    </div>
  );
};

export default PartnerProfileSettings;

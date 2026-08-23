import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { toast } from 'sonner';
import templeImg from '@/assets/images/temple-about.jpg';
import { APP_LOGO_URL } from '@/lib/brand';
import { Building2, CheckCircle2, FileText, ShieldCheck, UserRound, X } from 'lucide-react';
import type { PartnerDocumentUpload } from '@/types/auth.types';
import PasswordInput from '@/components/shared/PasswordInput';

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
const PARTNER_TERMS_VERSION = 'owner-partner-terms-v1';
const PRIVACY_POLICY_VERSION = 'privacy-policy-v1';

const partnerCommitments = [
  'I will list only genuine, lawful, and owner-authorized services.',
  'I will keep prices, availability, images, policies, and guest rules accurate.',
  'I will honor confirmed bookings, admin verification decisions, payouts, cancellations, and customer-support processes.',
  'I agree that platform commercial terms will be shown inside my authenticated Partner Dashboard after onboarding.',
];

const getDocumentLabel = (value?: string) =>
  DOCUMENT_TYPES.find((item) => item.value === value)?.label || 'Other Government / Legal Document';

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

const Register = () => {
  const [role, setRole] = useState<'user' | 'partner'>('user');
  const [selectedDocumentType, setSelectedDocumentType] = useState<DocumentType>('aadhar_card');
  const [documents, setDocuments] = useState<PartnerDocumentUpload[]>([]);
  const [partnerPoliciesAccepted, setPartnerPoliciesAccepted] = useState(false);
  const [policyModal, setPolicyModal] = useState<'terms' | 'privacy' | null>(null);
  const [policiesRead, setPoliciesRead] = useState({ terms: false, privacy: false });
  const policyContentRef = useRef<HTMLDivElement | null>(null);
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', street: '', city: '', state: '', pin: '', password: '', confirmPassword: '',
    businessName: '', gstNumber: '', businessType: '', businessAddress: '', businessPhone: '', businessEmail: '', businessDescription: '',
  });
  const { register, isLoading } = useAuthStore();
  const settings = useSettingsStore((s) => s.settings);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPartnerRegistration = searchParams.get('role') === 'partner';

  useEffect(() => {
    setRole(isPartnerRegistration ? 'partner' : 'user');
  }, [isPartnerRegistration]);

  useEffect(() => {
    if (!policyModal) return;
    window.setTimeout(() => {
      const node = policyContentRef.current;
      if (node && node.scrollHeight <= node.clientHeight + 8) {
        setPoliciesRead((prev) => ({ ...prev, [policyModal]: true }));
      }
    }, 0);
  }, [policyModal]);

  const handleGoogle = () => {
    const base = import.meta.env.VITE_API_BASE_URL || '/api';
    window.location.href = `${base}/auth/google`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (formData.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (role === 'partner' && !formData.businessName) { toast.error('Business name is required for partners'); return; }
    if (role === 'partner' && documents.length === 0) { toast.error('Upload at least one government/legal document'); return; }
    if (role === 'partner' && (!policiesRead.terms || !policiesRead.privacy)) { toast.error('Please open and read the terms and privacy policy first'); return; }
    if (role === 'partner' && !partnerPoliciesAccepted) { toast.error('Please accept the owner terms and privacy policy to continue'); return; }

    const result = await register({
      name: formData.name, email: formData.email, phone: formData.phone,
      street: formData.street, city: formData.city, state: formData.state,
      pin: formData.pin, password: formData.password, role,
      ...(role === 'partner' ? {
        businessName: formData.businessName, gstNumber: formData.gstNumber,
        businessType: formData.businessType, businessAddress: formData.businessAddress,
        businessPhone: formData.businessPhone, businessEmail: formData.businessEmail,
        businessDescription: formData.businessDescription,
        documents,
        partnerPolicyConsent: {
          accepted: true,
          termsVersion: PARTNER_TERMS_VERSION,
          privacyVersion: PRIVACY_POLICY_VERSION,
          source: 'partner_registration',
        },
      } : {}),
    });
    if (result.success) {
      toast.success(role === 'partner' ? 'Partner account created! 🙏' : 'Account created successfully! 🙏');
      navigate(role === 'partner' ? '/partner' : '/');
    } else {
      toast.error(result.error || 'Registration failed');
    }
  };

  const update = (field: string, value: string) => setFormData({ ...formData, [field]: value });
  const canAcceptPartnerPolicies = policiesRead.terms && policiesRead.privacy;
  const canSubmit = !isLoading && (role !== 'partner' || (partnerPoliciesAccepted && canAcceptPartnerPolicies));

  const openPolicy = (kind: 'terms' | 'privacy') => {
    setPolicyModal(kind);
  };

  const handlePolicyScroll = (kind: 'terms' | 'privacy', element: HTMLDivElement) => {
    const atBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 8;
    if (atBottom) setPoliciesRead((prev) => ({ ...prev, [kind]: true }));
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
        setDocuments((prev) => [
          ...prev,
          {
            data: prepared.data,
            name: prepared.name,
            type: selectedDocumentType,
            mimeType: prepared.mimeType,
          },
        ]);
        if (mimeType.startsWith('image/')) {
          toast.success(`${file.name} optimized to ${prepared.name}`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `${file.name}: upload failed`);
      }
    }
    e.target.value = '';
  };

  const removeDocument = (index: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 relative">
        <img src={templeImg} alt="Vrindavan Temple" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-white/40 flex items-center justify-center">
          <div className="text-center px-8 bg-white/70 backdrop-blur-sm rounded-2xl py-10 border border-border">
            <img src={APP_LOGO_URL} alt={settings.siteName} className="h-14 w-14 rounded-full object-cover border border-brand-gold/30 mx-auto mb-4" />
            <h2 className="font-brand text-3xl text-brand-gold mb-2">{settings.siteName}</h2>
            <p className="font-heading italic text-xl text-foreground">{settings.motto}</p>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-md py-8">
          <div className="text-center mb-6 lg:hidden">
            <img src={APP_LOGO_URL} alt={settings.siteName} className="h-12 w-12 rounded-full object-cover border border-brand-gold/30 mx-auto" />
            <h2 className="font-brand text-2xl text-brand-gold mt-2">{settings.siteName}</h2>
          </div>

          <h1 className="font-heading text-3xl font-semibold text-foreground mb-2">
            {isPartnerRegistration ? 'Create Partner Account' : 'Create Account'}
          </h1>
          <p className="font-body text-muted-foreground mb-6">
            {isPartnerRegistration ? 'Register your property for admin review' : 'Join us for a simple booking experience'}
          </p>

          {role === 'partner' && (
            <div className="bg-brand-cream border border-brand-gold/20 rounded-xl p-4 mb-6">
              <p className="font-body text-sm text-foreground font-medium">Register as Partner</p>
              <p className="font-body text-xs text-muted-foreground mt-1">List your hotel or dharamshala on {settings.siteName}. Your listing will be reviewed by admin before going live.</p>
              <Link to="/login?role=partner" className="mt-3 inline-flex font-body text-xs font-semibold text-brand-crimson hover:underline">
                Already approved? Partner Login
              </Link>
            </div>
          )}

          {!isPartnerRegistration && (
            <>
              <button onClick={handleGoogle} className="w-full flex items-center justify-center gap-3 border border-border rounded-xl py-3 font-body text-sm hover:bg-muted transition-colors mb-6">
                <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 h-px bg-border" />
                <span className="font-body text-xs text-muted-foreground">OR</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="border-t border-border pt-4">
              <h3 className="font-heading text-lg font-semibold text-foreground flex items-center gap-2">
                <UserRound size={18} className="text-brand-crimson" /> Personal Details
              </h3>
            </div>
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Full Name *</label>
              <input type="text" required value={formData.name} onChange={(e) => update('name', e.target.value)} className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="Your full name" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Email *</label>
                <input type="email" required value={formData.email} onChange={(e) => update('email', e.target.value)} className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="your@email.com" />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Phone *</label>
                <input type="tel" required value={formData.phone} onChange={(e) => update('phone', e.target.value)} className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="+91 XXXXX XXXXX" />
              </div>
            </div>
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Street Address</label>
              <input type="text" value={formData.street} onChange={(e) => update('street', e.target.value)} className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="Street address" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">City</label>
                <input type="text" value={formData.city} onChange={(e) => update('city', e.target.value)} className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="City" />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">State</label>
                <input type="text" value={formData.state} onChange={(e) => update('state', e.target.value)} className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="State" />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">PIN</label>
                <input type="text" value={formData.pin} onChange={(e) => update('pin', e.target.value)} className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="PIN Code" />
              </div>
            </div>

            {/* Partner Fields */}
            {role === 'partner' && (
              <>
                <div className="border-t border-border pt-4 mt-2">
                  <h3 className="font-heading text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Building2 size={18} className="text-brand-gold" /> Business Details
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Business Name *</label>
                    <input type="text" required value={formData.businessName} onChange={(e) => update('businessName', e.target.value)} className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="Your hotel/business name" />
                  </div>
                  <div>
                    <label className="font-body text-sm font-medium text-foreground mb-1.5 block">GST Number</label>
                    <input type="text" value={formData.gstNumber} onChange={(e) => update('gstNumber', e.target.value)} className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="GST Number (optional)" />
                  </div>
                </div>
                <div>
                  <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Business Type</label>
                  <select value={formData.businessType} onChange={(e) => update('businessType', e.target.value)} className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50">
                    <option value="">Select type</option>
                    <option>Hotel</option>
                    <option>Dharamshala</option>
                  </select>
                </div>
                <div>
                  <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Business Address</label>
                  <input type="text" value={formData.businessAddress} onChange={(e) => update('businessAddress', e.target.value)} className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="Business location" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Business Phone</label>
                    <input type="tel" value={formData.businessPhone} onChange={(e) => update('businessPhone', e.target.value)} className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="Business phone" />
                  </div>
                  <div>
                    <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Business Email</label>
                    <input type="email" value={formData.businessEmail} onChange={(e) => update('businessEmail', e.target.value)} className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="business@email.com" />
                  </div>
                </div>
                <div>
                  <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Business Description</label>
                  <textarea rows={3} value={formData.businessDescription} onChange={(e) => update('businessDescription', e.target.value)} className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none" placeholder="Tell us about your business..." />
                </div>
                <div>
                  <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Government / Legal Documents *</label>
                  <p className="mb-2 rounded-lg border border-brand-gold/30 bg-brand-gold/10 px-3 py-2 font-body text-xs font-semibold text-foreground">
                    Upload only clear legal documents in PNG, JPG, WEBP, PDF, DOC, or DOCX format. Image documents are automatically optimized to small WebP files before storage.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
                    <select value={selectedDocumentType} onChange={(e) => setSelectedDocumentType(e.target.value as DocumentType)} className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50">
                      {DOCUMENT_TYPES.map((docType) => (
                        <option key={docType.value} value={docType.value}>{docType.label}</option>
                      ))}
                    </select>
                    <label className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-border bg-card font-body text-sm hover:bg-muted cursor-pointer">
                      <FileText size={16} /> Upload
                      <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple onChange={handleDocumentUpload} className="sr-only" />
                    </label>
                  </div>
                  <p className="font-body text-xs text-muted-foreground mt-1">{documents.length} document(s) selected for admin verification.</p>
                  {documents.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {documents.map((doc, index) => (
                        <div key={`${doc.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
                          <div className="min-w-0">
                            <p className="font-body text-sm text-foreground truncate">{doc.name}</p>
                            <p className="font-body text-xs text-muted-foreground">{getDocumentLabel(doc.type)} - {doc.mimeType}</p>
                          </div>
                          <button type="button" onClick={() => removeDocument(index)} className="text-xs font-body text-destructive hover:underline">
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Password *</label>
                <PasswordInput
                  required
                  value={formData.password}
                  onChange={(value) => update('password', value)}
                  autoComplete="new-password"
                  className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                  placeholder="Password"
                />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Confirm Password *</label>
                <PasswordInput
                  required
                  value={formData.confirmPassword}
                  onChange={(value) => update('confirmPassword', value)}
                  autoComplete="new-password"
                  className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                  placeholder="Confirm password"
                />
              </div>
            </div>
            {role === 'partner' && (
              <div className={`overflow-hidden rounded-2xl border transition-all ${partnerPoliciesAccepted ? 'border-brand-green/40 bg-brand-green/5' : 'border-brand-gold/35 bg-gradient-to-b from-white to-brand-cream/70 shadow-[0_16px_44px_hsl(39_92%_56%_/_0.12)]'}`}>
                <div className="border-b border-border/70 bg-white/75 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${partnerPoliciesAccepted ? 'bg-brand-green/12 text-brand-green' : 'bg-brand-gold/15 text-brand-gold'}`}>
                      <ShieldCheck size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Owner Agreement</p>
                      <h3 className="font-heading text-lg font-semibold leading-tight text-foreground">Partner terms & privacy acknowledgement</h3>
                      <p className="mt-1 font-body text-xs leading-5 text-muted-foreground">
                        Required for owner verification, marketplace listing access, booking handling, and partner payouts.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 px-4 py-4">
                  <div className="grid gap-2">
                    {partnerCommitments.map((item) => (
                      <div key={item} className="flex gap-2 rounded-xl border border-border/70 bg-white/70 px-3 py-2">
                        <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-brand-gold" />
                        <p className="font-body text-xs leading-5 text-foreground/80">{item}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button type="button" onClick={() => openPolicy('terms')} className="inline-flex items-center justify-between rounded-xl border border-border bg-white px-3 py-2.5 font-body text-xs font-bold text-foreground hover:border-brand-gold/50 hover:text-brand-crimson">
                      <span>Terms & Conditions</span>
                      {policiesRead.terms && <CheckCircle2 size={14} className="text-brand-green" />}
                    </button>
                    <button type="button" onClick={() => openPolicy('privacy')} className="inline-flex items-center justify-between rounded-xl border border-border bg-white px-3 py-2.5 font-body text-xs font-bold text-foreground hover:border-brand-gold/50 hover:text-brand-crimson">
                      <span>Privacy Policy</span>
                      {policiesRead.privacy && <CheckCircle2 size={14} className="text-brand-green" />}
                    </button>
                  </div>

                  <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors ${partnerPoliciesAccepted ? 'border-brand-green/35 bg-white' : 'border-brand-gold/35 bg-brand-gold/8 hover:bg-brand-gold/12'}`}>
                    <input
                      type="checkbox"
                      checked={partnerPoliciesAccepted}
                      disabled={!canAcceptPartnerPolicies}
                      onChange={(e) => setPartnerPoliciesAccepted(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-border accent-[hsl(var(--brand-gold))]"
                    />
                    <span className="font-body text-xs leading-5 text-foreground">
                      I confirm that I am authorized to register this partner account and I agree to follow the owner Terms & Conditions, Privacy Policy, listing standards, booking rules, payout process, and admin verification decisions of {settings.siteName}.
                      <span className="mt-1 block font-semibold text-muted-foreground">
                        Acceptance version: {PARTNER_TERMS_VERSION} / {PRIVACY_POLICY_VERSION}
                      </span>
                      {!canAcceptPartnerPolicies && (
                        <span className="mt-1 block text-muted-foreground">Open and scroll both policy documents to enable this confirmation.</span>
                      )}
                    </span>
                  </label>
                </div>
              </div>
            )}
            <button type="submit" disabled={!canSubmit} className={`w-full py-3.5 rounded-xl text-sm mt-2 disabled:cursor-not-allowed disabled:opacity-50 ${role === 'partner' ? 'bg-brand-gold text-foreground font-semibold hover:bg-brand-gold/90' : 'btn-crimson'}`}>
              {isLoading ? 'Creating Account...' : role === 'partner' ? 'Register as Partner' : 'Create Account'}
            </button>
          </form>

          <p className="font-body text-sm text-muted-foreground text-center mt-6">
            Already have an account?{' '}
            <Link to={isPartnerRegistration ? '/login?role=partner' : '/login'} className="text-brand-gold font-semibold hover:underline">
              {isPartnerRegistration ? 'Partner Login' : 'Login'}
            </Link>
          </p>
        </div>
      </div>
      {policyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <p className="font-body text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Partner Review</p>
                <h3 className="font-heading text-xl font-semibold text-foreground">{policyModal === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}</h3>
              </div>
              <button type="button" onClick={() => setPolicyModal(null)} className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>
            <div
              ref={policyContentRef}
              className="max-h-[62vh] overflow-y-auto px-5 py-4 font-body text-sm leading-7 text-foreground"
              onScroll={(e) => handlePolicyScroll(policyModal, e.currentTarget)}
            >
              {(policyModal === 'terms' ? settings.termsOfService : settings.privacyPolicy)
                .split(/\n\n+/)
                .filter(Boolean)
                .map((section, index) => (
                  <p key={index} className="mb-4 whitespace-pre-line">{section}</p>
                ))}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-5 py-4">
              <p className="font-body text-xs text-muted-foreground">
                {policiesRead[policyModal] ? 'Document read.' : 'Scroll to the bottom to mark this document as read.'}
              </p>
              <button type="button" onClick={() => setPolicyModal(null)} className="btn-crimson rounded-lg px-5 py-2 font-body text-sm">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Register;

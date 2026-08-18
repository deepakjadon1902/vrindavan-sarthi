export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    pin: string;
  };
  avatar?: string;
  role: 'user' | 'admin' | 'partner';
  // Partner-specific fields
  businessName?: string;
  gstNumber?: string;
  businessType?: string;
  businessAddress?: string;
  businessPhone?: string;
  businessEmail?: string;
  businessDescription?: string;
  profileDisplayName?: string;
  profileBio?: string;
  profilePicture?: string;
  partnerStatus?: 'pending' | 'approved' | 'rejected';
  partnerDocuments?: PartnerDocument[];
  createdAt: string;
}

export interface PartnerDocument {
  name?: string;
  type?: 'aadhar_card' | 'gstin_registration' | 'property_registry_document' | 'business_license' | 'pan_card' | 'other';
  mimeType?: string;
  originalName?: string;
  sizeBytes?: number;
  storage?: 'cloudinary' | 'local' | 'external';
  url?: string;
  uploadedAt?: string;
}

export interface PartnerDocumentUpload {
  data: string;
  name: string;
  type: NonNullable<PartnerDocument['type']>;
  mimeType: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  pin: string;
  password: string;
  role?: 'user' | 'partner';
  // Partner fields
  businessName?: string;
  gstNumber?: string;
  businessType?: string;
  businessAddress?: string;
  businessPhone?: string;
  businessEmail?: string;
  businessDescription?: string;
  documents?: PartnerDocumentUpload[];
  partnerPolicyConsent?: {
    accepted: boolean;
    termsVersion: string;
    privacyVersion: string;
    source: 'partner_registration';
  };
}

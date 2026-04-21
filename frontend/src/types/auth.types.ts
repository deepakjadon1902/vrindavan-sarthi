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
  partnerStatus?: 'pending' | 'approved' | 'rejected';
  createdAt: string;
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
}

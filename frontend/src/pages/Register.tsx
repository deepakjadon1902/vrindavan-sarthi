import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { toast } from 'sonner';
import templeImg from '@/assets/images/temple-about.jpg';

const Register = () => {
  const [role, setRole] = useState<'user' | 'partner'>('user');
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', street: '', city: '', state: '', pin: '', password: '', confirmPassword: '',
    businessName: '', gstNumber: '', businessType: '', businessAddress: '', businessPhone: '', businessEmail: '', businessDescription: '',
  });
  const { register, isLoading } = useAuthStore();
  const settings = useSettingsStore((s) => s.settings);
  const navigate = useNavigate();


  const handleGoogle = () => {
    const base = import.meta.env.VITE_API_BASE_URL || '/api';
    window.location.href = `${base}/auth/google`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (formData.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (role === 'partner' && !formData.businessName) { toast.error('Business name is required for partners'); return; }

    const result = await register({
      name: formData.name, email: formData.email, phone: formData.phone,
      street: formData.street, city: formData.city, state: formData.state,
      pin: formData.pin, password: formData.password, role,
      ...(role === 'partner' ? {
        businessName: formData.businessName, gstNumber: formData.gstNumber,
        businessType: formData.businessType, businessAddress: formData.businessAddress,
        businessPhone: formData.businessPhone, businessEmail: formData.businessEmail,
        businessDescription: formData.businessDescription,
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

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 relative">
        <img src={templeImg} alt="Vrindavan Temple" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-foreground/60 flex items-center justify-center">
          <div className="text-center px-8">
            <span className="text-4xl mb-4 block">🦚</span>
            <h2 className="font-brand text-3xl text-brand-gold mb-2">{settings.siteName}</h2>
            <p className="font-heading italic text-xl text-primary-foreground/80">{settings.motto}</p>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-md py-8">
          <div className="text-center mb-6 lg:hidden">
            <span className="text-3xl">🦚</span>
            <h2 className="font-brand text-2xl text-brand-gold mt-2">{settings.siteName}</h2>
          </div>

          <h1 className="font-heading text-3xl font-semibold text-foreground mb-2">Create Account</h1>
          <p className="font-body text-muted-foreground mb-6">Join us for a divine experience</p>

          {/* Role Selection */}
          <div className="flex gap-2 mb-6">
            <button type="button" onClick={() => setRole('user')} className={`flex-1 py-3 rounded-xl font-body text-sm font-medium transition-all ${role === 'user' ? 'bg-brand-crimson text-primary-foreground shadow-md' : 'border border-border hover:bg-muted'}`}>
              🙏 User
            </button>
            <button type="button" onClick={() => setRole('partner')} className={`flex-1 py-3 rounded-xl font-body text-sm font-medium transition-all ${role === 'partner' ? 'bg-brand-gold text-foreground shadow-md' : 'border border-border hover:bg-muted'}`}>
              🏨 Partner
            </button>
          </div>

          {role === 'partner' && (
            <div className="bg-brand-cream border border-brand-gold/20 rounded-xl p-4 mb-6">
              <p className="font-body text-sm text-foreground font-medium">Register as Partner</p>
              <p className="font-body text-xs text-muted-foreground mt-1">List your hotels and rooms on {settings.siteName}. Your listings will be reviewed by admin before going live.</p>
            </div>
          )}

          <button onClick={handleGoogle} className="w-full flex items-center justify-center gap-3 border border-border rounded-xl py-3 font-body text-sm hover:bg-muted transition-colors mb-6">
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-border" />
            <span className="font-body text-xs text-muted-foreground">OR</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                  <h3 className="font-heading text-lg font-semibold text-foreground mb-4">Business Details</h3>
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
                    <option>Guest House</option>
                    <option>Dharamshala</option>
                    <option>Resort</option>
                    <option>Hostel</option>
                    <option>Homestay</option>
                    <option>Other</option>
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
              </>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Password *</label>
                <input type="password" required value={formData.password} onChange={(e) => update('password', e.target.value)} className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="••••••••" />
              </div>
              <div>
                <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Confirm Password *</label>
                <input type="password" required value={formData.confirmPassword} onChange={(e) => update('confirmPassword', e.target.value)} className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="••••••••" />
              </div>
            </div>
            <button type="submit" disabled={isLoading} className={`w-full py-3.5 rounded-xl text-sm mt-2 disabled:opacity-50 ${role === 'partner' ? 'bg-brand-gold text-foreground font-semibold hover:bg-brand-gold/90' : 'btn-crimson'}`}>
              {isLoading ? 'Creating Account...' : role === 'partner' ? 'Register as Partner' : 'Create Account'}
            </button>
          </form>

          <p className="font-body text-sm text-muted-foreground text-center mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-gold font-semibold hover:underline">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;

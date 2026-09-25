import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { toast } from 'sonner';
import templeImg from '@/assets/images/temple-about.jpg';
import PasswordInput from '@/components/shared/PasswordInput';

type StaffLoginRole = 'admin' | 'partner';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, logout } = useAuthStore();
  const settings = useSettingsStore((s) => s.settings);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const roleParam = searchParams.get('role');
  const [loginRole, setLoginRole] = useState<StaffLoginRole>(roleParam === 'admin' ? 'admin' : 'partner');
  const isPartnerLogin = loginRole === 'partner';

  useEffect(() => {
    if (roleParam === 'admin' || roleParam === 'partner') setLoginRole(roleParam);
  }, [roleParam]);

  useEffect(() => {
    const error = searchParams.get('error');
    if (!error) return;
    const message =
      error === 'google_oauth_not_configured'
        ? 'Google sign-in is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env.'
        : `Login error: ${error}`;
    toast.error(message);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await login({ email, password });
    if (result.success) {
      const user = useAuthStore.getState().user;
      if (loginRole === 'partner' && user?.role !== 'partner') {
        logout();
        toast.error('Please use a partner account to access Partner Login.');
        return;
      }
      if (loginRole === 'admin' && user?.role !== 'admin') {
        logout();
        toast.error('Please use an admin account to access Admin Login.');
        return;
      }
      if (user) {
        const displayName =
          user.role === 'partner'
            ? (user.businessName || user.name || 'Partner')
            : (user.name || (user.role === 'admin' ? 'Admin' : 'User'));
        const message =
          user.role === 'admin'
            ? `Welcome back, Admin${displayName && displayName !== 'Admin' ? ` ${displayName}` : ''}!`
            : `Welcome back, ${displayName}!`;
        toast.success(message);
      } else {
        toast.success('Welcome back!');
      }
      if (user?.role === 'partner') {
        navigate('/partner');
      } else if (user?.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } else {
      toast.error(result.error || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 relative">
        <img src={templeImg} alt="Vrindavan Temple" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-white/40 flex items-center justify-center">
          <div className="text-center px-8 bg-white/70 backdrop-blur-sm rounded-2xl py-10 border border-border">
            <span className="text-4xl mb-4 block"> </span>
            <h2 className="font-brand text-3xl text-brand-gold mb-2">{settings.siteName}</h2>
            <p className="font-heading italic text-xl text-foreground">{settings.motto}</p>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 lg:hidden">
            <span className="text-3xl"> </span>
            <h2 className="font-brand text-2xl text-brand-gold mt-2">{settings.siteName}</h2>
          </div>

          <h1 className="font-heading text-3xl font-semibold text-foreground mb-2">
            {loginRole === 'admin' ? 'Admin Login' : 'Partner Login'}
          </h1>
          <p className="font-body text-muted-foreground mb-8">
            {loginRole === 'admin'
              ? 'Sign in to manage the admin panel'
              : 'Sign in to manage your listings and bookings'}
          </p>

          <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/30 p-1">
            {([
              ['partner', 'Partner'],
              ['admin', 'Admin'],
            ] as const).map(([role, label]) => (
              <button
                key={role}
                type="button"
                onClick={() => {
                  setLoginRole(role);
                  setSearchParams({ role }, { replace: true });
                }}
                className={`min-h-11 rounded-lg font-body text-sm font-bold transition-colors ${
                  loginRole === role
                    ? 'bg-brand-crimson text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-background hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="your@email.com" />
            </div>
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Password</label>
              <PasswordInput
                required
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                placeholder="............."
              />
            </div>
            <div className="text-right">
              <Link to="/forgot-password" className="font-body text-xs text-brand-gold hover:underline">Forgot Password?</Link>
            </div>
            <button type="submit" disabled={isLoading} className="btn-crimson w-full py-3.5 rounded-xl text-sm disabled:opacity-50">
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="font-body text-sm text-muted-foreground text-center mt-6">
            {loginRole === 'partner' ? 'New partner?' : 'Need a partner account?'}{' '}
            <Link to="/register?role=partner" className="text-brand-gold font-semibold hover:underline">
              Register as Partner
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

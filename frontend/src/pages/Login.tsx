import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { toast } from 'sonner';
import templeImg from '@/assets/images/temple-about.jpg';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading } = useAuthStore();
  const settings = useSettingsStore((s) => s.settings);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const error = searchParams.get('error');
    if (!error) return;
    const message =
      error === 'google_oauth_not_configured'
        ? 'Google sign-in is not configured. Please set GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI in backend/.env.'
        : `Login error: ${error}`;
    toast.error(message);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleGoogle = () => {
    const base = import.meta.env.VITE_API_BASE_URL || '/api';
    window.location.href = `${base}/auth/google`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await login({ email, password });
    if (result.success) {
      toast.success('Welcome back! ðŸ™');
      const user = useAuthStore.getState().user;
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
        <div className="absolute inset-0 bg-foreground/60 flex items-center justify-center">
          <div className="text-center px-8">
            <span className="text-4xl mb-4 block">ðŸ¦š</span>
            <h2 className="font-brand text-3xl text-brand-gold mb-2">{settings.siteName}</h2>
            <p className="font-heading italic text-xl text-primary-foreground/80">{settings.motto}</p>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 lg:hidden">
            <span className="text-3xl">ðŸ¦š</span>
            <h2 className="font-brand text-2xl text-brand-gold mt-2">{settings.siteName}</h2>
          </div>

          <h1 className="font-heading text-3xl font-semibold text-foreground mb-2">Welcome Back</h1>
          <p className="font-body text-muted-foreground mb-8">Sign in to continue your sacred journey</p>

          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 border border-border rounded-xl py-3 font-body text-sm hover:bg-muted transition-colors mb-6"
          >
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-border" />
            <span className="font-body text-xs text-muted-foreground">OR</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="your@email.com" />
            </div>
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50" placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" />
            </div>
            <div className="text-right">
              <a href="#" className="font-body text-xs text-brand-gold hover:underline">Forgot Password?</a>
            </div>
            <button type="submit" disabled={isLoading} className="btn-crimson w-full py-3.5 rounded-xl text-sm disabled:opacity-50">
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="font-body text-sm text-muted-foreground text-center mt-6">
            New to {settings.siteName}?{' '}
            <Link to="/register" className="text-brand-gold font-semibold hover:underline">Register</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

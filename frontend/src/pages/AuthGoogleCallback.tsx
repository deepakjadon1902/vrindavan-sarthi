import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

const AuthGoogleCallback = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const token = useMemo(() => params.get('token'), [params]);
  const redirect = useMemo(() => params.get('redirect'), [params]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!token) {
        setError('Missing token');
        return;
      }

      const result = await useAuthStore.getState().completeOAuth(token);
      if (cancelled) return;

      if (!result.success) {
        setError(result.error || 'Login failed');
        return;
      }

      const user = useAuthStore.getState().user;
      if (redirect) return navigate(redirect, { replace: true });

      if (user?.role === 'partner') return navigate('/partner', { replace: true });
      if (user?.role === 'admin') return navigate('/admin', { replace: true });
      return navigate('/', { replace: true });
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [navigate, redirect, token]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 text-center">
          <h1 className="font-heading text-xl font-semibold text-foreground">Google login failed</h1>
          <p className="font-body text-sm text-muted-foreground mt-2">{error}</p>
          <button onClick={() => navigate('/login', { replace: true })} className="btn-gold px-6 py-2.5 rounded-xl text-sm mt-6">
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 text-center">
        <h1 className="font-heading text-xl font-semibold text-foreground">Signing you in…</h1>
        <p className="font-body text-sm text-muted-foreground mt-2">Please wait.</p>
      </div>
    </div>
  );
};

export default AuthGoogleCallback;

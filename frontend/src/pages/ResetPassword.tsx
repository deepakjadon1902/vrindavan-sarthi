import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import axios from 'axios';

const getApiErrorMessage = (err: unknown, fallback: string) => {
  if (axios.isAxiosError(err)) {
    const data: unknown = err.response?.data;
    const message =
      typeof data === 'object' && data !== null && 'message' in data && typeof (data as { message?: unknown }).message === 'string'
        ? String((data as { message?: unknown }).message)
        : '';
    return message || err.message || fallback;
  }
  return err instanceof Error ? (err.message || fallback) : fallback;
};

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = useMemo(() => String(searchParams.get('token') || '').trim(), [searchParams]);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return toast.error('Reset token missing. Please restart the forgot password flow.');
    if (!newPassword || newPassword.length < 6) return toast.error('Password must be at least 6 characters');
    if (newPassword !== confirmPassword) return toast.error('Passwords do not match');

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { resetToken: token, newPassword });
      toast.success('Password reset successful. Please login with your new password.');
      navigate('/login');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to reset password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-background">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6">
        <h1 className="font-heading text-2xl font-semibold text-foreground">Reset Password</h1>
        <p className="font-body text-sm text-muted-foreground mt-1">Set a new password for your account.</p>

        <form onSubmit={handleReset} className="mt-6 space-y-4">
          <div>
            <label className="font-body text-sm font-medium text-foreground mb-1.5 block">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
              placeholder="Enter new password"
            />
          </div>
          <div>
            <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
              placeholder="Confirm new password"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-crimson w-full py-3.5 rounded-xl text-sm disabled:opacity-50">
            {loading ? 'Saving…' : 'Save New Password'}
          </button>
        </form>

        <p className="font-body text-sm text-muted-foreground text-center mt-6">
          <Link to="/login" className="text-brand-gold font-semibold hover:underline">Back to Login</Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;

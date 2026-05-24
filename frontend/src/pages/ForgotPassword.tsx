import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useSettingsStore } from '@/store/settingsStore';
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

const ForgotPassword = () => {
  const settings = useSettingsStore((s) => s.settings);
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizedEmail) return toast.error('Please enter your email');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: normalizedEmail });
      toast.success('OTP sent to your email');
      setStep('otp');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to send OTP'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizedEmail) return toast.error('Please enter your email');
    if (!otp.trim()) return toast.error('Please enter the OTP');
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-reset-otp', { email: normalizedEmail, otp: otp.trim() });
      const resetToken = res.data?.resetToken;
      if (!resetToken) {
        toast.error('OTP verification failed');
        return;
      }
      toast.success('OTP verified');
      navigate(`/reset-password?token=${encodeURIComponent(resetToken)}`);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Invalid OTP'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-background">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6">
        <h1 className="font-heading text-2xl font-semibold text-foreground">Forgot Password</h1>
        <p className="font-body text-sm text-muted-foreground mt-1">
          {step === 'email'
            ? 'Enter your registered email to receive an OTP.'
            : 'Enter the OTP sent to your email to verify.'}
        </p>

        {step === 'email' ? (
          <form onSubmit={handleSendOtp} className="mt-6 space-y-4">
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                placeholder="your@email.com"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-crimson w-full py-3.5 rounded-xl text-sm disabled:opacity-50">
              {loading ? 'Sending…' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="mt-6 space-y-4">
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                placeholder="your@email.com"
              />
            </div>
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">OTP</label>
              <input
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-border bg-card font-body text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
                placeholder="6-digit OTP"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => { setStep('email'); setOtp(''); }}
                className="px-4 py-3 rounded-xl border border-border font-body text-sm hover:bg-muted transition-colors"
              >
                Back
              </button>
              <button type="submit" disabled={loading} className="btn-crimson flex-1 py-3.5 rounded-xl text-sm disabled:opacity-50">
                {loading ? 'Verifying…' : 'Verify OTP'}
              </button>
            </div>
          </form>
        )}

        <p className="font-body text-sm text-muted-foreground text-center mt-6">
          Back to{' '}
          <Link to="/login" className="text-brand-gold font-semibold hover:underline">Login</Link>
          {settings.siteName ? ` • ${settings.siteName}` : ''}
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;

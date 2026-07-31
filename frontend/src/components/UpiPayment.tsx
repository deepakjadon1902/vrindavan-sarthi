import { useState } from 'react';
import { CheckCircle, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { useSettingsStore } from '@/store/settingsStore';

interface UpiPaymentProps {
  amount: number;
  bookingId: string;
  itemName: string;
  onPaymentConfirm: (transactionId: string) => void;
  onCancel: () => void;
}

const UpiPayment = ({ amount, bookingId, itemName, onPaymentConfirm, onCancel }: UpiPaymentProps) => {
  const { settings } = useSettingsStore();
  const [step, setStep] = useState<'qr' | 'confirm'>('qr');
  const [transactionId, setTransactionId] = useState('');

  const upiLink = `upi://pay?pa=${settings.upiId}&pn=${encodeURIComponent(settings.upiName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(`${bookingId} - ${itemName}`)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiLink)}`;

  const copyUpiId = () => {
    void navigator.clipboard.writeText(settings.upiId);
    toast.success('UPI ID copied');
  };

  const handleConfirm = () => {
    if (!transactionId.trim()) {
      toast.error('Please enter your UPI Transaction ID');
      return;
    }
    onPaymentConfirm(transactionId.trim());
  };

  if (!settings.upiId) {
    return (
      <div className="premium-surface p-6 text-center">
        <p className="font-body text-sm text-destructive">Payment is not configured. Please contact admin.</p>
        <button onClick={onCancel} className="mt-4 rounded-lg border border-border px-4 py-2 font-body text-sm hover:bg-muted">Go Back</button>
      </div>
    );
  }

  return (
    <div className="premium-surface space-y-5 p-5 sm:p-6">
      <div>
        <p className="premium-kicker">Secure UPI Payment</p>
        <h3 className="mt-1 font-heading text-2xl font-bold text-foreground">Pay and Submit Reference</h3>
        <p className="mt-1 font-body text-sm text-muted-foreground">Scan the QR code, then enter the transaction reference for verification.</p>
      </div>

      {step === 'qr' && (
        <>
          <div className="rounded-lg border border-border bg-white p-5 text-center">
            <img src={qrUrl} alt="UPI QR Code" className="mx-auto rounded-lg border border-border" />
            <div className="mt-4 space-y-1">
              <p className="font-heading text-2xl font-bold text-brand-crimson">Rs. {amount.toLocaleString('en-IN')}</p>
              <p className="font-body text-xs text-muted-foreground">{bookingId}</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/60 px-4 py-3">
            <span className="min-w-0 truncate font-body text-sm text-secondary-foreground">
              UPI: <strong>{settings.upiId}</strong>
            </span>
            <button type="button" onClick={copyUpiId} className="premium-icon-button h-8 w-8 shrink-0" aria-label="Copy UPI ID">
              <Copy size={14} />
            </button>
          </div>

          <div className="border-t border-border pt-4">
            <div className="grid grid-cols-2 gap-3 font-body text-sm">
              <div><span className="text-muted-foreground">Item</span><span className="block truncate font-medium text-foreground">{itemName}</span></div>
              <div><span className="text-muted-foreground">Amount</span><span className="block font-bold text-brand-crimson">Rs. {amount.toLocaleString('en-IN')}</span></div>
              <div><span className="text-muted-foreground">Pay to</span><span className="block text-foreground">{settings.upiName}</span></div>
              <div><span className="text-muted-foreground">Booking</span><span className="block text-foreground">{bookingId}</span></div>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('confirm')} className="btn-crimson flex-1 rounded-lg py-3 text-sm inline-flex items-center justify-center gap-2">
              <CheckCircle size={16} /> Payment Done
            </button>
            <button onClick={onCancel} className="rounded-lg border border-border px-4 py-3 font-body text-sm transition-colors hover:bg-muted">
              Cancel
            </button>
          </div>
        </>
      )}

      {step === 'confirm' && (
        <>
          <div className="rounded-lg border border-brand-gold/25 bg-brand-cream p-4">
            <p className="font-body text-sm text-foreground">Enter the UPI transaction ID or reference number after payment.</p>
          </div>

          <div>
            <label className="mb-1.5 block font-body text-sm font-medium text-foreground">UPI Transaction ID *</label>
            <input
              type="text"
              required
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-4 py-3 font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
              placeholder="Enter UPI reference number"
            />
          </div>

          <div className="rounded-lg border border-border bg-muted/60 p-4 font-body text-sm">
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">Amount Paid</span><span className="font-bold text-brand-crimson">Rs. {amount.toLocaleString('en-IN')}</span></div>
            <div className="mt-1 flex justify-between gap-3"><span className="text-muted-foreground">Paid To</span><span className="truncate">{settings.upiId}</span></div>
          </div>

          <div className="flex gap-3">
            <button onClick={handleConfirm} className="btn-gold flex-1 rounded-lg py-3 text-sm inline-flex items-center justify-center gap-2">
              <CheckCircle size={16} /> Confirm Payment
            </button>
            <button onClick={() => setStep('qr')} className="rounded-lg border border-border px-4 py-3 font-body text-sm transition-colors hover:bg-muted">
              Back
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default UpiPayment;

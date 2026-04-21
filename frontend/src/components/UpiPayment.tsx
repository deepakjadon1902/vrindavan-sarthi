import { useState } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { CheckCircle, Copy, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

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
    navigator.clipboard.writeText(settings.upiId);
    toast.success('UPI ID copied!');
  };

  const handleConfirm = () => {
    if (!transactionId.trim()) {
      toast.error('Please enter your UPI Transaction ID');
      return;
    }
    onPaymentConfirm(transactionId);
  };

  if (!settings.upiId) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 text-center">
        <p className="font-body text-sm text-destructive">Payment not configured. Please contact admin.</p>
        <button onClick={onCancel} className="mt-4 px-4 py-2 rounded-lg text-sm border border-border font-body hover:bg-muted">Go Back</button>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-6">
      <div className="text-center">
        <h3 className="font-heading text-xl font-bold text-foreground">UPI Payment</h3>
        <p className="font-body text-sm text-muted-foreground mt-1">Scan QR code to pay</p>
      </div>

      {step === 'qr' && (
        <>
          <div className="bg-muted rounded-xl p-6 text-center">
            <img src={qrUrl} alt="UPI QR Code" className="mx-auto rounded-lg border-4 border-background shadow-lg" />
            <div className="mt-4 space-y-2">
              <p className="font-heading text-2xl font-bold text-brand-crimson">₹{amount.toLocaleString('en-IN')}</p>
              <p className="font-body text-xs text-muted-foreground">{bookingId}</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 bg-secondary rounded-lg px-4 py-3">
            <span className="font-body text-sm text-secondary-foreground">UPI: <strong>{settings.upiId}</strong></span>
            <button onClick={copyUpiId} className="p-1 rounded hover:bg-muted transition-colors"><Copy size={14} /></button>
          </div>

          {/* UPI App Icons */}
          <div className="text-center">
            <p className="font-body text-xs text-muted-foreground mb-3">Pay using any UPI app</p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              {['Google Pay', 'PhonePe', 'Paytm', 'BHIM', 'Amazon Pay', 'RuPay'].map((app) => (
                <div key={app} className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <Smartphone size={16} className="text-muted-foreground" />
                  </div>
                  <span className="font-body text-[10px] text-muted-foreground">{app}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <div className="grid grid-cols-2 gap-3 font-body text-sm">
              <div><span className="text-muted-foreground">Item:</span> <span className="text-foreground font-medium block truncate">{itemName}</span></div>
              <div><span className="text-muted-foreground">Amount:</span> <span className="text-brand-crimson font-bold block">₹{amount.toLocaleString('en-IN')}</span></div>
              <div><span className="text-muted-foreground">Pay to:</span> <span className="text-foreground block">{settings.upiName}</span></div>
              <div><span className="text-muted-foreground">Booking:</span> <span className="text-foreground block">{bookingId}</span></div>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('confirm')} className="btn-crimson flex-1 py-3 rounded-xl text-sm flex items-center justify-center gap-2">
              <CheckCircle size={16} /> I've Made the Payment
            </button>
            <button onClick={onCancel} className="px-4 py-3 rounded-xl text-sm border border-border font-body hover:bg-muted transition-colors">
              Cancel
            </button>
          </div>
        </>
      )}

      {step === 'confirm' && (
        <>
          <div className="bg-brand-cream border border-brand-gold/20 rounded-xl p-4">
            <p className="font-body text-sm text-foreground">Please enter your UPI Transaction ID / Reference Number to confirm payment.</p>
          </div>

          <div>
            <label className="font-body text-sm font-medium text-foreground mb-1.5 block">UPI Transaction ID *</label>
            <input
              type="text"
              required
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
              placeholder="Enter 12-digit UPI reference number"
            />
          </div>

          <div className="bg-muted rounded-lg p-4 font-body text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Amount Paid:</span><span className="font-bold text-brand-crimson">₹{amount.toLocaleString('en-IN')}</span></div>
            <div className="flex justify-between mt-1"><span className="text-muted-foreground">Paid To:</span><span>{settings.upiId}</span></div>
          </div>

          <div className="flex gap-3">
            <button onClick={handleConfirm} className="btn-gold flex-1 py-3 rounded-xl text-sm flex items-center justify-center gap-2">
              <CheckCircle size={16} /> Confirm Payment
            </button>
            <button onClick={() => setStep('qr')} className="px-4 py-3 rounded-xl text-sm border border-border font-body hover:bg-muted transition-colors">
              Back
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default UpiPayment;

import { useAuthStore } from '@/store/authStore';
import { useBookingStore } from '@/store/bookingStore';
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  IndianRupee,
  Eye,
  Building2,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Receipt,
  AlertCircle,
} from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { api, withAuth } from '@/lib/api';
import RecordPagination, { useRecordPagination } from '@/components/shared/RecordPagination';

interface FinancialStatementSummary {
  grossTariff: number;
  gstCollected: number;
  platformCommission: number;
  onlineReceived: number;
  deskCollected: number;
  balanceAtDesk: number;
  completedStayEntitlement?: number;
  breakageEntitlement?: number;
  partnerNetEntitlement: number;
  netPayableRemittance: number;
  settledAmount: number;
  minimumThreshold: number;
  eligibleForPayout: boolean;
  rolloverAmount: number;
  payoutCycleDays: string[];
  isPayoutCycleToday: boolean;
  nextPayoutCycle: string;
}


interface CancellationBreakageRow {
  id: string;
  bookingId: string;
  customerName: string;
  propertyName: string;
  bookingType: string;
  cancellationReason: string;
  payoutStatus: string;
  retainedAdvance: number;
  roomAdvancePortion: number;
  platformCommission: number;
  partnerBreakageEntitlement: number;
  platformBreakageRetained: number;
  settledAt?: string | null;
  cancelledAt: string;
  createdAt: string;
}

interface FinancialStatementLedgerRow {
  id: string;
  bookingId: string;
  customerName: string;
  customerPhone?: string;
  propertyName: string;
  bookingType: string;
  checkIn?: string;
  checkOut?: string;
  bookingStatus: string;
  paymentStatus: string;
  paymentOption: string;
  payoutStatus: string;
  grossTariff: number;
  taxAmount: number;
  platformCommission: number;
  onlinePaid: number;
  deskCollected: number;
  balanceAtDesk: number;
  netEntitlement: number;
  netRemittance: number;
  settledAt?: string | null;
  createdAt: string;
}

const PartnerPayments = () => {
  const { user, token } = useAuthStore();
  const { partnerBookings, fetchPartnerBookings } = useBookingStore();
  const [statementSummary, setStatementSummary] = useState<FinancialStatementSummary | null>(null);
  const [statementLedger, setStatementLedger] = useState<FinancialStatementLedgerRow[]>([]);
  const [cancellationBreakage, setCancellationBreakage] = useState<CancellationBreakageRow[]>([]);
  const [bankDetails, setBankDetails] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'checked_out' | 'settled'>('all');
  const [selectedUpi, setSelectedUpi] = useState<string | null>(null);

  const loadFinancialStatement = async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const res = await api.get('/partner/financial-statement', withAuth(token));
      const data = res.data?.data;
      if (data) {
        setStatementSummary(data.summary || null);
        setStatementLedger(Array.isArray(data.ledger) ? data.ledger : []);
        setCancellationBreakage(Array.isArray(data.cancellationBreakage) ? data.cancellationBreakage : []);
        setBankDetails(data.bankDetails || null);
      }
    } catch {
      // Fallback handled via existing booking store
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    void fetchPartnerBookings();
    void loadFinancialStatement();
  }, [fetchPartnerBookings, user, token]);

  // If backend statement ledger is available, use it; otherwise fallback to store bookings
  const rows = useMemo(() => {
    if (statementLedger.length > 0) {
      return statementLedger;
    }
    return partnerBookings.map((b) => {
      const gross = Number(b.grossForHotel || (Number(b.baseAmount || 0) + Number(b.taxAmount || 0)) || b.totalAmount || 0);
      const tax = Number(b.taxAmount || 0);
      const commPercent = Number(b.platformCommissionPercent || 0);
      const comm = Number(b.platformCommissionAmount || Math.round((gross * commPercent) / 100));
      const netEntitlement = Math.max(0, gross - comm);
      const deskPaid = Number(b.amountPaidToProperty || 0);
      const onlinePaid = Number(b.amountPaidOnline || b.advanceAmount || 0);
      const netRemittance = Math.max(0, netEntitlement - deskPaid);

      return {
        id: b.id,
        bookingId: b.bookingId,
        customerName: b.customerFullName || b.userName || 'Guest',
        customerPhone: b.userPhone || '',
        propertyName: b.itemName || 'Property',
        bookingType: b.bookingType || 'hotel',
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        bookingStatus: b.bookingStatus,
        paymentStatus: b.paymentStatus,
        paymentOption: b.paymentOption || 'full_online',
        payoutStatus: b.payout_status || 'pending',
        grossTariff: gross,
        taxAmount: tax,
        platformCommission: comm,
        onlinePaid,
        deskCollected: deskPaid,
        balanceAtDesk: Number(b.balanceAmount || b.amountPayableAtProperty || 0),
        netEntitlement,
        netRemittance,
        createdAt: b.createdAt,
      } as FinancialStatementLedgerRow;
    });
  }, [statementLedger, partnerBookings]);

  const filtered = rows.filter((r) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') return r.paymentStatus === 'pending';
    if (statusFilter === 'paid') return r.paymentStatus === 'paid';
    if (statusFilter === 'checked_out') return r.bookingStatus === 'checked_out';
    if (statusFilter === 'settled') return r.payoutStatus === 'settled';
    return true;
  });

  const { page, setPage, pageItems } = useRecordPagination(filtered, [statusFilter]);

  const summary = statementSummary || {
    grossTariff: rows.reduce((s, r) => s + r.grossTariff, 0),
    gstCollected: rows.reduce((s, r) => s + r.taxAmount, 0),
    platformCommission: rows.reduce((s, r) => s + r.platformCommission, 0),
    onlineReceived: rows.reduce((s, r) => s + r.onlinePaid, 0),
    deskCollected: rows.reduce((s, r) => s + r.deskCollected, 0),
    balanceAtDesk: rows.reduce((s, r) => s + r.balanceAtDesk, 0),
    partnerNetEntitlement: rows.reduce((s, r) => s + r.netEntitlement, 0),
    netPayableRemittance: rows.filter((r) => r.bookingStatus === 'checked_out' && r.payoutStatus !== 'settled').reduce((s, r) => s + r.netRemittance, 0),
    settledAmount: rows.filter((r) => r.payoutStatus === 'settled').reduce((s, r) => s + r.netRemittance, 0),
    minimumThreshold: 1000,
    eligibleForPayout: false,
    rolloverAmount: 0,
    payoutCycleDays: ['Monday', 'Wednesday'],
    isPayoutCycleToday: false,
    nextPayoutCycle: 'Bi-weekly on Monday & Wednesday',
  };

  const isEligible = summary.netPayableRemittance >= summary.minimumThreshold;

  const paymentIcon = (s: string) => {
    if (s === 'paid') return <CheckCircle2 size={14} className="text-brand-green" />;
    if (s === 'failed') return <XCircle size={14} className="text-destructive" />;
    return <Clock size={14} className="text-brand-saffron" />;
  };

  return (
    <div className="space-y-6">
      {/* ── Summary Financial Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total Gross Tariff */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Building2 size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="font-body text-xs text-muted-foreground">Gross Booking Volume</p>
              <p className="font-heading text-xl font-bold text-foreground">
                ₹{summary.grossTariff.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
          <p className="font-body text-[10px] text-muted-foreground">Includes room tariff &amp; hotel GST</p>
        </div>

        {/* Total Partner Net Entitlement */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-brand-green/10 flex items-center justify-center">
              <IndianRupee size={18} className="text-brand-green" />
            </div>
            <div>
              <p className="font-body text-xs text-muted-foreground">Net Partner Earnings</p>
              <p className="font-heading text-xl font-bold text-brand-green">
                ₹{summary.partnerNetEntitlement.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
          <p className="font-body text-[10px] text-muted-foreground">
            After platform commission (fees absorbed)
          </p>
        </div>

        {/* Retained at Property Desk */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <ArrowDownLeft size={18} className="text-amber-600" />
            </div>
            <div>
              <p className="font-body text-xs text-muted-foreground">Direct Desk Collected</p>
              <p className="font-heading text-xl font-bold text-foreground">
                ₹{summary.deskCollected.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
          <p className="font-body text-[10px] text-muted-foreground">Cash/UPI kept at front desk</p>
        </div>

        {/* Settled Remittance to Bank */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Wallet size={18} className="text-indigo-600" />
            </div>
            <div>
              <p className="font-body text-xs text-muted-foreground">Settled to Bank</p>
              <p className="font-heading text-xl font-bold text-foreground">
                ₹{summary.settledAmount.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
          <p className="font-body text-[10px] text-muted-foreground">Disbursed to bank account</p>
        </div>
      </div>

      {/* ── Settlement Rule & Remittance Status Banner ── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-body text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Settlement Schedule &amp; Policy
              </span>
              <span className="rounded bg-brand-gold/15 px-2 py-0.5 text-[10px] font-semibold text-brand-gold">
                Automated Bi-Weekly
              </span>
            </div>
            <p className="font-heading text-lg font-bold text-foreground">
              Disbursement Cycles: Monday and Wednesday
            </p>
            <p className="font-body text-xs text-muted-foreground mt-0.5">
              Settlements are processed automatically for checked-out reservations when net payable reaches ₹1,000.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-background p-4 text-left sm:text-right min-w-[220px]">
            <p className="font-body text-xs text-muted-foreground">Pending Remittance Balance</p>
            <p className="font-heading text-2xl font-bold text-foreground mt-0.5">
              ₹{summary.netPayableRemittance.toLocaleString('en-IN')}
            </p>
            <div className="mt-1 flex items-center justify-start sm:justify-end gap-1.5">
              {isEligible ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-green">
                  <CheckCircle2 size={13} /> Eligible for next payout
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                  <AlertCircle size={13} /> Below ₹1,000 threshold (Rolls over)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bank details preview */}
        {bankDetails?.account_number && (
          <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-center gap-4 text-xs font-body">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <ShieldCheck size={14} className="text-brand-green" /> Disbursing to:
            </span>
            <span className="font-semibold text-foreground">{bankDetails.bank_name}</span>
            <span className="text-muted-foreground">
              Account: ••••{String(bankDetails.account_number).slice(-4)}
            </span>
            <span className="text-muted-foreground">IFSC: {bankDetails.ifsc_code}</span>
            <span className="text-muted-foreground">Beneficiary: {bankDetails.account_holder_name}</span>
          </div>
        )}
      </div>

      {/* ── Status Filters ── */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: 'All Transactions', count: rows.length },
          { key: 'checked_out', label: 'Checked Out', count: rows.filter((r) => r.bookingStatus === 'checked_out').length },
          { key: 'paid', label: 'Paid Online', count: rows.filter((r) => r.paymentStatus === 'paid').length },
          { key: 'pending', label: 'Payment Pending', count: rows.filter((r) => r.paymentStatus === 'pending').length },
          { key: 'settled', label: 'Settled to Bank', count: rows.filter((r) => r.payoutStatus === 'settled').length },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key as any)}
            className={`px-3.5 py-2 rounded-lg font-body text-xs capitalize transition-colors ${
              statusFilter === f.key
                ? 'bg-brand-crimson text-primary-foreground font-semibold shadow-sm'
                : 'bg-card border border-border hover:bg-muted text-foreground'
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {selectedUpi && (
        <div className="bg-brand-cream border border-brand-gold/30 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-body text-xs text-muted-foreground">Payment Reference</p>
            <p className="font-heading text-lg font-bold text-foreground">{selectedUpi}</p>
          </div>
          <button
            onClick={() => setSelectedUpi(null)}
            className="px-3 py-1 rounded-lg text-xs border border-border font-body hover:bg-muted"
          >
            Close
          </button>
        </div>
      )}


      {/* ── Cancellation Breakage Entitlements ── */}
      {cancellationBreakage.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-border">
            <div>
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-brand-crimson" />
                <h2 className="font-heading text-base font-bold text-foreground">
                  Voluntary Cancellation Breakage Entitlements
                </h2>
                <span className="rounded bg-brand-crimson/10 px-2 py-0.5 text-[10px] font-semibold text-brand-crimson">
                  Option B Accounting
                </span>
              </div>
              <p className="font-body text-xs text-muted-foreground mt-0.5">
                Breakage settlement on retained 30% advance deposits following customer voluntary cancellations.
              </p>
            </div>
            <div className="text-right">
              <span className="font-body text-xs text-muted-foreground">Total Breakage Earnings: </span>
              <span className="font-heading text-base font-bold text-brand-green">
                ₹{cancellationBreakage.reduce((s, b) => s + (b.partnerBreakageEntitlement || 0), 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {cancellationBreakage.map((b) => (
              <div key={b.id} className="rounded-lg border border-border bg-background p-3.5 text-xs font-body">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-brand-crimson">{b.bookingId}</span>
                      <span className="text-[10px] bg-secondary px-2 py-0.5 rounded capitalize">{b.bookingType}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                        b.payoutStatus === 'settled'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-purple-50 text-purple-700 border border-purple-200'
                      }`}>
                        {b.payoutStatus === 'settled' ? 'Settled to Bank' : 'Pending Breakage Settlement'}
                      </span>
                    </div>
                    <p className="font-heading text-sm font-semibold text-foreground mt-1">{b.propertyName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Guest: {b.customerName} • Cancelled: {new Date(b.cancelledAt).toLocaleDateString()} ({b.cancellationReason})
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-heading text-base font-bold text-brand-green">
                      ₹{b.partnerBreakageEntitlement.toLocaleString('en-IN')}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Partner Net Breakage</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/60 text-[11px]">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Retained Online Advance</span>
                    <span className="font-semibold text-foreground">₹{b.retainedAdvance.toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Room Advance Portion</span>
                    <span className="font-semibold text-foreground">₹{b.roomAdvancePortion.toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Platform Breakage Fee</span>
                    <span className="font-semibold text-destructive">-₹{b.platformCommission.toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Net Payable to Partner</span>
                    <span className="font-bold text-brand-green">₹{b.partnerBreakageEntitlement.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Itemized Ledger List ── */}
      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <CreditCard size={48} className="mx-auto mb-4 text-muted-foreground/30" />
          <p className="font-heading text-xl text-foreground mb-2">No Transactions Found</p>
          <p className="font-body text-sm text-muted-foreground">
            Transactions and audited ledgers for your properties will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pageItems.map((r) => (
            <div key={r.id} className="bg-card rounded-xl border border-border p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-body text-xs font-bold text-brand-crimson">{r.bookingId}</span>
                    <span className="font-body text-[10px] bg-secondary px-2 py-0.5 rounded capitalize">
                      {r.bookingType}
                    </span>
                    <span
                      className={`font-body text-[10px] px-2 py-0.5 rounded font-medium ${
                        r.payoutStatus === 'settled'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : r.bookingStatus === 'checked_out'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {r.payoutStatus === 'settled' ? 'Settled to Bank' : r.bookingStatus === 'checked_out' ? 'Remittance Pending' : 'Stay Active'}
                    </span>
                  </div>
                  <p className="font-heading text-sm font-semibold text-foreground truncate">{r.propertyName}</p>
                  <p className="font-body text-xs text-muted-foreground mt-0.5">
                    Guest: {r.customerName} {r.customerPhone ? `• ${r.customerPhone}` : ''}
                  </p>
                  {r.checkIn && (
                    <p className="font-body text-[11px] text-muted-foreground mt-0.5">
                      Stay: {new Date(r.checkIn).toLocaleDateString()} {r.checkOut ? `→ ${new Date(r.checkOut).toLocaleDateString()}` : ''}
                    </p>
                  )}
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="font-heading text-lg font-bold text-brand-green">
                    ₹{r.netEntitlement.toLocaleString('en-IN')}
                  </p>
                  <p className="font-body text-[10px] text-muted-foreground">Net Partner Entitlement</p>
                  <span className="flex items-center gap-1 font-body text-xs capitalize justify-end mt-1 font-medium">
                    {paymentIcon(r.paymentStatus)} {r.paymentStatus}
                  </span>
                </div>
              </div>

              {/* 4-Column Itemized Math Card */}
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2 rounded-lg border border-brand-gold/20 bg-brand-cream/60 p-3 font-body text-xs">
                <div>
                  <span className="block text-muted-foreground text-[10px]">Gross Tariff</span>
                  <span className="font-semibold text-foreground">₹{r.grossTariff.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="block text-muted-foreground text-[10px]">Hotel GST (Included)</span>
                  <span className="font-semibold text-foreground">₹{r.taxAmount.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="block text-muted-foreground text-[10px]">Platform Commission</span>
                  <span className="font-semibold text-destructive">-₹{r.platformCommission.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="block text-muted-foreground text-[10px]">Desk Collected</span>
                  <span className="font-semibold text-amber-600">₹{r.deskCollected.toLocaleString('en-IN')}</span>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="block text-muted-foreground text-[10px]">Net Platform Remittance</span>
                  <span className="font-bold text-brand-green">₹{r.netRemittance.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          ))}
          <RecordPagination page={page} total={filtered.length} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
};

export default PartnerPayments;

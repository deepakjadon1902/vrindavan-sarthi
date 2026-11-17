import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Lock,
  ArrowRight,
  Send,
  Building,
  RefreshCw,
  FileText,
  CreditCard,
  BedDouble,
  DollarSign,
  Calendar,
  ShieldCheck,
  Camera,
  Compass,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { getApiErrorMessage } from '@/lib/apiError';

export interface OnboardingStep {
  key: string;
  stepNumber: number;
  title: string;
  status: 'completed' | 'pending' | 'needs_correction' | 'locked';
  missingDetails: string[];
  actionLabel: string;
  actionUrl: string;
  correctionReason?: string;
  updatedAt?: string | null;
}

export interface OnboardingReminder {
  id: string;
  type: 'info' | 'warning' | 'danger';
  title: string;
  message: string;
  actionLabel: string;
  actionUrl: string;
}

export interface OnboardingStatusData {
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  partnerStatus: string;
  hotel: {
    _id: string;
    name: string;
    propertyType: string;
    approvalStatus: string;
    status: string;
    partnerSubmitted: boolean;
    adminRemarks?: string;
  } | null;
  roomTypesCount: number;
  roomUnitsCount: number;
  overallProgressPercent: number;
  completedStepsCount: number;
  totalStepsCount: number;
  nextActionStep: string;
  nextActionTitle: string;
  nextActionUrl: string;
  isReadyForSubmission: boolean;
  isApproved: boolean;
  steps: OnboardingStep[];
  reminders: OnboardingReminder[];
  evaluatedAt: string;
}

interface PartnerSetupChecklistProps {
  onStatusChange?: (data: OnboardingStatusData) => void;
}

export const PartnerSetupChecklist: React.FC<PartnerSetupChecklistProps> = ({ onStatusChange }) => {
  const token = useAuthStore((s) => s.token);
  const [data, setData] = useState<OnboardingStatusData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchStatus = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const res = await api.get('/partner/onboarding-status', withAuth(token));
      if (res.data?.success && res.data?.data) {
        setData(res.data.data);
        onStatusChange?.(res.data.data);
      }
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to fetch onboarding status'));
    } finally {
      setIsLoading(false);
    }
  }, [token, onStatusChange]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const handleSubmitForReview = async () => {
    if (!token || !data?.hotel?._id) return;
    try {
      setIsSubmitting(true);
      const res = await api.post(
        '/partner/submit-property',
        { hotelId: data.hotel._id },
        withAuth(token)
      );
      if (res.data?.success) {
        toast.success(res.data?.message || 'Property submitted for admin review!');
        await fetchStatus();
      }
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Submission failed. Please check missing checklist items.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading && !data) {
    return (
      <div className="bg-card rounded-2xl border border-border p-8 text-center animate-pulse">
        <div className="h-6 w-1/3 bg-muted rounded mx-auto mb-4" />
        <div className="h-4 w-1/2 bg-muted rounded mx-auto" />
      </div>
    );
  }

  if (!data) return null;

  const getStepIcon = (key: string) => {
    switch (key) {
      case 'registration':
        return <UserCheck size={18} />;
      case 'kyc_documents':
        return <FileText size={18} />;
      case 'bank_details':
        return <CreditCard size={18} />;
      case 'property_creation':
        return <Building size={18} />;
      case 'property_info':
        return <Compass size={18} />;
      case 'property_photos':
        return <Camera size={18} />;
      case 'room_categories':
        return <BedDouble size={18} />;
      case 'physical_inventory':
        return <BedDouble size={18} />;
      case 'room_pricing':
        return <DollarSign size={18} />;
      case 'availability':
        return <Calendar size={18} />;
      case 'property_policies':
        return <FileText size={18} />;
      case 'final_review':
        return <ShieldCheck size={18} />;
      case 'admin_submission':
        return <Send size={18} />;
      default:
        return <Building size={18} />;
    }
  };

  const getStatusBadge = (status: OnboardingStep['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 size={13} /> Completed
          </span>
        );
      case 'needs_correction':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20 animate-pulse">
            <AlertTriangle size={13} /> Needs Correction
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock size={13} /> Pending
          </span>
        );
      case 'locked':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
            <Lock size={13} /> Locked
          </span>
        );
    }
  };

  const nextStep = data.steps.find((s) => s.key === data.nextActionStep);

  return (
    <div className="space-y-6">
      {/* ── Progress & Overview Header ── */}
      <div className="bg-gradient-to-br from-card to-brand-cream/30 dark:to-card/50 rounded-2xl border border-brand-gold/30 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold tracking-widest uppercase text-brand-gold">
                Partner Onboarding System
              </span>
              {data.isApproved ? (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-600 border border-emerald-500/30">
                  Listing Live
                </span>
              ) : data.hotel?.partnerSubmitted ? (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-600 border border-amber-500/30">
                  Under Admin Review
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-500/20 text-blue-600 border border-blue-500/30">
                  Setup In Progress
                </span>
              )}
            </div>
            <h2 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
              {data.hotel?.name ? `${data.hotel.name} — Readiness Checklist` : 'Property Listing Setup Checklist'}
            </h2>
            <p className="font-body text-xs sm:text-sm text-muted-foreground mt-0.5">
              Complete all 13 checklist steps to submit your property for verification and accept bookings.
            </p>
          </div>

          <div className="flex items-center gap-4 self-start sm:self-center">
            <div className="text-right">
              <div className="font-heading text-2xl sm:text-3xl font-extrabold text-foreground">
                {data.overallProgressPercent}%
              </div>
              <div className="font-body text-[11px] text-muted-foreground">
                {data.completedStepsCount} of {data.totalStepsCount} Steps Done
              </div>
            </div>
            <button
              onClick={() => void fetchStatus()}
              disabled={isLoading}
              title="Refresh Checklist"
              className="p-2.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative w-full h-3 bg-muted rounded-full overflow-hidden border border-border">
          <div
            className={`h-full transition-all duration-700 ease-out rounded-full ${
              data.overallProgressPercent === 100
                ? 'bg-emerald-500'
                : data.overallProgressPercent >= 60
                ? 'bg-brand-gold'
                : 'bg-brand-saffron'
            }`}
            style={{ width: `${Math.max(4, data.overallProgressPercent)}%` }}
          />
        </div>
      </div>

      {/* ── In-App Reminder Banners ── */}
      {data.reminders.length > 0 && (
        <div className="space-y-3">
          {data.reminders.map((rem) => {
            const isDanger = rem.type === 'danger';
            const isWarning = rem.type === 'warning';
            return (
              <div
                key={rem.id}
                className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border ${
                  isDanger
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200'
                    : isWarning
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
                    : 'bg-blue-500/10 border-blue-500/30 text-blue-900 dark:text-blue-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {isDanger ? (
                      <AlertTriangle size={18} className="text-rose-600" />
                    ) : isWarning ? (
                      <Clock size={18} className="text-amber-600" />
                    ) : (
                      <ShieldCheck size={18} className="text-blue-600" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-heading text-sm font-bold">{rem.title}</h4>
                    <p className="font-body text-xs opacity-90 mt-0.5">{rem.message}</p>
                  </div>
                </div>

                {rem.actionUrl && (
                  <Link
                    to={rem.actionUrl}
                    className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-card text-foreground hover:bg-muted border border-border shadow-sm transition-colors"
                  >
                    {rem.actionLabel}
                    <ArrowRight size={13} />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Next Action Hero Card ── */}
      {nextStep && !data.isApproved && (
        <div className="rounded-xl border border-brand-gold/40 bg-card p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="font-body text-[10px] font-extrabold uppercase tracking-widest text-brand-gold">
                Recommended Next Step
              </span>
              <h3 className="font-heading text-lg font-bold text-foreground mt-0.5">
                Step {nextStep.stepNumber}: {nextStep.title}
              </h3>
              {nextStep.missingDetails.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {nextStep.missingDetails.map((detail, idx) => (
                    <li key={idx} className="font-body text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-saffron" />
                      {detail}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {nextStep.key === 'admin_submission' ? (
              <button
                onClick={() => void handleSubmitForReview()}
                disabled={isSubmitting || !data.isReadyForSubmission}
                className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-heading text-sm font-bold bg-brand-gold text-brand-black hover:bg-brand-gold/90 disabled:opacity-50 transition-all shadow-md"
              >
                <Send size={15} />
                {isSubmitting ? 'Submitting...' : 'Submit for Admin Review'}
              </button>
            ) : (
              <Link
                to={nextStep.actionUrl}
                className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-heading text-sm font-bold bg-brand-gold text-brand-black hover:bg-brand-gold/90 transition-all shadow-md"
              >
                {nextStep.actionLabel}
                <ArrowRight size={15} />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── 13-Step Interactive Checklist ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-base font-bold text-foreground">
            Complete Onboarding Steps
          </h3>
          <span className="font-body text-xs text-muted-foreground">
            {data.completedStepsCount} of {data.totalStepsCount} completed
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.steps.map((step) => {
            const isCompleted = step.status === 'completed';
            const isNeedsCorrection = step.status === 'needs_correction';
            const isLocked = step.status === 'locked';

            return (
              <div
                key={step.key}
                className={`flex flex-col justify-between rounded-xl border p-4 transition-all ${
                  isCompleted
                    ? 'border-emerald-500/20 bg-card hover:border-emerald-500/40'
                    : isNeedsCorrection
                    ? 'border-rose-500/40 bg-rose-500/5'
                    : isLocked
                    ? 'border-border/60 bg-muted/20 opacity-70'
                    : 'border-amber-500/30 bg-card hover:border-brand-gold'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                          isCompleted
                            ? 'bg-emerald-500/15 text-emerald-600'
                            : isNeedsCorrection
                            ? 'bg-rose-500/15 text-rose-600'
                            : isLocked
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-brand-gold/20 text-brand-gold'
                        }`}
                      >
                        {getStepIcon(step.key)}
                      </div>
                      <span className="font-body text-[11px] font-bold text-muted-foreground">
                        Step {step.stepNumber}
                      </span>
                    </div>

                    {getStatusBadge(step.status)}
                  </div>

                  <h4 className="font-heading text-sm font-bold text-foreground">
                    {step.title}
                  </h4>

                  {/* Correction note */}
                  {step.correctionReason && isNeedsCorrection && (
                    <div className="mt-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-700 dark:text-rose-300 font-body">
                      <strong>Admin Remark:</strong> {step.correctionReason}
                    </div>
                  )}

                  {/* Missing details list */}
                  {!isCompleted && step.missingDetails.length > 0 && !isNeedsCorrection && (
                    <div className="mt-2 space-y-1">
                      {step.missingDetails.slice(0, 2).map((item, idx) => (
                        <p key={idx} className="font-body text-[11px] text-muted-foreground flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-muted-foreground/60" />
                          {item}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer action button */}
                <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between">
                  {step.key === 'admin_submission' ? (
                    <button
                      onClick={() => void handleSubmitForReview()}
                      disabled={isSubmitting || !data.isReadyForSubmission}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold bg-brand-gold text-brand-black hover:bg-brand-gold/90 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      <Send size={13} />
                      {data.hotel?.approvalStatus === 'approved'
                        ? 'Listing Live'
                        : data.hotel?.partnerSubmitted
                        ? 'Under Review'
                        : 'Submit for Approval'}
                    </button>
                  ) : !isLocked ? (
                    <Link
                      to={step.actionUrl}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors"
                    >
                      {step.actionLabel}
                      <ArrowRight size={13} />
                    </Link>
                  ) : (
                    <span className="w-full text-center py-1.5 text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <Lock size={12} /> Unlock by completing previous steps
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PartnerSetupChecklist;

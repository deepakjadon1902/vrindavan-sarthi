import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  CalendarX,
  Car,
  CheckCircle2,
  Clock3,
  FileText,
  IndianRupee,
  MapPinned,
  MessageCircle,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';
import { COMPANY_EMAIL, COMPANY_PHONE, COMPANY_PHONE_DIGITS } from '@/lib/brand';

const highlights = [
  {
    icon: IndianRupee,
    title: '12% standard cancellation charge',
    text: 'For platform-managed bookings and orders, a 12% cancellation charge may be deducted before refund calculation.',
  },
  {
    icon: FileText,
    title: 'Reason and details are required',
    text: 'Every cancellation request must include a clear reason and supporting details so the team can review it correctly.',
  },
  {
    icon: Clock3,
    title: 'Refund after review',
    text: 'Eligible refunds are processed only after payment verification, booking status review, and partner confirmation where needed.',
  },
];

const servicePolicies = [
  {
    icon: Building2,
    title: 'Hotels and Rooms',
    text: 'Hotel and room bookings may be made with 30% advance payment or full payment. Refunds are calculated against the amount actually received by the platform, after applicable deduction and property-specific terms shown before payment.',
  },
  {
    icon: MapPinned,
    title: 'Dharamshala Enquiries',
    text: 'Many Dharamshala listings are handled by direct WhatsApp or call enquiry. If no online payment is collected by Vrindavan Sarthi, cancellation and refund will be handled directly by the Dharamshala or property manager.',
  },
  {
    icon: Car,
    title: 'Taxi and Cab Bookings',
    text: 'Cab bookings normally require advance payment. Late cancellations, no-shows, route changes after driver assignment, tolls, parking, or committed driver costs may affect the final refundable amount.',
  },
  {
    icon: CalendarX,
    title: 'Tour Packages',
    text: 'Tour cancellations depend on the package, travel date, vehicle, guide, darshan assistance, and local arrangements already reserved for the traveller.',
  },
  {
    icon: ShoppingBag,
    title: 'Shop Orders',
    text: 'Product orders can usually be cancelled before packing or dispatch. Packed, shipped, delivered, customized, or used items may not be eligible for cancellation.',
  },
  {
    icon: ShieldCheck,
    title: 'Admin or Payment Rejection',
    text: 'If a payment is rejected, invalid, unpaid, or not verifiable, the related booking or order can be cancelled by the admin team without refund for any unpaid amount.',
  },
];

const requestSteps = [
  'Open My Bookings or My Orders from your account.',
  'Choose the booking or order you want to cancel.',
  'Enter a clear cancellation reason and full details.',
  'Submit the request and wait for admin review.',
  'For urgent travel changes, contact support on WhatsApp or call.',
];

const importantNotes = [
  'No-show cases, incorrect traveller details, rule violations, duplicate requests, and last-minute cancellations may be non-refundable.',
  'Property-specific cancellation rules shown on a hotel or room page will apply along with this platform policy.',
  'Bank, gateway, supplier, driver, guide, packaging, or already committed service charges may be adjusted where applicable.',
  'Refund timelines depend on payment verification, bank processing, and partner confirmation.',
];

const CancellationPolicy = () => {
  return (
    <div className="min-h-screen bg-background pb-10 pt-20">
      <section className="relative overflow-hidden border-b border-brand-gold/20 bg-brand-black">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.22),transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(32,46,39,0.94))]" />
        <div className="container relative mx-auto max-w-6xl px-4 py-10 lg:px-8 lg:py-12">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-gold/35 bg-white/8 px-3 py-1 font-body text-xs font-semibold uppercase tracking-wide text-brand-gold">
              <ShieldCheck size={14} />
              Booking Protection
            </span>
            <h1 className="mt-4 font-heading text-4xl font-bold leading-tight text-white md:text-5xl">
              Cancellation Policy
            </h1>
            <p className="mt-4 max-w-2xl font-body text-base leading-7 text-white/75">
              Clear rules for cancelling hotel, room, cab, tour, Dharamshala enquiry, and shop order requests made through Vrindavan Sarthi.
            </p>
            <p className="mt-3 font-body text-sm text-brand-gold/90">Last updated: 17 August 2026</p>
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-6xl px-4 py-8 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {highlights.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="rounded-lg border border-border bg-card p-5 shadow-sm">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-gold/12 text-brand-saffron">
                  <Icon size={21} />
                </span>
                <h2 className="mt-4 font-heading text-lg font-semibold text-foreground">{item.title}</h2>
                <p className="mt-2 font-body text-sm leading-6 text-muted-foreground">{item.text}</p>
              </article>
            );
          })}
        </div>

        <div className="mt-6 rounded-lg border border-brand-gold/30 bg-gradient-to-r from-brand-gold/10 via-card to-card p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-black text-brand-gold">
              <IndianRupee size={21} />
            </span>
            <div>
              <h2 className="font-heading text-2xl font-semibold text-foreground">General Refund Rule</h2>
              <p className="mt-2 font-body text-sm leading-7 text-muted-foreground">
                When a booking or order is eligible for cancellation through Vrindavan Sarthi, the system may apply a standard 12% cancellation charge. The remaining eligible amount is marked refundable after admin review, payment verification, and any applicable partner or property policy.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="font-heading text-3xl font-bold text-foreground">Service-Wise Policy</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {servicePolicies.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-lg border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-start gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand-gold/30 bg-brand-gold/10 text-brand-saffron">
                      <Icon size={20} />
                    </span>
                    <div>
                      <h3 className="font-heading text-lg font-semibold text-foreground">{item.title}</h3>
                      <p className="mt-2 font-body text-sm leading-6 text-muted-foreground">{item.text}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <h2 className="font-heading text-2xl font-semibold text-foreground">How To Cancel</h2>
            <ol className="mt-4 space-y-3">
              {requestSteps.map((step, index) => (
                <li key={step} className="flex gap-3 font-body text-sm leading-6 text-muted-foreground">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-saffron text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/bookings" className="inline-flex min-h-11 items-center rounded-md bg-brand-saffron px-4 font-body text-sm font-bold text-white transition hover:bg-brand-crimson">
                My Bookings
              </Link>
              <a href={`https://wa.me/${COMPANY_PHONE_DIGITS}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-brand-gold/40 px-4 font-body text-sm font-bold text-foreground transition hover:border-brand-saffron hover:text-brand-saffron">
                <MessageCircle size={17} />
                WhatsApp Support
              </a>
            </div>
          </section>

          <section className="rounded-lg border border-amber-200 bg-amber-50/70 p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-1 shrink-0 text-amber-700" size={22} />
              <div>
                <h2 className="font-heading text-2xl font-semibold text-amber-950">Important Notes</h2>
                <ul className="mt-4 space-y-3">
                  {importantNotes.map((note) => (
                    <li key={note} className="flex gap-2 font-body text-sm leading-6 text-amber-950/80">
                      <CheckCircle2 className="mt-1 shrink-0 text-amber-700" size={15} />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>

        <section className="mt-8 rounded-lg border border-border bg-brand-black p-5 text-white shadow-sm">
          <h2 className="font-heading text-2xl font-semibold">Need Help With A Cancellation?</h2>
          <p className="mt-2 max-w-3xl font-body text-sm leading-7 text-white/70">
            Keep your booking ID, payment proof, traveller name, and cancellation reason ready. Our team will verify the request and guide you with the next step.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 font-body text-sm">
            <a href={`tel:${COMPANY_PHONE}`} className="rounded-md bg-white px-4 py-2.5 font-bold text-brand-black transition hover:bg-brand-gold">
              Call {COMPANY_PHONE}
            </a>
            <a href={`mailto:${COMPANY_EMAIL}`} className="rounded-md border border-white/20 px-4 py-2.5 font-semibold text-white/85 transition hover:border-brand-gold hover:text-brand-gold">
              {COMPANY_EMAIL}
            </a>
          </div>
        </section>
      </section>
    </div>
  );
};

export default CancellationPolicy;

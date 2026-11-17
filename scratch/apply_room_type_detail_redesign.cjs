const fs = require('fs');

let code = fs.readFileSync('frontend/src/pages/RoomTypeDetail.tsx', 'utf8');

// 1. Add getPrimaryButtonText helper if not present
if (!code.includes('getPrimaryButtonText')) {
  const insertBefore = '  const validateBookingForm = () => {';
  const helperCode = `  const getPrimaryButtonText = () => {
    if (isStartingPayment) {
      return isDharamshala ? 'Submitting request...' : 'Opening payment gateway...';
    }
    if (isDharamshala) {
      return 'Submit Free Room Request';
    }
    if (!canShowRoomPrices) {
      return 'Request Booking';
    }
    if (effectivePaymentOption === 'advance_30') {
      return \`Pay Rs. \${payableNow.toLocaleString('en-IN')} Advance & Confirm\`;
    }
    if (effectivePaymentOption === 'full_100') {
      return \`Pay Rs. \${payableNow.toLocaleString('en-IN')} Full & Confirm\`;
    }
    return 'Select Payment Option';
  };

`;
  code = code.replace(insertBefore, helperCode + insertBefore);
}

// 2. Add id="booking-form-section" to the sidebar div
code = code.replace(
  'className="premium-surface premium-sidebar-scroll space-y-4 p-4 sm:p-5',
  'id="booking-form-section" className="premium-surface premium-sidebar-scroll space-y-4 p-4 sm:p-5'
);

// 3. Add inline cancellation policy badge above terms checkbox
const termsTarget = '{mustAcceptPropertyTerms && (';
if (!code.includes('Cancellation Policy:</strong> Free cancellation')) {
  const cancellationBadge = `                    <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 p-2.5 text-xs text-emerald-950 font-medium">
                      <ShieldCheck size={16} className="text-emerald-700 shrink-0" />
                      <span><strong>Cancellation Policy:</strong> Free cancellation & 100% refund available per property policy before check-in.</span>
                    </div>

                    `;
  code = code.replace(termsTarget, cancellationBadge + termsTarget);
}

// 4. Update the primary button to use btn-emerald and getPrimaryButtonText()
const oldBtn = `<button
                        onClick={startRazorpayPayment}
                        disabled={isStartingPayment || (mustAcceptPropertyTerms && !propertyTermsAccepted) || isRequestedQuantityUnavailable}
                        className="btn-gold w-full rounded-lg py-3 text-sm font-bold tracking-wide disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isStartingPayment ? 'Sending request...' : 'Request Booking'}
                      </button>`;

const newBtn = `<button
                        onClick={startRazorpayPayment}
                        disabled={isStartingPayment || (mustAcceptPropertyTerms && !propertyTermsAccepted) || isRequestedQuantityUnavailable}
                        className="btn-emerald w-full rounded-xl py-3 text-sm font-bold tracking-wide disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
                      >
                        {getPrimaryButtonText()}
                      </button>`;

code = code.replace(oldBtn, newBtn);

// 5. Also replace the secondary button in the recheck block if present
code = code.replace(
  `<button onClick={startRazorpayPayment} disabled={isStartingPayment || (mustAcceptPropertyTerms && !propertyTermsAccepted) || isRequestedQuantityUnavailable} className="btn-gold w-full rounded-lg py-3 text-sm font-bold tracking-wide disabled:cursor-not-allowed disabled:opacity-50">
                          {isStartingPayment ? 'Sending request...' : 'Request Booking'}
                        </button>`,
  `<button onClick={startRazorpayPayment} disabled={isStartingPayment || (mustAcceptPropertyTerms && !propertyTermsAccepted) || isRequestedQuantityUnavailable} className="btn-emerald w-full rounded-xl py-3 text-sm font-bold tracking-wide disabled:cursor-not-allowed disabled:opacity-50 shadow-sm">
                          {getPrimaryButtonText()}
                        </button>`
);

// 6. Add mobile sticky booking bar at the bottom before last closing div
if (!code.includes('Mobile Sticky Booking Bar')) {
  const endTarget = `        <div className="mt-5 grid auto-rows-fr gap-4 md:grid-cols-2">`;
  const stickyBar = `        {/* Mobile Sticky Booking Bar */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-neutral-200 px-4 py-2.5 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Amount</p>
            <p className="text-lg font-bold text-slate-900 leading-tight">
              {canShowRoomPrices && !isDharamshala ? \`Rs. \${total.toLocaleString('en-IN')}\` : isDharamshala ? 'Free Request' : 'Price on request'}
              {canShowRoomPrices && !isDharamshala && <span className="text-[11px] font-normal text-slate-500 ml-1">({nights}N)</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('booking-form-section');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
              } else {
                startRazorpayPayment();
              }
            }}
            className="btn-emerald px-5 py-2.5 text-sm font-bold shadow-sm"
          >
            {booked ? 'Track Status' : isDharamshala ? 'Request Room' : 'Book Room'}
          </button>
        </div>

`;
  code = code.replace(endTarget, stickyBar + endTarget);
}

fs.writeFileSync('frontend/src/pages/RoomTypeDetail.tsx', code, 'utf8');
console.log('Successfully updated RoomTypeDetail.tsx');

const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../frontend/src/pages/user/BookingDetail.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Update filename and toast in handleDownloadInvoice
const fnTarget = "      link.setAttribute('download', `invoice-${booking?.bookingId || id}.pdf`);\n      document.body.appendChild(link);\n      link.click();\n      link.remove();\n      window.URL.revokeObjectURL(downloadUrl);\n      toast.success('Invoice downloaded successfully');";

const fnReplacement = "      link.setAttribute('download', `booking-receipt-${booking?.bookingId || id}.pdf`);\n      document.body.appendChild(link);\n      link.click();\n      link.remove();\n      window.URL.revokeObjectURL(downloadUrl);\n      toast.success('Booking receipt downloaded successfully');";

if (!content.includes(fnTarget)) {
  console.error('fnTarget not found in BookingDetail.tsx');
  process.exit(1);
}
content = content.replace(fnTarget, fnReplacement);

// 2. Update error toast
const errTarget = "let msg = 'Could not download invoice. Please try again or contact support.';";
const errReplacement = "let msg = 'Could not download receipt. Please try again or contact support.';";
if (content.includes(errTarget)) {
  content = content.replace(errTarget, errReplacement);
}

// 3. Update button label and cancel gating
const btnTarget = `                      <button
                        onClick={handleDownloadInvoice}
                        disabled={isDownloadingInvoice}
                        className="w-full py-3 rounded-2xl bg-brand-crimson text-white font-body text-sm font-bold hover:bg-brand-crimson/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm"
                      >
                        <Download size={16} className={isDownloadingInvoice ? 'animate-bounce' : ''} />
                        <span>{isDownloadingInvoice ? 'Generating Invoice...' : 'Download PDF Invoice'}</span>
                      </button>

                      {canModify && (
                        <button
                          onClick={openModify}
                          className="w-full py-3 rounded-2xl bg-brand-gold text-foreground font-body text-sm font-bold hover:bg-brand-gold/90 transition-colors flex items-center justify-center gap-2"
                        >
                          <Calendar size={15} /> Modify Dates / Guests
                        </button>
                      )}

                      <button
                        onClick={handleCancel}
                        className="w-full py-2.5 rounded-2xl border border-destructive/40 text-destructive font-body text-xs font-semibold hover:bg-destructive/5 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <XCircle size={14} /> Cancel Reservation
                      </button>`;

const btnReplacement = `                      <button
                        onClick={handleDownloadInvoice}
                        disabled={isDownloadingInvoice}
                        className="w-full py-3 rounded-2xl bg-brand-crimson text-white font-body text-sm font-bold hover:bg-brand-crimson/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm"
                      >
                        <Download size={16} className={isDownloadingInvoice ? 'animate-bounce' : ''} />
                        <span>{isDownloadingInvoice ? 'Generating Receipt...' : 'Download Booking Receipt (PDF)'}</span>
                      </button>

                      {canModify && (
                        <button
                          onClick={openModify}
                          className="w-full py-3 rounded-2xl bg-brand-gold text-foreground font-body text-sm font-bold hover:bg-brand-gold/90 transition-colors flex items-center justify-center gap-2"
                        >
                          <Calendar size={15} /> Modify Dates / Guests
                        </button>
                      )}

                      {booking.bookingStatus === 'confirmed' && (
                        <button
                          onClick={handleCancel}
                          className="w-full py-2.5 rounded-2xl border border-destructive/40 text-destructive font-body text-xs font-semibold hover:bg-destructive/5 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <XCircle size={14} /> Cancel Reservation
                        </button>
                      )}`;

if (!content.includes(btnTarget)) {
  console.error('btnTarget not found in BookingDetail.tsx');
  process.exit(1);
}
content = content.replace(btnTarget, btnReplacement);

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully updated BookingDetail.tsx');

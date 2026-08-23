import { useMemo } from 'react';
import { Download, FileText } from 'lucide-react';

const pdfText = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>
endobj
6 0 obj
<< /Length 1292 >>
stream
BT /F2 18 Tf 48 735 Td (Vrindavan Sarthi Partner Terms & Conditions) Tj ET
BT /F1 10 Tf 48 707 Td (This partner document is separate from the customer privacy policy.) Tj ET
BT /F2 11 Tf 48 675 Td (1. Listing Accuracy) Tj ET
BT /F1 9.5 Tf 48 658 Td (Partners must list only genuine, lawful, owner-authorized hotels or dharamshalas.) Tj ET
BT /F1 9.5 Tf 48 643 Td (Images, facilities, room inventory, guest rules, maps, pricing, and availability must stay accurate.) Tj ET
BT /F2 11 Tf 48 611 Td (2. Booking Handling) Tj ET
BT /F1 9.5 Tf 48 594 Td (Confirmed bookings must be honored. Partners must verify payment, support guest arrival, and update check-in status.) Tj ET
BT /F1 9.5 Tf 48 579 Td (For 30 percent advance bookings, the remaining balance is collected at the property as shown in the dashboard.) Tj ET
BT /F2 11 Tf 48 547 Td (3. Tax, Invoice, and Compliance) Tj ET
BT /F1 9.5 Tf 48 530 Td (The property partner remains responsible for accommodation tax invoices, GST filing, licenses, and local compliance.) Tj ET
BT /F2 11 Tf 48 498 Td (4. Platform Commercial Terms) Tj ET
BT /F1 9.5 Tf 48 481 Td (Platform commission and payout terms are private partner-dashboard information and must not be shown publicly.) Tj ET
BT /F2 11 Tf 48 449 Td (5. Payouts) Tj ET
BT /F1 9.5 Tf 48 432 Td (Eligible payouts follow platform ledger rules, minimum threshold controls, and scheduled settlement cycles.) Tj ET
BT /F2 11 Tf 48 400 Td (6. Guest Privacy) Tj ET
BT /F1 9.5 Tf 48 383 Td (Guest contact and identity details may be used only for servicing the booking and must not be misused.) Tj ET
BT /F1 8 Tf 48 56 Td (Generated for Partner Portal use. Contact vrindavansarthi108@gmail.com for the latest signed commercial agreement.) Tj ET
endstream
endobj
xref
0 7
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000241 00000 n 
0000000311 00000 n 
0000000386 00000 n 
trailer
<< /Size 7 /Root 1 0 R >>
startxref
1728
%%EOF`;

const PartnerTermsPdf = () => {
  const pdfUrl = useMemo(() => {
    const blob = new Blob([pdfText], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-foreground">Partner Terms & Conditions</h2>
          <p className="font-body text-xs text-muted-foreground">
            Dedicated partner document. This is separate from the public privacy policy.
          </p>
        </div>
        <a href={pdfUrl} download="vrindavan-sarthi-partner-terms.pdf" className="btn-gold inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm">
          <Download size={16} />
          Download PDF
        </a>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-3 font-body text-sm font-semibold text-foreground">
          <FileText size={16} className="text-brand-gold" />
          Static PDF Viewer
        </div>
        <iframe src={pdfUrl} title="Partner Terms PDF" className="h-[72vh] min-h-[520px] w-full bg-white" />
      </div>
    </div>
  );
};

export default PartnerTermsPdf;

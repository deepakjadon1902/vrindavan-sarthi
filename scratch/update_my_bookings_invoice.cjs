const fs = require('fs');
const path = require('path');

const mbPath = path.join(__dirname, '..', 'frontend', 'src', 'pages', 'user', 'MyBookings.tsx');
let code = fs.readFileSync(mbPath, 'utf8');

// 1. Add Download to lucide-react import
if (!code.includes('Download,')) {
  code = code.replace(
    '  CheckCircle2,\n',
    '  CheckCircle2,\n  Download,\n'
  );
  console.log('Added Download import to MyBookings.tsx');
}

// 2. Add api import if missing
if (!code.includes("import { api } from '@/lib/api';")) {
  code = code.replace(
    "import { toast } from 'sonner';",
    "import { toast } from 'sonner';\nimport { api } from '@/lib/api';"
  );
  console.log('Added api import to MyBookings.tsx');
}

// 3. Add downloadingId state and downloadInvoice function inside MyBookings
const downloadFunc = `  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const downloadInvoice = async (e: MouseEvent, id: string, bookingId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    const token = useAuthStore.getState().token;
    if (!token) return;
    try {
      setDownloadingId(id);
      const res = await api.get(\`/bookings/\${id}/invoice\`, {
        headers: { Authorization: \`Bearer \${token}\` },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', \`invoice-\${bookingId || id}.pdf\`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success('Invoice downloaded successfully');
    } catch {
      toast.error('Could not download invoice. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };`;

if (!code.includes('downloadInvoice')) {
  code = code.replace(
    '  const [cancelDetails, setCancelDetails] = useState(\'\');',
    `  const [cancelDetails, setCancelDetails] = useState('');\n${downloadFunc}`
  );
  console.log('Added downloadInvoice function to MyBookings.tsx');
}

// 4. Update Confirmed booking action row
const oldConfirmedBtn = `                        {b.bookingStatus === 'confirmed' && (
                          <button onClick={(e) => openCancel(e, b.id)} className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-md px-0 font-body text-xs font-bold text-destructive hover:underline">
                            <XCircle size={13} /> Cancel
                          </button>
                        )}`;

const newConfirmedBtn = `                        {b.bookingStatus === 'confirmed' && (
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <button
                              onClick={(e) => downloadInvoice(e, b.id, b.bookingId)}
                              disabled={downloadingId === b.id}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 font-body text-xs font-semibold text-foreground hover:bg-secondary hover:text-brand-crimson transition-colors disabled:opacity-50"
                            >
                              <Download size={12} className={downloadingId === b.id ? 'animate-bounce' : ''} />
                              <span>{downloadingId === b.id ? 'Downloading...' : 'PDF Invoice'}</span>
                            </button>
                            <button onClick={(e) => openCancel(e, b.id)} className="inline-flex items-center gap-1.5 rounded-md px-0 font-body text-xs font-bold text-destructive hover:underline">
                              <XCircle size={13} /> Cancel
                            </button>
                          </div>
                        )}`;

code = code.replace(oldConfirmedBtn, newConfirmedBtn);

fs.writeFileSync(mbPath, code, 'utf8');
console.log('Successfully updated MyBookings.tsx with invoice download');

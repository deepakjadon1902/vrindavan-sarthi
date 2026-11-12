import { useEffect, useState } from 'react';
import {
  FileText, Download, Filter, Calendar, BarChart3, TrendingUp,
  Hotel, Users, RotateCcw, RefreshCw
} from 'lucide-react';
import { api, withAuth } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

type ReportItem = Record<string, any>;

const REPORT_TABS = [
  { id: 'bookings', label: 'Booking Daily Velocity', icon: BarChart3 },
  { id: 'properties', label: 'Property Revenue Performance', icon: Hotel },
  { id: 'partners', label: 'Partner Earnings & Commission', icon: Users },
  { id: 'cancellations', label: 'Cancellation & Refund Log', icon: RotateCcw },
];

const PERIODS = [
  { id: 'last7days', label: 'Last 7 Days' },
  { id: 'last30days', label: 'Last 30 Days' },
  { id: 'thisMonth', label: 'This Month' },
  { id: 'lastMonth', label: 'Last Month' },
  { id: 'allTime', label: 'All Time' },
];

const AdminReports = () => {
  const token = useAuthStore((s) => s.token);
  const [activeReport, setActiveReport] = useState('bookings');
  const [period, setPeriod] = useState('last30days');
  const [reportData, setReportData] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReport = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api.get(`/admin/reports/${activeReport}`, {
        ...withAuth(token),
        params: { period },
      });
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setReportData(res.data.data);
      }
    } catch {
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReport();
  }, [token, activeReport, period]);

  const handleExportCsv = () => {
    if (!reportData || reportData.length === 0) return;
    const headers = Object.keys(reportData[0]);
    const csvRows = [
      headers.join(','),
      ...reportData.map((row) =>
        headers.map((h) => JSON.stringify(row[h] ?? '')).join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `vrindavan_sarthi_${activeReport}_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-card border border-border p-4 rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-heading font-bold text-foreground flex items-center gap-2">
            <FileText className="text-brand-crimson" size={20} />
            Platform Reports & Analytical Intelligence
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Query aggregated business transactions, property occupancy, and commission ledgers with CSV export
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                  period === p.id
                    ? 'bg-brand-crimson text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCsv}
            disabled={reportData.length === 0}
            className="px-3 py-1.5 bg-foreground text-background text-xs font-semibold rounded-lg hover:bg-foreground/90 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {REPORT_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveReport(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs rounded-lg font-semibold transition-colors ${
                activeReport === tab.id
                  ? 'bg-brand-crimson text-white shadow-xs'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={14} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Report Data Table */}
      <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {reportData.length > 0
                  ? Object.keys(reportData[0]).map((key) => (
                      <th key={key} className="p-3 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
                      </th>
                    ))
                  : <th className="p-3">Data Columns</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-muted-foreground">
                    Aggregating operational reports...
                  </td>
                </tr>
              ) : reportData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-muted-foreground">
                    No data recorded for the selected window.
                  </td>
                </tr>
              ) : (
                reportData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-muted/30 transition-colors">
                    {Object.keys(row).map((k) => (
                      <td key={k} className="p-3 text-foreground font-medium">
                        {typeof row[k] === 'number' && k.toLowerCase().includes('amount') || k.toLowerCase().includes('revenue') || k.toLowerCase().includes('tariff') || k.toLowerCase().includes('payout')
                          ? `₹${row[k].toLocaleString('en-IN')}`
                          : String(row[k] ?? '-')}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminReports;

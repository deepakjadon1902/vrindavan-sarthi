import { useEffect, useMemo, useState } from 'react';
import { Bell, Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import { api, withAuth } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAuthStore } from '@/store/authStore';
import RecordPagination, { useRecordPagination } from '@/components/shared/RecordPagination';

const PartnerCommunications = () => {
  const token = useAuthStore((s) => s.token);
  const [notices, setNotices] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    const run = async () => {
      try {
        setIsLoading(true);
        const [noticeRes, notificationRes] = await Promise.all([
          api.get('/partner/notices', withAuth(token)),
          api.get('/partner/notifications', withAuth(token)),
        ]);
        setNotices(Array.isArray(noticeRes.data?.data) ? noticeRes.data.data : []);
        setNotifications(Array.isArray(notificationRes.data?.data) ? notificationRes.data.data : []);
      } catch (err: unknown) {
        toast.error(getApiErrorMessage(err, 'Failed to load communications'));
      } finally {
        setIsLoading(false);
      }
    };
    void run();
  }, [token]);

  const sortedNotices = useMemo(
    () => [...notices].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [notices]
  );
  const sortedNotifications = useMemo(
    () => [...notifications].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [notifications]
  );
  const noticePages = useRecordPagination(sortedNotices);
  const notificationPages = useRecordPagination(sortedNotifications);

  const renderItems = (items: any[], page: number, setPage: (page: number) => void, total: number) => (
    <div className="space-y-3">
      {total === 0 ? (
        <p className="font-body text-sm text-muted-foreground">{isLoading ? 'Loading...' : 'No items yet.'}</p>
      ) : (
        <>
        {items.map((item) => (
          <div key={item._id} className="rounded-lg border border-border bg-background p-4 space-y-2">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  {item.priority && item.priority !== 'normal' && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-destructive/15 text-destructive">
                      {item.priority}
                    </span>
                  )}
                  {item.audience === 'partner' && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                      Targeted Memo
                    </span>
                  )}
                  {item.metadata?.propertyName && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                      {item.metadata.propertyName}
                    </span>
                  )}
                </div>
                <p className="font-body text-sm font-semibold text-foreground">{item.title}</p>
              </div>
              <p className="font-body text-[11px] text-muted-foreground whitespace-nowrap">
                {new Date(item.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <p className="font-body text-sm text-muted-foreground whitespace-pre-line">{item.message}</p>
            {item.metadata?.sentByAdminName && (
              <p className="font-body text-[11px] text-muted-foreground/80 pt-1 border-t border-border/50">
                Issued by: {item.metadata.sentByAdminName}
              </p>
            )}
          </div>
        ))}
        <RecordPagination page={page} total={total} onPageChange={setPage} />
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold text-foreground">Notices & Notifications</h2>
        <p className="font-body text-xs text-muted-foreground">Admin policies, guidelines, news, and system alerts.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-heading text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <Megaphone size={16} className="text-brand-gold" /> Notices
          </h3>
          {renderItems(noticePages.pageItems, noticePages.page, noticePages.setPage, sortedNotices.length)}
        </section>
        <section className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-heading text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <Bell size={16} className="text-brand-crimson" /> Notifications
          </h3>
          {renderItems(notificationPages.pageItems, notificationPages.page, notificationPages.setPage, sortedNotifications.length)}
        </section>
      </div>
    </div>
  );
};

export default PartnerCommunications;

import { useEffect, useState } from 'react';
import { Bell, Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import { api, withAuth } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAuthStore } from '@/store/authStore';

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

  const renderItems = (items: any[]) => (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="font-body text-sm text-muted-foreground">{isLoading ? 'Loading...' : 'No items yet.'}</p>
      ) : (
        items.map((item) => (
          <div key={item._id} className="rounded-lg border border-border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-body text-sm font-semibold text-foreground">{item.title}</p>
              <p className="font-body text-[11px] text-muted-foreground whitespace-nowrap">{new Date(item.createdAt).toLocaleDateString()}</p>
            </div>
            <p className="font-body text-sm text-muted-foreground mt-2 whitespace-pre-line">{item.message}</p>
          </div>
        ))
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
          {renderItems(notices)}
        </section>
        <section className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-heading text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <Bell size={16} className="text-brand-crimson" /> Notifications
          </h3>
          {renderItems(notifications)}
        </section>
      </div>
    </div>
  );
};

export default PartnerCommunications;

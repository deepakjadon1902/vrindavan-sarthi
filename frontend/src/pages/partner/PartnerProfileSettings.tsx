import { useState } from 'react';
import { Image as ImageIcon, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';

const PartnerProfileSettings = () => {
  const { user, updateProfile } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.profileDisplayName || user?.businessName || user?.name || '');
  const [bio, setBio] = useState(user?.profileBio || user?.businessDescription || '');
  const [profilePicture, setProfilePicture] = useState(user?.profilePicture || user?.avatar || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setProfilePicture(String(reader.result || ''));
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return toast.error('Display name is required');
    setIsSaving(true);
    const res = await updateProfile({
      profileDisplayName: displayName.trim(),
      profileBio: bio.trim(),
      profilePicture,
    });
    setIsSaving(false);
    if (res.success) toast.success('Profile settings updated');
    else toast.error(res.error || 'Update failed');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="font-heading text-xl font-bold text-foreground">Profile Settings</h2>
        <p className="font-body text-xs text-muted-foreground">Customize the public host profile shown with your approved listings.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row gap-5">
          <div className="w-32">
            <div className="w-28 h-28 rounded-full overflow-hidden border border-border bg-muted">
              {profilePicture ? (
                <img src={profilePicture} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon size={24} className="text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <label className="px-3 py-1.5 rounded-lg border border-border text-xs font-body cursor-pointer hover:bg-muted">
                Upload
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
              {profilePicture && (
                <button type="button" onClick={() => setProfilePicture('')} className="p-1.5 rounded-lg border border-border hover:bg-muted" title="Remove photo">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Display Name *</label>
              <input
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50"
              />
            </div>
            <div>
              <label className="font-body text-sm font-medium text-foreground mb-1.5 block">Bio</label>
              <textarea
                rows={6}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background font-body text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/50 resize-none"
              />
            </div>
          </div>
        </div>

        <button type="submit" disabled={isSaving} className="btn-crimson px-5 py-2.5 rounded-lg text-sm inline-flex items-center gap-2 disabled:opacity-60">
          <Save size={16} /> {isSaving ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
};

export default PartnerProfileSettings;

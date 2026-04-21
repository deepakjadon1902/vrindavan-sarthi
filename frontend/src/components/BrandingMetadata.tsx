import { useEffect } from 'react';
import { useSettingsStore } from '@/store/settingsStore';

const upsertMeta = (selector: string, attrs: Record<string, string>, content: string) => {
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

const upsertLink = (selector: string, attrs: Record<string, string>, href: string) => {
  let el = document.head.querySelector(selector) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
};

const BrandingMetadata = () => {
  const settings = useSettingsStore((s) => s.settings);

  useEffect(() => {
    const title = settings.metaTitle?.trim() || settings.siteName || 'VrindavanSarthi';
    const description = settings.metaDescription?.trim() || settings.motto || 'Your Divine Guide to Vrindavan';
    const keywords = settings.metaKeywords?.trim() || '';

    document.title = title;
    upsertMeta('meta[name="description"]', { name: 'description' }, description);
    if (keywords) upsertMeta('meta[name="keywords"]', { name: 'keywords' }, keywords);

    upsertMeta('meta[property="og:title"]', { property: 'og:title' }, title);
    upsertMeta('meta[property="og:description"]', { property: 'og:description' }, description);
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title' }, title);
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description' }, description);

    const ogImage = settings.ogImageUrl?.trim() || settings.logoUrl?.trim();
    if (ogImage) {
      upsertMeta('meta[property="og:image"]', { property: 'og:image' }, ogImage);
      upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image' }, ogImage);
    }

    const favicon = settings.faviconUrl?.trim() || settings.logoUrl?.trim() || '/favicon.ico';
    upsertLink('link[rel="icon"]', { rel: 'icon' }, favicon);
  }, [settings]);

  return null;
};

export default BrandingMetadata;


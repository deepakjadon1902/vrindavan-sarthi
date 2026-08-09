import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useSettingsStore } from '@/store/settingsStore';
import {
  absoluteAssetUrl,
  absoluteUrl,
  buildOrganizationJsonLd,
  buildWebsiteJsonLd,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  type JsonLdValue,
  SITE_NAME,
  titleTemplate,
  truncate,
} from '@/lib/seo';

type SEOProps = {
  title?: string;
  description?: string;
  image?: string;
  canonicalPath?: string;
  type?: 'website' | 'article' | 'product';
  noindex?: boolean;
  jsonLd?: JsonLdValue;
  jsonLdId?: string;
};

const upsertMeta = (selector: string, attrs: Record<string, string>) => {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([key, value]) => el?.setAttribute(key, value));
};

const upsertLink = (rel: string, href: string, attrs: Record<string, string> = {}) => {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
  Object.entries(attrs).forEach(([key, value]) => el?.setAttribute(key, value));
};

const removeManagedJsonLd = (id: string) => {
  document.head.querySelectorAll(`script[data-seo-jsonld="${id}"]`).forEach((el) => el.remove());
};

const addJsonLd = (value: JsonLdValue, id: string) => {
  const values = Array.isArray(value) ? value : [value];
  for (const item of values) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.dataset.seoJsonld = id;
    script.textContent = JSON.stringify(item);
    document.head.appendChild(script);
  }
};

export const JsonLd = ({ value, id = 'page-extra' }: { value: JsonLdValue; id?: string }) => {
  useEffect(() => {
    removeManagedJsonLd(id);
    addJsonLd(value, id);
    return () => removeManagedJsonLd(id);
  }, [id, value]);

  return null;
};

const SEO = ({
  title,
  description,
  image,
  canonicalPath,
  type = 'website',
  noindex = false,
  jsonLd,
  jsonLdId = 'page',
}: SEOProps) => {
  const location = useLocation();
  const { settings } = useSettingsStore();

  const computed = useMemo(() => {
    const metaTitle = titleTemplate(title || settings.metaTitle || SITE_NAME);
    const metaDescription = truncate(description || settings.metaDescription || DEFAULT_DESCRIPTION);
    const canonical = absoluteUrl(canonicalPath || location.pathname);
    const imageUrl = absoluteAssetUrl(image || settings.ogImageUrl || settings.logoUrl || DEFAULT_OG_IMAGE);
    const logoUrl = settings.logoUrl || settings.ogImageUrl || DEFAULT_OG_IMAGE;
    const baseJsonLd = [buildOrganizationJsonLd(logoUrl, settings.adminEmail, settings.adminPhone), buildWebsiteJsonLd()];
    const mergedJsonLd = jsonLd ? [...baseJsonLd, ...(Array.isArray(jsonLd) ? jsonLd : [jsonLd])] : baseJsonLd;
    return { metaTitle, metaDescription, canonical, imageUrl, mergedJsonLd };
  }, [
    canonicalPath,
    description,
    image,
    jsonLd,
    location.pathname,
    settings.adminEmail,
    settings.adminPhone,
    settings.logoUrl,
    settings.metaDescription,
    settings.metaTitle,
    settings.ogImageUrl,
    title,
  ]);

  useEffect(() => {
    document.title = computed.metaTitle;
    upsertMeta('meta[name="description"]', { name: 'description', content: computed.metaDescription });
    upsertMeta('meta[name="robots"]', { name: 'robots', content: noindex ? 'noindex,nofollow,noarchive' : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' });
    upsertLink('canonical', computed.canonical);

    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: SITE_NAME });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: type });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: computed.metaTitle });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: computed.metaDescription });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: computed.canonical });
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: computed.imageUrl });
    upsertMeta('meta[property="og:image:alt"]', { property: 'og:image:alt', content: `${SITE_NAME} logo and Braj travel services` });

    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: computed.metaTitle });
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: computed.metaDescription });
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: computed.imageUrl });

    upsertMeta('meta[name="theme-color"]', { name: 'theme-color', content: '#111B31' });
    removeManagedJsonLd(jsonLdId);
    addJsonLd(computed.mergedJsonLd, jsonLdId);
  }, [computed, jsonLdId, noindex, type]);

  return null;
};

export default SEO;

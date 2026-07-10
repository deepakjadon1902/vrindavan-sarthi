import { useLocation } from 'react-router-dom';
import SEO from '@/components/SEO';
import { buildFaqJsonLd, getRouteMeta, isNoIndexPath, normalizePathname, publicRouteMeta } from '@/lib/seo';

const faqJsonLd = buildFaqJsonLd([
  {
    question: 'Can I book hotels, rooms, cabs, and tours in Vrindavan on Vrindavan Sarthi?',
    answer: 'Yes. Vrindavan Sarthi helps pilgrims book verified hotels, room types, local cabs, guided tours, and devotional products in Vrindavan.',
  },
  {
    question: 'Are private account and booking pages indexed by Google?',
    answer: 'No. Account, booking, admin, partner, and authentication pages are marked noindex to keep private areas out of search results.',
  },
]);

const RouteSEO = () => {
  const location = useLocation();
  const path = normalizePathname(location.pathname);
  const meta = getRouteMeta(path);
  const noindex = isNoIndexPath(path) || !publicRouteMeta[path] && !/^\/(hotels|room-types|cabs|tours|shop)\/[^/]+$/.test(path);

  return (
    <SEO
      title={meta.title}
      description={meta.description}
      image={meta.image}
      canonicalPath={path}
      noindex={noindex}
      jsonLd={path === '/' ? faqJsonLd : undefined}
    />
  );
};

export default RouteSEO;

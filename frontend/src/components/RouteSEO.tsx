import { useLocation } from 'react-router-dom';
import SEO from '@/components/SEO';
import { buildFaqJsonLd, getRouteMeta, indexablePublicPaths, isNoIndexPath, normalizePathname } from '@/lib/seo';

const faqJsonLd = buildFaqJsonLd([
  {
    question: 'Can I book hotels, rooms, cabs, and tours in Vrindavan on Vrindavan Sarthi Enterprises?',
    answer: 'Yes. Vrindavan Sarthi Enterprises helps pilgrims book verified hotels, room types, local cabs, guided tours, and devotional products in Vrindavan.',
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
  const noindex = isNoIndexPath(path) || !indexablePublicPaths.has(path) && !/^\/(hotels|room-types|cabs|tours|shop)\/[^/]+$/.test(path);

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


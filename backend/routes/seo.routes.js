const express = require('express');
const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const Cab = require('../models/Cab');
const Tour = require('../models/Tour');
const Product = require('../models/Product');
const { normalizePublicImageSet, normalizePublicImages } = require('../utils/publicImages');

const router = express.Router();
const SITE_ORIGIN = String(process.env.PUBLIC_SITE_URL || process.env.FRONTEND_BASE_URL || 'https://vrindavansarthi.in').replace(/\/+$/, '');

const xmlEscape = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const absoluteUrl = (path) => `${SITE_ORIGIN}${path === '/' ? '/' : `/${String(path || '').replace(/^\/+/, '').replace(/\/+$/, '')}`}`;

const absoluteAssetUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw || raw === '/placeholder.svg' || raw.startsWith('data:') || raw.startsWith('blob:')) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  return `${SITE_ORIGIN}${raw.startsWith('/') ? raw : `/${raw}`}`;
};

const sendXml = (res, xml) => {
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=900, stale-while-revalidate=3600');
  res.send(xml);
};

const sitemapIndex = (paths) => `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((path) => `  <sitemap><loc>${xmlEscape(absoluteUrl(path))}</loc></sitemap>`).join('\n')}
</sitemapindex>`;

const urlset = (urls, { images = false } = {}) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${images ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : ''}>
${urls.join('\n')}
</urlset>`;

const urlEntry = ({ loc, lastmod, changefreq = 'weekly', priority = '0.7', images = [] }) => `  <url>
    <loc>${xmlEscape(absoluteUrl(loc))}</loc>${lastmod ? `
    <lastmod>${xmlEscape(new Date(lastmod).toISOString())}</lastmod>` : ''}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>${images.map((img) => `
    <image:image>
      <image:loc>${xmlEscape(img.loc)}</image:loc>${img.title ? `
      <image:title>${xmlEscape(img.title)}</image:title>` : ''}
    </image:image>`).join('')}
  </url>`;

const staticPages = [
  { loc: '/', changefreq: 'daily', priority: '1.0' },
  { loc: '/hotels', changefreq: 'daily', priority: '0.9' },
  { loc: '/rooms', changefreq: 'daily', priority: '0.9' },
  { loc: '/cabs', changefreq: 'daily', priority: '0.8' },
  { loc: '/tours', changefreq: 'daily', priority: '0.9' },
  { loc: '/shop', changefreq: 'daily', priority: '0.8' },
  { loc: '/about', changefreq: 'monthly', priority: '0.6' },
  { loc: '/contact', changefreq: 'monthly', priority: '0.6' },
  { loc: '/terms', changefreq: 'yearly', priority: '0.3' },
  { loc: '/privacy', changefreq: 'yearly', priority: '0.3' },
];

router.get(['/sitemap-index.xml', '/sitemap.xml'], async (req, res) => {
  sendXml(res, sitemapIndex(['/api/seo/sitemap-pages.xml', '/api/seo/sitemap-products.xml', '/api/seo/sitemap-tours.xml', '/api/seo/sitemap-images.xml']));
});

router.get('/sitemap-pages.xml', async (req, res) => {
  const urls = staticPages.map(urlEntry);
  sendXml(res, urlset(urls));
});

router.get('/sitemap-products.xml', async (req, res) => {
  const [products, rooms] = await Promise.all([
    Product.find({ $or: [{ inStock: true }, { inStock: { $exists: false } }] }).sort({ updatedAt: -1 }).limit(5000).select('_id updatedAt').lean(),
    RoomType.aggregate([
      { $match: { status: 'active' } },
      {
        $lookup: {
          from: 'hotels',
          let: { hid: '$hotelId' },
          pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$hid'] }, status: 'active', approvalStatus: 'approved' } }, { $project: { _id: 1 } }],
          as: 'hotel',
        },
      },
      { $unwind: '$hotel' },
      { $sort: { updatedAt: -1 } },
      { $limit: 5000 },
      { $project: { _id: 1, updatedAt: 1 } },
    ]),
  ]);

  const urls = [
    urlEntry({ loc: '/shop', changefreq: 'daily', priority: '0.8' }),
    urlEntry({ loc: '/rooms', changefreq: 'daily', priority: '0.9' }),
    ...products.map((p) => urlEntry({ loc: `/shop/${p._id}`, lastmod: p.updatedAt, changefreq: 'weekly', priority: '0.6' })),
    ...rooms.map((r) => urlEntry({ loc: `/room-types/${r._id}`, lastmod: r.updatedAt, changefreq: 'weekly', priority: '0.7' })),
  ];
  sendXml(res, urlset(urls));
});

router.get('/sitemap-tours.xml', async (req, res) => {
  const [hotels, cabs, tours] = await Promise.all([
    Hotel.find({ status: 'active', approvalStatus: 'approved' }).sort({ updatedAt: -1 }).limit(5000).select('_id updatedAt').lean(),
    Cab.find({ status: 'available', approvalStatus: 'approved' }).sort({ updatedAt: -1 }).limit(5000).select('_id updatedAt').lean(),
    Tour.find({ status: 'active', approvalStatus: 'approved' }).sort({ updatedAt: -1 }).limit(5000).select('_id updatedAt').lean(),
  ]);

  const urls = [
    urlEntry({ loc: '/hotels', changefreq: 'daily', priority: '0.9' }),
    urlEntry({ loc: '/cabs', changefreq: 'daily', priority: '0.8' }),
    urlEntry({ loc: '/tours', changefreq: 'daily', priority: '0.9' }),
    ...hotels.map((h) => urlEntry({ loc: `/hotels/${h._id}`, lastmod: h.updatedAt, changefreq: 'weekly', priority: '0.8' })),
    ...cabs.map((c) => urlEntry({ loc: `/cabs/${c._id}`, lastmod: c.updatedAt, changefreq: 'weekly', priority: '0.6' })),
    ...tours.map((t) => urlEntry({ loc: `/tours/${t._id}`, lastmod: t.updatedAt, changefreq: 'weekly', priority: '0.8' })),
  ];
  sendXml(res, urlset(urls));
});

router.get('/sitemap-images.xml', async (req, res) => {
  const [hotels, cabs, tours, products] = await Promise.all([
    Hotel.find({ status: 'active', approvalStatus: 'approved' }).sort({ updatedAt: -1 }).limit(2000).select('_id name image images').slice('images', 4).lean(),
    Cab.find({ status: 'available', approvalStatus: 'approved' }).sort({ updatedAt: -1 }).limit(2000).select('_id vehicleName image images').slice('images', 4).lean(),
    Tour.find({ status: 'active', approvalStatus: 'approved' }).sort({ updatedAt: -1 }).limit(2000).select('_id name image images').slice('images', 4).lean(),
    Product.find({ $or: [{ inStock: true }, { inStock: { $exists: false } }] }).sort({ updatedAt: -1 }).limit(2000).select('_id name images').slice('images', 4).lean(),
  ]);

  const listingImages = [];
  for (const h of hotels) {
    const set = normalizePublicImageSet(h, { max: 4 });
    listingImages.push(urlEntry({
      loc: `/hotels/${h._id}`,
      images: [set.image, ...(set.images || [])].map(absoluteAssetUrl).filter(Boolean).map((loc) => ({ loc, title: h.name })),
    }));
  }
  for (const c of cabs) {
    const set = normalizePublicImageSet(c, { max: 4 });
    listingImages.push(urlEntry({
      loc: `/cabs/${c._id}`,
      images: [set.image, ...(set.images || [])].map(absoluteAssetUrl).filter(Boolean).map((loc) => ({ loc, title: c.vehicleName })),
    }));
  }
  for (const t of tours) {
    const set = normalizePublicImageSet(t, { max: 4 });
    listingImages.push(urlEntry({
      loc: `/tours/${t._id}`,
      images: [set.image, ...(set.images || [])].map(absoluteAssetUrl).filter(Boolean).map((loc) => ({ loc, title: t.name })),
    }));
  }
  for (const p of products) {
    listingImages.push(urlEntry({
      loc: `/shop/${p._id}`,
      images: normalizePublicImages(p.images, { max: 4 }).map(absoluteAssetUrl).filter(Boolean).map((loc) => ({ loc, title: p.name })),
    }));
  }

  sendXml(res, urlset([
    urlEntry({ loc: '/', images: [{ loc: absoluteAssetUrl('/vrindasarthi%20logo.jpeg'), title: 'Vrindavan Sarthi logo' }] }),
    ...listingImages,
  ], { images: true }));
});

module.exports = router;

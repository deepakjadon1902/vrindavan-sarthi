const PLACEHOLDER_IMAGE = '/placeholder.svg';

const normalizeString = (value) => String(value || '').trim();

const stripLargeInlineImage = (value) => {
  const v = normalizeString(value);
  if (!v) return '';
  if (v.startsWith('data:') && v.length > 2048) return '';
  return v;
};

const normalizePublicImages = (values, { max = 4 } = {}) => {
  const list = Array.isArray(values) ? values : [];
  return list
    .map(stripLargeInlineImage)
    .filter(Boolean)
    .filter((img) => img !== PLACEHOLDER_IMAGE)
    .slice(0, Math.max(1, Number(max) || 4));
};

const normalizePublicImageSet = ({ image, images }, { max = 4, fallback = PLACEHOLDER_IMAGE } = {}) => {
  const cleanImages = normalizePublicImages(images, { max });
  const cleanImage = stripLargeInlineImage(image) || cleanImages[0] || fallback;
  const gallery = normalizePublicImages([cleanImage, ...cleanImages], { max });

  return {
    image: cleanImage,
    images: gallery.length ? gallery : cleanImage ? [cleanImage] : [],
  };
};

module.exports = {
  PLACEHOLDER_IMAGE,
  normalizePublicImages,
  normalizePublicImageSet,
  stripLargeInlineImage,
};

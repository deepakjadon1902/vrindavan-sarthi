const { uploadDataUri, isCloudinaryEnabled } = require('./cloudinary');

const normalizeString = (v) => String(v || '').trim();

const isDataImageUri = (v) => typeof v === 'string' && v.startsWith('data:image/');

const maybeUploadImageValue = async (value, { folder, tags } = {}) => {
  const v = normalizeString(value);
  if (!v) return '';
  if (!isDataImageUri(v)) return v;

  // If Cloudinary isn't configured, keep the existing value (backward compatible).
  if (!isCloudinaryEnabled()) return v;

  const url = await uploadDataUri(v, { folder, tags });
  return url || v;
};

const maybeUploadImageArray = async (values, { folder, tags, max = 12 } = {}) => {
  const arr = Array.isArray(values) ? values : [];
  const cleaned = arr.map(normalizeString).filter(Boolean);
  const limited = cleaned.slice(0, Math.max(0, Number(max) || 0) || 12);
  const out = await Promise.all(limited.map((v) => maybeUploadImageValue(v, { folder, tags })));
  return out.map(normalizeString).filter(Boolean);
};

// Mutates obj in-place (for req.body copies).
const normalizeImageFields = async (obj, { folder, tags, single = [], multi = [], maxPerMulti = 12 } = {}) => {
  if (!obj || typeof obj !== 'object') return obj;

  for (const key of single) {
    if (typeof obj[key] === 'undefined') continue;
    obj[key] = await maybeUploadImageValue(obj[key], { folder, tags });
  }

  for (const key of multi) {
    if (typeof obj[key] === 'undefined') continue;
    obj[key] = await maybeUploadImageArray(obj[key], { folder, tags, max: maxPerMulti });
  }

  return obj;
};

module.exports = {
  maybeUploadImageValue,
  maybeUploadImageArray,
  normalizeImageFields,
};


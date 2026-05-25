const cloudinary = require('cloudinary').v2;

let configured = false;
let enabled = false;

const configureIfNeeded = () => {
  if (configured) return;
  configured = true;

  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || '').trim();

  enabled = Boolean(cloudName && apiKey && apiSecret);
  if (!enabled) return;

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
};

const isCloudinaryEnabled = () => {
  configureIfNeeded();
  return enabled;
};

const getDefaultFolder = () => String(process.env.CLOUDINARY_FOLDER || 'vrindavan-sarthi').trim();

const uploadDataUri = async (dataUri, opts = {}) => {
  configureIfNeeded();
  if (!enabled) return null;

  const folder = String(opts.folder || getDefaultFolder()).trim();
  const uploadOpts = {
    folder,
    resource_type: 'image',
    overwrite: true,
  };

  if (Array.isArray(opts.tags) && opts.tags.length) uploadOpts.tags = opts.tags;
  if (opts.publicId) uploadOpts.public_id = String(opts.publicId);

  const res = await cloudinary.uploader.upload(String(dataUri), uploadOpts);
  return res?.secure_url || res?.url || null;
};

const dataUriFromBuffer = (buf, mime) => {
  const contentType = String(mime || 'image/png');
  const b64 = Buffer.isBuffer(buf) ? buf.toString('base64') : Buffer.from(buf || '').toString('base64');
  return `data:${contentType};base64,${b64}`;
};

module.exports = {
  isCloudinaryEnabled,
  uploadDataUri,
  dataUriFromBuffer,
  getDefaultFolder,
};


/* eslint-disable no-console */
require('dotenv').config();

const mongoose = require('mongoose');
const Hotel = require('../models/Hotel');
const Cab = require('../models/Cab');
const Tour = require('../models/Tour');
const Product = require('../models/Product');
const RoomType = require('../models/RoomType');
const Settings = require('../models/Settings');
const { normalizeImageFields } = require('../utils/imageFields');
const { isCloudinaryEnabled } = require('../utils/cloudinary');

const isDataImageUri = (v) => typeof v === 'string' && v.startsWith('data:image/');

const hasInlineImages = (doc, singleKeys = [], multiKeys = []) => {
  for (const k of singleKeys) if (isDataImageUri(doc?.[k])) return true;
  for (const k of multiKeys) if (Array.isArray(doc?.[k]) && doc[k].some(isDataImageUri)) return true;
  return false;
};

async function main() {
  const uri = String(process.env.MONGO_URI || '').trim();
  if (!uri) throw new Error('Missing MONGO_URI in backend/.env');
  if (!isCloudinaryEnabled()) throw new Error('Cloudinary not configured. Set CLOUDINARY_* in backend/.env');

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const migrateModel = async ({ name, Model, folder, single, multi }) => {
    console.log(`\n== ${name} ==`);
    const cursor = Model.find({}).cursor();
    let scanned = 0;
    let updated = 0;
    for await (const doc of cursor) {
      scanned += 1;
      if (!hasInlineImages(doc, single, multi)) continue;
      const body = doc.toObject ? doc.toObject() : { ...doc };
      await normalizeImageFields(body, { folder, single, multi, tags: [name] });
      for (const k of single) doc[k] = body[k];
      for (const k of multi) doc[k] = body[k];
      await doc.save();
      updated += 1;
      if (updated % 25 === 0) console.log(`updated ${updated}...`);
    }
    console.log(`scanned=${scanned} updated=${updated}`);
  };

  await migrateModel({ name: 'hotel', Model: Hotel, folder: 'vrindavan-sarthi/hotels', single: ['image'], multi: ['images'] });
  await migrateModel({ name: 'cab', Model: Cab, folder: 'vrindavan-sarthi/cabs', single: ['image'], multi: ['images'] });
  await migrateModel({ name: 'tour', Model: Tour, folder: 'vrindavan-sarthi/tours', single: ['image'], multi: ['images'] });
  await migrateModel({ name: 'product', Model: Product, folder: 'vrindavan-sarthi/products', single: [], multi: ['images'] });
  await migrateModel({ name: 'roomType', Model: RoomType, folder: 'vrindavan-sarthi/room-types', single: [], multi: ['images'] });
  await migrateModel({ name: 'settings', Model: Settings, folder: 'vrindavan-sarthi/settings', single: ['logoUrl', 'faviconUrl', 'ogImageUrl'], multi: [] });

  await mongoose.disconnect();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});


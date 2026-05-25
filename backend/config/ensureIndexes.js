const Hotel = require('../models/Hotel');
const RoomType = require('../models/RoomType');
const RoomUnit = require('../models/RoomUnit');
const Booking = require('../models/Booking');
const Cab = require('../models/Cab');
const Tour = require('../models/Tour');
const Order = require('../models/Order');
const Product = require('../models/Product');
const mongoose = require('mongoose');

const ensureIndexesOnce = (() => {
  let started = false;

  return async function ensureIndexes() {
    if (started) return;
    if (mongoose.connection.readyState !== 1) return;
    started = true;

    const models = [Hotel, RoomType, RoomUnit, Booking, Cab, Tour, Order, Product];

    for (const Model of models) {
      try {
        // Creates any missing indexes declared in schemas.
        await Model.createIndexes();
      } catch (err) {
        const msg = String(err?.message || err || '');
        // If an index already exists with the same name/options, don't spam logs.
        if (msg.toLowerCase().includes('existing index has the same name')) continue;
        console.error(`Index ensure failed for ${Model.modelName}:`, msg);
      }
    }
  };
})();

module.exports = { ensureIndexesOnce };

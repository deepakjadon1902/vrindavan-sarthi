const mongoose = require('../backend/node_modules/mongoose');
const path = require('path');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const { getRazorpayPayment } = require('../backend/utils/razorpay');

async function reconcile() {
  console.log('Testing Razorpay provider query capability (Read-Only)...');
  
  // 1. Test query for synthetic test payment ID from screenshot
  try {
    const testRes = await getRazorpayPayment('pay_dhr_1792951367339');
    console.log('Synthetic test ID result:', testRes);
  } catch (err) {
    console.log('Synthetic test ID query expectedly rejected by provider:', err.statusCode || err.code || err.message);
  }

  // 2. Test query for a real production payment ID from DB
  try {
    const realRes = await getRazorpayPayment('pay_TrN6Yaaj3wvpLk');
    console.log('Real payment pay_TrN6Yaaj3wvpLk query result:', {
      id: realRes.id,
      entity: realRes.entity,
      amount: realRes.amount,
      currency: realRes.currency,
      status: realRes.status,
      method: realRes.method,
      captured: realRes.captured,
      created_at: new Date(realRes.created_at * 1000).toISOString(),
    });
  } catch (err) {
    console.log('Real payment query failed:', err.statusCode || err.code || err.message);
  }
}

reconcile().catch(console.error);

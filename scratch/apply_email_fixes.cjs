const fs = require('fs');
const path = require('path');

// 1. Update backend/utils/email.js
{
  const emailPath = path.resolve(__dirname, '../backend/utils/email.js');
  let content = fs.readFileSync(emailPath, 'utf8');

  // Add Content-Length to postJson
  const oldPostJson = `const postJson = (urlString, { headers = {}, body, timeoutMs = 15_000 } = {}) =>
  new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: \`\${url.pathname}\${url.search}\`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        timeout: timeoutMs,
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode || 0, body: data }));
      }
    );
    req.on('timeout', () => req.destroy(new Error('Request timeout')));
    req.on('error', reject);
    req.write(JSON.stringify(body ?? {}));
    req.end();
  });`;

  const newPostJson = `const postJson = (urlString, { headers = {}, body, timeoutMs = 15_000 } = {}) =>
  new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const payload = JSON.stringify(body ?? {});
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: \`\${url.pathname}\${url.search}\`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...headers,
        },
        timeout: timeoutMs,
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode || 0, body: data }));
      }
    );
    req.on('timeout', () => req.destroy(new Error('Request timeout')));
    req.on('error', reject);
    req.write(payload);
    req.end();
  });`;

  // Update resendSendEmail to extract Resend error details and set statusCode
  const oldResendErr = `  const err = new Error(\`Resend send failed: HTTP \${resp.status}\`);
  err.code = 'RESEND_SEND_FAILED';
  throw err;`;

  const newResendErr = `  let resendMessage = '';
  try {
    const parsed = JSON.parse(resp.body || '{}');
    resendMessage = String(parsed?.message || parsed?.error || '').trim();
  } catch {}
  const err = new Error(\`Resend send failed: HTTP \${resp.status}\${resendMessage ? \` - \${resendMessage}\` : ''}\`);
  err.code = 'RESEND_SEND_FAILED';
  err.statusCode = resp.status;
  err.resendMessage = resendMessage;
  throw err;`;

  if (content.includes('headers: { \'Content-Type\': \'application/json\', ...headers },')) {
    content = content.replace(oldPostJson.replace(/\r\n/g, '\n'), newPostJson.replace(/\r\n/g, '\n'));
    content = content.replace(oldPostJson.replace(/\n/g, '\r\n'), newPostJson.replace(/\n/g, '\r\n'));
  }

  if (content.includes("err.code = 'RESEND_SEND_FAILED';")) {
    content = content.replace(oldResendErr.replace(/\r\n/g, '\n'), newResendErr.replace(/\r\n/g, '\n'));
    content = content.replace(oldResendErr.replace(/\n/g, '\r\n'), newResendErr.replace(/\n/g, '\r\n'));
  }

  fs.writeFileSync(emailPath, content, 'utf8');
  console.log('Updated backend/utils/email.js');
}

// 2. Update backend/utils/customerMessages.js
{
  const cmPath = path.resolve(__dirname, '../backend/utils/customerMessages.js');
  let content = fs.readFileSync(cmPath, 'utf8');

  const oldSendBookingInvoice = `const sendBookingInvoice = async (booking) => {
  const to = clean(booking.customerEmail || booking.userEmail);
  if (!to || booking.invoiceSentAt) return;`;

  const newSendBookingInvoice = `const sendBookingInvoice = async (booking) => {
  const to = clean(booking.customerEmail || booking.userEmail);
  if (booking.invoiceSentAt) return;
  if (!to) {
    const err = new Error('No customer email on booking for confirmation email');
    err.code = 'INVALID_RECIPIENT';
    throw err;
  }`;

  content = content.replace(oldSendBookingInvoice.replace(/\r\n/g, '\n'), newSendBookingInvoice.replace(/\r\n/g, '\n'));
  content = content.replace(oldSendBookingInvoice.replace(/\n/g, '\r\n'), newSendBookingInvoice.replace(/\n/g, '\r\n'));

  fs.writeFileSync(cmPath, content, 'utf8');
  console.log('Updated backend/utils/customerMessages.js');
}

// 3. Update backend/utils/notificationDelivery.js
{
  const ndPath = path.resolve(__dirname, '../backend/utils/notificationDelivery.js');
  let content = fs.readFileSync(ndPath, 'utf8');

  // Add immediateEmail fallback
  const oldEnsureDispatch = `    if (input.channel === 'web_push' &&
        options.immediateWebPush !== false &&
        (getWebPushConfig().configured || getFcmConfig().configured)) {
      await processNotificationDeliveryJob({ notificationDeliveryId: String(delivery._id) }).catch((err) => {
        console.warn('[notification.web_push.immediate_failed]', err?.message || err);
      });
    }`;

  const newEnsureDispatch = `    if (input.channel === 'web_push' &&
        options.immediateWebPush !== false &&
        (getWebPushConfig().configured || getFcmConfig().configured)) {
      await processNotificationDeliveryJob({ notificationDeliveryId: String(delivery._id) }).catch((err) => {
        console.warn('[notification.web_push.immediate_failed]', err?.message || err);
      });
    } else if (input.channel === 'email' && options.immediateEmail !== false) {
      await processNotificationDeliveryJob({ notificationDeliveryId: String(delivery._id) }).catch((err) => {
        console.warn('[notification.email.immediate_failed]', err?.message || err);
      });
    }`;

  content = content.replace(oldEnsureDispatch.replace(/\r\n/g, '\n'), newEnsureDispatch.replace(/\r\n/g, '\n'));
  content = content.replace(oldEnsureDispatch.replace(/\n/g, '\r\n'), newEnsureDispatch.replace(/\n/g, '\r\n'));

  // Update deliverWithDefaultProvider booking_invoice
  const oldBookingInvoiceDelivery = `    if (template === 'booking_invoice') {
      if (booking.invoiceSentAt) return { provider: 'internal', providerMessageId: 'already-sent' };
      const result = await sendBookingInvoice(booking);
      await Booking.updateOne({ _id: booking._id, invoiceSentAt: { $exists: false } }, { $set: { invoiceSentAt: new Date() } });
      return { provider: result?.provider || 'email', providerMessageId: result?.providerMessageId };
    }`;

  const newBookingInvoiceDelivery = `    if (template === 'booking_invoice') {
      if (booking.invoiceSentAt) return { provider: 'internal', providerMessageId: 'already-sent' };
      const recipient = String(booking.customerEmail || booking.userEmail || '').trim();
      if (!recipient) {
        const err = new Error('No customer email on booking for confirmation email');
        err.code = 'INVALID_RECIPIENT';
        throw err;
      }
      const result = await sendBookingInvoice(booking);
      if (!result) {
        const err = new Error('Booking confirmation email was not accepted by provider');
        err.code = 'EMAIL_NOT_ACCEPTED';
        throw err;
      }
      await Booking.updateOne({ _id: booking._id, invoiceSentAt: { $exists: false } }, { $set: { invoiceSentAt: new Date() } });
      return { provider: result?.provider || 'email', providerMessageId: result?.providerMessageId };
    }`;

  content = content.replace(oldBookingInvoiceDelivery.replace(/\r\n/g, '\n'), newBookingInvoiceDelivery.replace(/\r\n/g, '\n'));
  content = content.replace(oldBookingInvoiceDelivery.replace(/\n/g, '\r\n'), newBookingInvoiceDelivery.replace(/\n/g, '\r\n'));

  fs.writeFileSync(ndPath, content, 'utf8');
  console.log('Updated backend/utils/notificationDelivery.js');
}

// 4. Update backend/routes/payment.routes.js
{
  const prPath = path.resolve(__dirname, '../backend/routes/payment.routes.js');
  let content = fs.readFileSync(prPath, 'utf8');

  const oldPaymentVerify = `    const booking = await markBookingPaymentPaid(existing, {
      paymentProvider: 'manual_upi',
      actorId: req.user._id,
      actorRole: 'admin',
      reason: 'payment_admin_verified',
    });
    res.json({ success: true, data: booking });`;

  const newPaymentVerify = `    const booking = await markBookingPaymentPaid(existing, {
      paymentProvider: 'manual_upi',
      actorId: req.user._id,
      actorRole: 'admin',
      reason: 'payment_admin_verified',
    });
    const { ensureBookingInvoiceNotification } = require('../utils/notificationDelivery');
    await ensureBookingInvoiceNotification(booking);
    res.json({ success: true, data: booking });`;

  content = content.replace(oldPaymentVerify, newPaymentVerify);
  fs.writeFileSync(prPath, content, 'utf8');
  console.log('Updated backend/routes/payment.routes.js');
}

// 5. Update backend/utils/dharamshalaLifecycle.js
{
  const dlPath = path.resolve(__dirname, '../backend/utils/dharamshalaLifecycle.js');
  let content = fs.readFileSync(dlPath, 'utf8');

  const oldDharamshalaConfirm = `      booking.paymentStatus = 'not_required';
      booking.paymentHoldExpiresAt = undefined;
      await transitionBookingStatus(booking, 'confirmed', {
        actorId: actor?._id,
        actorRole: actor?.role || 'partner',
        reason: 'dharamshala_request_accepted_no_online_payment_required',
      });
    }`;

  const newDharamshalaConfirm = `      booking.paymentStatus = 'not_required';
      booking.paymentHoldExpiresAt = undefined;
      await transitionBookingStatus(booking, 'confirmed', {
        actorId: actor?._id,
        actorRole: actor?.role || 'partner',
        reason: 'dharamshala_request_accepted_no_online_payment_required',
      });
      try {
        const { ensureBookingInvoiceNotification } = require('./notificationDelivery');
        await ensureBookingInvoiceNotification(booking);
      } catch (notifyErr) {
        console.warn('[dharamshala.confirmed.notification_failed]', notifyErr?.message || notifyErr);
      }
    }`;

  content = content.replace(oldDharamshalaConfirm.replace(/\r\n/g, '\n'), newDharamshalaConfirm.replace(/\r\n/g, '\n'));
  content = content.replace(oldDharamshalaConfirm.replace(/\n/g, '\r\n'), newDharamshalaConfirm.replace(/\n/g, '\r\n'));

  fs.writeFileSync(dlPath, content, 'utf8');
  console.log('Updated backend/utils/dharamshalaLifecycle.js');
}

// 6. Update backend/routes/adminOperations.routes.js
{
  const aoPath = path.resolve(__dirname, '../backend/routes/adminOperations.routes.js');
  let content = fs.readFileSync(aoPath, 'utf8');

  const oldRetry = `    const queued = await enqueueNotificationDelivery(delivery);
    console.log(\`[operations] admin=\${req.user._id} action=notification_retry id=\${delivery._id}\`);
    res.json({ success: true, data: sanitizeNotificationDelivery(delivery), queued });`;

  const newRetry = `    const queued = await enqueueNotificationDelivery(delivery);
    if (delivery.channel === 'email') {
      const { processNotificationDeliveryJob } = require('../utils/notificationDelivery');
      await processNotificationDeliveryJob({ notificationDeliveryId: String(delivery._id) }).catch((err) => {
        console.warn('[operations.notification_retry.immediate_failed]', err?.message || err);
      });
    }
    console.log(\`[operations] admin=\${req.user._id} action=notification_retry id=\${delivery._id}\`);
    res.json({ success: true, data: sanitizeNotificationDelivery(delivery), queued });`;

  content = content.replace(oldRetry.replace(/\r\n/g, '\n'), newRetry.replace(/\r\n/g, '\n'));
  content = content.replace(oldRetry.replace(/\n/g, '\r\n'), newRetry.replace(/\n/g, '\r\n'));

  fs.writeFileSync(aoPath, content, 'utf8');
  console.log('Updated backend/routes/adminOperations.routes.js');
}

console.log('All email fixes applied successfully.');

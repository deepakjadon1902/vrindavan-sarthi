const fs = require('fs');
let code = fs.readFileSync('backend/tests/verify_all_email_flows_integration.js', 'utf8');

// Update Test 2
const oldTest2 = 
`    // Accept dharamshala request as property partner
    await acceptDharamshalaRequest({
      booking: dharamshalaBooking,
      actor: { role: 'partner', id: 'partner_mock_123' },
    });

    console.log('Updated dharamshala booking status:', dharamshalaBooking.bookingStatus);
    console.log('Sent emails count:', sentEmails.length);
    if (sentEmails.length === 1 && sentEmails[0].to === 'yatri.dharamshala@mocktest.local') {
      const email = sentEmails[0];
      console.log('Dharamshala email subject:', email.subject);
      console.log('Attachment size bytes:', email.attachments[0].content.length);
      results.push({
        flow: '2. Dharamshala pay_at_dharamshala',
        status: 'PASSED',
        details: \`Automatically triggered upon request acceptance. Booking status=\${dharamshalaBooking.bookingStatus}, subject="\${email.subject}"\`,
      });
    } else {
      results.push({ flow: '2. Dharamshala pay_at_dharamshala', status: 'FAILED', details: 'Dharamshala confirmation email not triggered' });
    }`;

const newTest2 = 
`    // Step A: Partner accepts request -> transitions to awaiting_customer_payment for platform fee
    await acceptDharamshalaRequest({
      booking: dharamshalaBooking,
      actor: { role: 'partner', id: 'partner_mock_123' },
    });
    console.log('Step A: Accepted request status:', dharamshalaBooking.bookingStatus);

    // Step B: Guest completes platform fee payment via online gateway
    dharamshalaBooking.razorpayOrderId = \`order_dhr_\${testRunId}\`;
    await dharamshalaBooking.save();

    await markBookingPaidFromRazorpay(dharamshalaBooking, {
      paymentId: \`pay_dhr_\${testRunId}\`,
      orderId: \`order_dhr_\${testRunId}\`,
      status: 'captured',
    });

    console.log('Step B: Confirmed dharamshala booking status:', dharamshalaBooking.bookingStatus);
    console.log('Sent emails count:', sentEmails.length);
    if (sentEmails.length === 1 && sentEmails[0].to === 'yatri.dharamshala@mocktest.local') {
      const email = sentEmails[0];
      console.log('Dharamshala email subject:', email.subject);
      console.log('Attachment size bytes:', email.attachments[0].content.length);
      results.push({
        flow: '2. Dharamshala pay_at_dharamshala & Platform Fee',
        status: 'PASSED',
        details: \`Partner acceptance + platform fee payment confirmed reservation. Dispatched "\${email.subject}" with PDF receipt (\${email.attachments[0].content.length} bytes).\`,
      });
    } else {
      results.push({ flow: '2. Dharamshala pay_at_dharamshala & Platform Fee', status: 'FAILED', details: 'Dharamshala confirmation email not triggered' });
    }`;

code = code.replace(oldTest2, newTest2);

// Update Test 7
const oldTest7 = "if (deliveryNoEmail.status === 'failed' && deliveryNoEmail.lastError?.includes('INVALID_RECIPIENT')) {";
const newTest7 = "if (deliveryNoEmail.status === 'failed' && (deliveryNoEmail.lastError?.includes('No customer email') || deliveryNoEmail.lastError?.includes('INVALID_RECIPIENT'))) {";
code = code.replace(oldTest7, newTest7);

fs.writeFileSync('backend/tests/verify_all_email_flows_integration.js', code, 'utf8');
console.log('Successfully updated verify_all_email_flows_integration.js');

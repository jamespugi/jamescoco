import test from 'node:test';
import assert from 'node:assert/strict';

process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';
process.env.TWILIO_FROM_NUMBER = '+15551234567';

const originalFetch = globalThis.fetch;
const { sendOtpSms } = await import('./smsService.js');

test('Twilio receives an authenticated SMS request with the OTP', async () => {
  let requestUrl = '';
  let requestOptions;
  globalThis.fetch = async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return new Response('{}', { status: 201 });
  };

  try {
    const result = await sendOtpSms({
      to: '+639171234567',
      purpose: 'verify_email',
      otp: '012345',
    });

    assert.equal(result.sent, true);
    assert.equal(
      requestUrl,
      'https://api.twilio.com/2010-04-01/Accounts/AC123456789/Messages.json'
    );
    assert.equal(
      requestOptions.headers.Authorization,
      `Basic ${Buffer.from('AC123456789:test-auth-token').toString('base64')}`
    );

    const body = new URLSearchParams(requestOptions.body);
    assert.equal(body.get('To'), '+639171234567');
    assert.equal(body.get('From'), '+15551234567');
    assert.match(body.get('Body'), /012345/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

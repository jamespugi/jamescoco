const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER || '';
const TWILIO_MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID || '';

export function isSmsConfigured() {
  return Boolean(
    TWILIO_ACCOUNT_SID &&
    TWILIO_AUTH_TOKEN &&
    (TWILIO_FROM_NUMBER || TWILIO_MESSAGING_SERVICE_SID)
  );
}

export async function sendOtpSms({ to, purpose, otp, expiresMinutes = 10 }) {
  if (!isSmsConfigured()) {
    return { sent: false, reason: 'Twilio SMS is not configured on the server.' };
  }

  const action = purpose === 'verify_email' ? 'account verification' : 'password reset';
  const body = `Your Cocolytics ${action} code is ${otp}. It expires in ${expiresMinutes} minutes. Do not share this code.`;
  const form = new URLSearchParams({
    To: to,
    Body: body,
  });

  if (TWILIO_MESSAGING_SERVICE_SID) {
    form.set('MessagingServiceSid', TWILIO_MESSAGING_SERVICE_SID);
  } else {
    form.set('From', TWILIO_FROM_NUMBER);
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(TWILIO_ACCOUNT_SID)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form,
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('Twilio rejected OTP SMS:', error.message || `HTTP ${response.status}`);
      return { sent: false, reason: 'The SMS provider could not deliver the code.' };
    }

    return { sent: true };
  } catch (error) {
    console.error('Could not send OTP SMS:', error.message || String(error));
    return { sent: false, reason: 'Could not connect to the SMS provider.' };
  }
}

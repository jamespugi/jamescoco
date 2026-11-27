import assert from 'node:assert/strict';
import test from 'node:test';
import { getSmtpConfigurationError, sanitizeSmtpError } from './emailService.js';

test('identifies missing or placeholder SMTP settings by environment variable', () => {
  const error = getSmtpConfigurationError({
    SMTP_USER: 'your-email@gmail.com',
    SMTP_PASS: '',
  });

  assert.equal(
    error,
    'Email delivery is not configured. Set valid values for SMTP_USER, SMTP_PASS in backend/.env.'
  );
});

test('sanitizes SMTP diagnostics before they are logged', () => {
  const credentials = {
    SMTP_USER: 'sender@example.com',
    SMTP_PASS: 'private app password',
    SMTP_FROM_EMAIL: 'sender@example.com',
  };
  const diagnostic = sanitizeSmtpError({
    code: 'EAUTH',
    responseCode: 535,
    message: 'Invalid login for sender@example.com with privateapppassword.',
  }, credentials);

  assert.match(diagnostic, /code=EAUTH/);
  assert.match(diagnostic, /responseCode=535/);
  assert.doesNotMatch(diagnostic, /sender@example\.com|private.?app.?password/);
  assert.match(diagnostic, /\[redacted\]|\[email\]/);
});

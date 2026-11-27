import { timingSafeEqual } from 'node:crypto';

const MIN_ADMIN_SIGNUP_CODE_BYTES = 32;
const MAX_ADMIN_SIGNUP_CODE_BYTES = 256;

export function isAdminSignupCodeConfigured(value = process.env.ADMIN_SIGNUP_CODE) {
  if (typeof value !== 'string') {
    return false;
  }

  const byteLength = Buffer.byteLength(value, 'utf8');
  return byteLength >= MIN_ADMIN_SIGNUP_CODE_BYTES && byteLength <= MAX_ADMIN_SIGNUP_CODE_BYTES;
}

export function matchesAdminSignupCode(candidate, expected = process.env.ADMIN_SIGNUP_CODE) {
  if (typeof candidate !== 'string' || !isAdminSignupCodeConfigured(expected)) {
    return false;
  }

  const candidateBuffer = Buffer.from(candidate, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  return candidateBuffer.length === expectedBuffer.length
    && timingSafeEqual(candidateBuffer, expectedBuffer);
}

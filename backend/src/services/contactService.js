export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

export function normalizePhoneNumber(phone) {
  const normalized = String(phone || '').trim().replace(/[\s()-]/g, '');
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : '';
}

export function getContactChannel(contact) {
  return String(contact || '').includes('@') ? 'email' : 'phone';
}

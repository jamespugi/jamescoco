const DEVELOPMENT_SECRET = 'change-this-secret';

export function getJwtSecret(env = process.env) {
  const secret = env.JWT_SECRET || '';

  if (env.NODE_ENV === 'production' && (secret.length < 32 || secret === DEVELOPMENT_SECRET)) {
    throw new Error('Set JWT_SECRET to a unique random value of at least 32 characters in production.');
  }

  return secret || DEVELOPMENT_SECRET;
}

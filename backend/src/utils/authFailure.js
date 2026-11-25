const DATABASE_CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ER_ACCESS_DENIED_ERROR',
  'ER_BAD_DB_ERROR',
  'PROTOCOL_CONNECTION_LOST',
  'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
]);

export function respondToAuthFailure(res, error, operation, fallbackMessage, fallbackStatus = 500) {
  const isDatabaseUnavailable = DATABASE_CONNECTION_ERROR_CODES.has(error?.code);
  console.error(
    `${operation} failed:`,
    error?.code || error?.message || String(error)
  );

  if (isDatabaseUnavailable) {
    return res.status(503).json({
      error: 'The database connection is unavailable. Please try again shortly.',
      code: 'DATABASE_UNAVAILABLE',
    });
  }

  return res.status(fallbackStatus).json({ error: fallbackMessage });
}

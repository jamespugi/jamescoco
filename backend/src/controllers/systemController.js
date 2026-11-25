import { pool } from '../db.js';

export async function health(_req, res) {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({
      ok: true,
      service: 'backend',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Database health check failed:', error?.code || error?.message || String(error));
    res.status(503).json({
      ok: false,
      service: 'backend',
      error: 'Database is unavailable.',
    });
  }
}

export function apiInfo(_req, res) {
  res.status(200).json({
    message: 'Cocolytics backend API is running.',
    docs: '/api/health',
  });
}

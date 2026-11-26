function parseDatabaseUrl(value) {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error('DATABASE_URL or MYSQL_URL is not a valid MySQL connection URL.');
  }

  if (url.protocol !== 'mysql:' || !url.hostname || !url.pathname.slice(1)) {
    throw new Error('DATABASE_URL or MYSQL_URL must include a MySQL host and database name.');
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
  };
}

function parseInteger(value, fallback, name, minimum) {
  if (value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new Error(`${name} must be an integer greater than or equal to ${minimum}.`);
  }

  return parsed;
}

export function createMysqlConfig(env = process.env) {
  const isProduction = env.NODE_ENV === 'production';
  const url = env.DATABASE_URL || env.MYSQL_URL;
  const urlConfig = url ? parseDatabaseUrl(url) : {};
  const configuredPassword = env.DB_PASSWORD || env.MYSQLPASSWORD || env.MYSQL_PASSWORD || urlConfig.password;
  const allowEmptyPassword = env.DB_ALLOW_EMPTY_PASSWORD === 'true';
  const explicitlyEmptyPassword =
    env.DB_PASSWORD === '' ||
    env.MYSQLPASSWORD === '' ||
    env.MYSQL_PASSWORD === '' ||
    (Boolean(url) && urlConfig.password === '');
  const emptyPasswordAllowed = allowEmptyPassword && explicitlyEmptyPassword;
  const config = {
    host: env.DB_HOST || env.MYSQLHOST || env.MYSQL_HOST || urlConfig.host || (isProduction ? '' : 'localhost'),
    port: parseInteger(env.DB_PORT || env.MYSQLPORT || env.MYSQL_PORT || urlConfig.port, 3306, 'DB_PORT', 1),
    user: env.DB_USER || env.MYSQLUSER || env.MYSQL_USER || urlConfig.user || (isProduction ? '' : 'root'),
    password: configuredPassword || (emptyPasswordAllowed ? '' : (isProduction ? undefined : '')),
    database: env.DB_NAME || env.MYSQLDATABASE || env.MYSQL_DATABASE || urlConfig.database || (isProduction ? '' : 'new_cocolytics'),
  };

  const missing = [
    ['host', config.host, 'DB_HOST, MYSQLHOST, MYSQL_HOST, or a MySQL URL'],
    ['user', config.user, 'DB_USER, MYSQLUSER, MYSQL_USER, or a MySQL URL'],
    [
      'password',
      configuredPassword || emptyPasswordAllowed,
      'DB_PASSWORD, MYSQLPASSWORD, MYSQL_PASSWORD, or a MySQL URL (set DB_ALLOW_EMPTY_PASSWORD=true only when the MySQL password is intentionally blank)',
    ],
    ['database', config.database, 'DB_NAME, MYSQLDATABASE, MYSQL_DATABASE, or a MySQL URL'],
  ].filter(([, value]) => !value);

  if (isProduction && missing.length) {
    throw new Error(`Missing production database configuration: ${missing.map(([, , name]) => name).join('; ')}.`);
  }

  if (!/^[A-Za-z0-9_$-]+$/.test(config.database)) {
    throw new Error('Database name may contain only letters, numbers, underscores, dollar signs, and hyphens.');
  }

  const baseConfig = {
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    multipleStatements: true,
    ...(env.DB_SSL === 'true' ? { ssl: {} } : {}),
  };
  const connectionLimit = parseInteger(env.DB_CONNECTION_LIMIT, 10, 'DB_CONNECTION_LIMIT', 1);
  const queueLimit = parseInteger(env.DB_QUEUE_LIMIT, isProduction ? 50 : 0, 'DB_QUEUE_LIMIT', 0);

  return {
    database: config.database,
    baseConfig,
    poolConfig: {
      ...baseConfig,
      database: config.database,
      waitForConnections: true,
      connectionLimit,
      queueLimit,
    },
  };
}

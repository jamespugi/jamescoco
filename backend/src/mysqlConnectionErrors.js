export function getMysqlConnectionErrorMessage(error, { host, port, database }) {
  switch (error?.code) {
    case 'EAI_AGAIN':
    case 'ENOTFOUND':
      return `Cannot resolve MySQL hostname "${host}" (${error.code}). Set DB_HOST to the exact internal hostname provided by Dokploy and ensure the app and MySQL services share a Docker network.`;
    case 'ECONNREFUSED':
    case 'ETIMEDOUT':
    case 'ECONNRESET':
      return `Cannot reach MySQL at ${host}:${port} (${error.code}). Verify DB_HOST, DB_PORT, that MySQL is running, and that both services share a Docker network.`;
    case 'ER_ACCESS_DENIED_ERROR':
      return 'MySQL rejected the configured credentials. Verify DB_USER, DB_PASSWORD, and the user’s privileges for DB_NAME.';
    case 'ER_BAD_DB_ERROR':
      return `MySQL database "${database}" was not found. Verify DB_NAME and import the schema before starting the app.`;
    default:
      return `MySQL connection failed${error?.code ? ` (${error.code})` : ''}. Verify DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, and DB_NAME.`;
  }
}

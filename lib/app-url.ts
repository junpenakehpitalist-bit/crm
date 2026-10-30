/** Public base URL of the app (no trailing slash). AUTH_URL (Auth.js v5) wins over NEXTAUTH_URL. */
export function getAppUrl(): string {
  const url = process.env.AUTH_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return url.replace(/\/+$/, '');
}

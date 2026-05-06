/**
 * Service to fetch configuration values
 * Stores AppURL from environment variable for use across the app
 */

let cachedAppUrl = '';

export function setAppUrl(url: string): void {
  cachedAppUrl = url;
  localStorage.setItem('AppURL', url);
  console.log('📍 AppURL set:', url);
}

export function getAppUrl(): string {
  // Try cache first
  if (cachedAppUrl) return cachedAppUrl;

  // Try localStorage
  const stored = localStorage.getItem('AppURL');
  if (stored) {
    cachedAppUrl = stored;
    return stored;
  }

  console.warn('⚠️ AppURL not configured');
  return '';
}

export function initializeAppConfig(appUrl: string): void {
  setAppUrl(appUrl);
}

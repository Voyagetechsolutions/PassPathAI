import Constants from 'expo-constants';

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

interface AppExtra {
  apiBaseUrl: string;
  firebase: FirebaseConfig;
}

const extra = (Constants.expoConfig?.extra ?? {}) as Partial<AppExtra>;

const API_PORT = 3000;

/**
 * The backend runs on the SAME machine as the Metro bundler during development.
 * Expo always knows Metro's host (the laptop's current LAN IP), so we derive the
 * API address from it. This means the app automatically follows the laptop's IP
 * — which changes whenever DHCP reassigns it — instead of breaking against a
 * hardcoded IP. In a production build there is no Metro host, so we fall back to
 * the configured apiBaseUrl, then localhost.
 */
function deriveApiBaseUrl(): string {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    // Expo Go / older runtimes expose the dev host under different keys.
    (Constants as unknown as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost ??
    (Constants as unknown as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost ??
    '';
  const host = String(hostUri).split(':')[0]?.trim();
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:${API_PORT}/api`;
  }
  return extra.apiBaseUrl ?? `http://localhost:${API_PORT}/api`;
}

export const API_BASE_URL = deriveApiBaseUrl();
export const FIREBASE_CONFIG: FirebaseConfig = {
  apiKey: extra.firebase?.apiKey ?? '',
  authDomain: extra.firebase?.authDomain ?? '',
  projectId: extra.firebase?.projectId ?? '',
  appId: extra.firebase?.appId ?? '',
};

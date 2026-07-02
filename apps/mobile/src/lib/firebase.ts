import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
// getReactNativePersistence is exported by firebase/auth but missing from its
// public type surface in some 10.x builds, hence the explicit import shape.
import {
  getAuth,
  initializeAuth,
  // @ts-expect-error — present at runtime, absent from the bundled type defs.
  getReactNativePersistence,
  type Auth,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FIREBASE_CONFIG } from './config';

let app: FirebaseApp | undefined;
let auth: Auth | undefined;

/**
 * Returns the Firebase Auth instance configured for React Native / Expo Go, with
 * AsyncStorage persistence so sessions survive app restarts. `initializeAuth`
 * must be used (not `getAuth`) to register native persistence — falling back to
 * `getAuth` only if it was already initialised (e.g. on Fast Refresh).
 */
export function getFirebaseAuth(): Auth {
  if (!FIREBASE_CONFIG.apiKey) {
    throw new Error('Firebase config missing. Set expo.extra.firebase in app.json.');
  }
  if (!app) {
    app = getApps()[0] ?? initializeApp(FIREBASE_CONFIG);
  }
  if (!auth) {
    try {
      auth =
        typeof getReactNativePersistence === 'function'
          ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
          : initializeAuth(app);
    } catch {
      // Already initialised (Fast Refresh) — reuse the existing instance.
      auth = getAuth(app);
    }
  }
  return auth;
}

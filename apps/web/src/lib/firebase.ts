import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | undefined;

/** Lazily initialise Firebase so a missing config never breaks the build. */
export function getFirebaseAuth(): Auth {
  if (!config.apiKey) {
    throw new Error('Firebase web config is missing. Set NEXT_PUBLIC_FIREBASE_* env vars.');
  }
  if (!app) {
    app = getApps()[0] ?? initializeApp(config);
  }
  return getAuth(app);
}

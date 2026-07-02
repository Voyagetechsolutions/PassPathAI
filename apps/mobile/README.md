# PassPath Mobile (Expo)

React Native student app built with **Expo SDK 54** (React Native 0.81, React 19)
+ Expo Router + TypeScript. Runs in **Expo Go (SDK 54)**.

## Quick Start with Demo Accounts

PassPath includes a **dev-only auth path** so you can run the app without Firebase:

```bash
npm install

# 1. Start the backend with dev auth enabled (see main DEMO.md)
cd ../backend
npm run db:seed-demo        # creates 3 demo accounts
npm run start:dev

# 2. Update app.json → expo.extra.apiBaseUrl
#    Use your machine's LAN IP (NOT localhost):
#    "apiBaseUrl": "http://192.168.x.x:3000/api"

# 3. Start Expo
npx expo start               # scan QR with Expo Go (SDK 54)
```

On the login screen, tap one of the **demo account buttons**:
- Demo Student Account
- Demo Parent Account
- Demo Admin Account

No Firebase configuration needed for demo mode!

## Run on Expo Go (Production Firebase)

```bash
npm install                     # uses .npmrc (legacy-peer-deps) for RN peer ranges

# In app.json → expo.extra, configure:
#   apiBaseUrl: "http://<YOUR-LAN-IP>:3000/api"   (NOT localhost — the phone needs your machine's IP)
#   firebase:   your Firebase Web SDK config (get from Firebase Console → Project Settings → Web App)

npx expo start                  # scan the QR with the Expo Go app (SDK 54)
```

**Firebase Configuration** (required for production Firebase auth):

In `app.json`, set `expo.extra.firebase`:

```json
"firebase": {
  "apiKey": "AIza...",
  "authDomain": "your-project.firebaseapp.com",
  "projectId": "your-project-id",
  "appId": "1:123456789:web:abc..."
}
```

Get these values from the Firebase Console:
1. Go to **Project Settings** → **General**
2. Scroll to **Your apps** → Select your web app (or create one)
3. Copy the config values

The backend must be reachable from your phone — run it and use your machine's
LAN IP (e.g. `http://192.168.x.x:3000/api`), since `localhost` on the phone is the
phone itself.

> Production note: `expo export` (AOT Hermes bytecode via the bundled
> `hermesc`) can choke on RN 0.81's `DOMRect` private-field syntax on some
> platforms — that's an export-only tooling quirk. **Expo Go is unaffected**: it
> loads the Metro JS bundle and runs it on its own Hermes runtime. For production
> binaries use EAS Build. The Metro dev bundle (what Expo Go uses) is verified to
> compile for both Android and iOS.

Configure `expo.extra` in [app.json](app.json):

- `apiBaseUrl` — the backend API base (default `http://localhost:3000/api`).
  On a physical device use your machine's LAN IP, not `localhost`.
- `firebase` — the Firebase Web SDK config (optional for dev mode, required for production).

## Authentication Modes

### Dev Mode (No Firebase Required)

The app supports **dev-login** via the backend's `POST /auth/dev-login` endpoint:

1. Backend must have `ENABLE_DEV_AUTH=true` in `.env`
2. Run `npm run db:seed-demo` to create demo accounts
3. Tap demo account buttons on the login screen

Demo credentials:
- `student@demo.passpath.app` / `passpath-demo`
- `parent@demo.passpath.app` / `passpath-demo`
- `admin@demo.passpath.app` / `passpath-demo`

⚠️ **Dev auth is automatically disabled in production** (`NODE_ENV=production`).

### Production Mode (Firebase)

Standard Firebase email/password authentication:

1. Configure `expo.extra.firebase` in `app.json` with your Firebase Web SDK config
2. Users must be registered via backend `POST /auth/register` or the web app
3. Login with Firebase credentials on the app login screen

## Structure

```
app/                      Expo Router routes (file-based)
├─ _layout.tsx            Root stack + AuthProvider
├─ index.tsx              Auth gate → redirects to tabs or login
├─ login.tsx             Email/password sign-in (Firebase)
└─ (tabs)/
   ├─ _layout.tsx         Bottom tabs (auth-guarded)
   ├─ index.tsx           Performance dashboard
   ├─ ask.tsx             Grounded AI Q&A (refuses when no source)
   ├─ roadmap.tsx         Today's missions + generate plan
   └─ profile.tsx         Account, countdowns, sign out
src/
├─ lib/                   config, firebase, api client, auth context, useApi
├─ components/ui.tsx      Card / Stat / Loading / Error / Empty
└─ theme.ts               Colors, spacing, radius
```

## Auth

The app supports two authentication modes:

**1. Dev Mode (demo accounts):**
- Uses backend `POST /auth/dev-login` endpoint
- Returns dev token format: `dev:<userId>`
- No Firebase required
- Enabled when backend has `ENABLE_DEV_AUTH=true`

**2. Production Mode (Firebase):**
- Firebase email/password → ID token sent as `Authorization: Bearer <token>` to backend
- Token verified server-side; profile comes from `GET /auth/me`
- New accounts must first be registered via backend `POST /auth/register` (or web app)
- Requires Firebase Web SDK config in `app.json`

See the main [DEMO.md](../../DEMO.md) for complete setup instructions.

> Note: Expo apps run via Metro on a device/simulator — there is no headless
> production "build" step like the web app. Type-check with `npm run typecheck`.

## Troubleshooting

**"Firebase config missing" error:**
- For dev mode: Ignore this if using demo accounts (dev-login doesn't need Firebase)
- For production: Set `expo.extra.firebase` in `app.json` with your Firebase Web SDK config

**"Network request failed" / Can't connect to backend:**
- Check `expo.extra.apiBaseUrl` uses your LAN IP, not `localhost`
- Find your LAN IP:
  - macOS/Linux: `ifconfig | grep "inet "`
  - Windows: `ipconfig | findstr IPv4`
- Ensure backend is running and accessible from your network
- Check firewall isn't blocking port 3000

**"Dev auth is disabled" / Demo login fails:**
- Verify backend `.env` has `ENABLE_DEV_AUTH=true`
- Restart backend server after changing env vars
- Confirm demo accounts exist: `cd apps/backend && npm run db:seed-demo`

**Expo Go version mismatch:**
- This app requires **Expo SDK 54**
- Update Expo Go to the latest version from the App Store / Play Store
- Check SDK version: `npx expo --version`

**Type errors or build issues:**
- Run `npm run typecheck` to check for TypeScript errors
- Clean and reinstall: `rm -rf node_modules && npm install`
- Clear Metro bundler cache: `npx expo start -c`

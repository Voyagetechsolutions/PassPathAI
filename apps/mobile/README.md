# PassPath Mobile

Expo/React Native client for Android and iOS. The app talks to the PassPath API;
accounts and password hashes are stored in the backend's PostgreSQL database on AWS.

## Run

```bash
npm install
npm start
```

Set `expo.extra.apiBaseUrl` in `app.json` to the deployed API URL. During local
Expo development the app derives the backend host from Metro automatically.

The auth context calls `/auth/register` and `/auth/login`, stores the signed
access token in AsyncStorage, restores it on launch, and attaches it to API calls.

## Play Store bundle

The `production` profile in `eas.json` builds an Android App Bundle:

```bash
npx eas-cli build --platform android --profile production
```

Upload the resulting `.aab` file to a Play Console release.

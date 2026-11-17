# Vrindavan Sarthi Enterprises Frontend

Vite + React + TypeScript frontend for Vrindavan Sarthi Enterprises.

## Android customer app

The Capacitor Android project is kept in `frontend/android`; the existing partner Android project remains in the repository-root `android` directory.

For a local Android build, copy `android.env.example` to `.env.android`, then run:

```powershell
npm install
npm run build:android
npx cap sync android
npx cap open android
```

The Android build reads `VITE_API_BASE_URL` from `.env.android`. The backend CORS allowlist now permits Capacitor's Android origin (`https://localhost`) while retaining the website origins. Deploy the `backend/server.js` change to Render before testing API-backed data. Alternatively, append `https://localhost` to the Render service's `CORS_ORIGINS` value without removing its existing domains, then redeploy. Confirm `OPTIONS /api/public-stats` allows the `https://localhost` origin. The frontend uses bearer-token authorization, not cookie credentials.

Android Google sign-in opens the authorization flow in the system browser and returns to the app through `com.vrindavansarthi.app://oauth/callback`. Deploy `backend/routes/auth.routes.js` to Render along with the APK so the callback can return to the native app. The existing HTTPS Google OAuth redirect URI remains unchanged. The customer project's Gradle wrapper is pinned to 8.14.3 for its Android Gradle Plugin 8.13.0; the root partner Android project has its own wrapper.

For Android Studio builds, select a Java 21 JDK under **Settings → Build Tools → Gradle → Gradle JDK**. This machine's bundled Java 25 is incompatible with the generated Gradle 8.14.3 wrapper; the successful debug build used Java 21.

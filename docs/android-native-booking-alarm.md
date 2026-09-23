# Android Native Booking Alarm

The browser/PWA path can show lock-screen Web Push notifications, but Chrome cannot choose the phone alarm ringtone or play `alarm.mp3` while the device is locked.

This `android/` project is the native path for locked-phone alarm behavior:

- Loads `https://www.vrindavansarthi.in/admin` in a WebView.
- Reads the existing web login token from `localStorage` after login.
- Registers the device FCM token with `POST /api/notifications/devices`.
- Receives booking alarms through Firebase Cloud Messaging.
- Shows a native Android `Booking Alarm` notification channel using the device default alarm ringtone when available.
- Uses high-priority, public, ongoing alarm-style notifications on lock screen.

## Required Firebase Setup

1. Create/open a Firebase project.
2. Add Android app package:

   `in.vrindavansarthi.alarm`

3. Download `google-services.json`.
4. Place it at:

   `android/app/google-services.json`

5. Create a Firebase service account key for backend FCM HTTP v1.
6. Set backend environment variables:

```env
FCM_PROJECT_ID=your-firebase-project-id
FCM_CLIENT_EMAIL=firebase-adminsdk-...@your-project.iam.gserviceaccount.com
FCM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Keep `FCM_PRIVATE_KEY` secret. Do not commit real keys.

## Build

This machine currently needs Android tooling before a local shell build can run:

- Java is not available in PATH.
- Android SDK was not found in the standard local path.
- `android/gradlew.bat` is not present yet.

Use Android Studio for the first build:

1. Install Android Studio.
2. Open the project folder:

   `C:\Users\in\Documents\vrindavan-sarthi\android`

3. Let Android Studio install/sync:

   - Android Gradle Plugin
   - Gradle
   - Android SDK Platform 35
   - Build tools

4. Confirm this real file exists:

   `android/app/google-services.json`

   A non-secret example is committed at:

   `android/app/google-services.example.json`

5. Connect the phone with USB debugging enabled.
6. Click **Run** in Android Studio.
7. Log in as Admin or Partner inside the app.
8. Accept notification permission.

After Android Studio creates the Gradle wrapper, future command-line builds can use:

```powershell
cd android
.\gradlew.bat assembleDebug
```

## Phone Settings

After installing:

1. Open the Vrindavan Sarthi Android app.
2. Log in as Admin or Partner.
3. Accept notification permission.
4. In Android app notification settings, open the `Booking Alarm` channel.
5. Confirm sound is enabled. Android may let the user choose the exact ringtone for that channel.
6. Disable battery restriction for the app for most reliable delivery.

## Behavior

When a booking alarm is created:

- Web/PWA devices receive Web Push.
- Native Android devices receive FCM.
- The native app displays the alarm through the `Booking Alarm` Android channel.
- If the app is open, the web UI can still play `alarm.mp3`.
- If the phone is locked, Android controls the channel sound/ringtone.

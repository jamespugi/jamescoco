# Cocolytics Frontend

## Install Flow

The app now supports both install methods from the UI:

- Native Android package download (preferred on Android)
- Browser install prompt (PWA fallback)

### Home Install Button Behavior

When users tap Install:

1. If device is Android and an APK is available, download starts automatically.
2. If no APK is available, app uses browser install prompt when supported.
3. If prompt is unavailable (for example iOS), manual install instructions are shown.

## Native APK Setup

Use either option:

- Place APK at `public/downloads/cocolytics-android.apk`
- Or set `VITE_NATIVE_APP_DOWNLOAD_URL` to a hosted APK URL

Example `.env` entry:

`VITE_NATIVE_APP_DOWNLOAD_URL=https://your-domain.com/releases/cocolytics-android.apk`

## Ionic Android App

The existing Vue app is wrapped with Ionic Vue and Capacitor for Android.

1. Set `VITE_API_BASE_URL` in `frontend/.env.production` to the HTTPS origin of the deployed Cocolytics backend (for example, `https://api.example.com`). The Android app cannot use the Vite development proxy.
2. Ensure the backend allows the Android WebView origin `https://localhost`; it is allowed by the backend CORS configuration.
3. From `frontend`, run `npm install` and `npm run android:sync`.
4. Run `npm run android:open` to open the generated project in Android Studio, then build an APK there.

Android Studio and the Android SDK are required to build and install the APK. After changing frontend code or the backend URL, run `npm run android:sync` again.

## Commands

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run android:sync`
- `npm run android:open`

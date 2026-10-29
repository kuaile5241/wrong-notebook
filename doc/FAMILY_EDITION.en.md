# Colorful family learning edition

Maintained at https://github.com/kuaile5241/wrong-notebook with upstream MIT notices retained.

The interface uses sky blue, violet, mint, coral and warm amber. Questions, correct answers, attempts, explanations and mistake causes use distinct labeled panels across entry, correction, preview and detail views. Navigation, subject cards and knowledge tags have color accents. Dark mode, mobile layout, reduced motion and existing print layouts remain supported.

The Android online client uses package `com.kuaile5241.wrongnotebook`. It connects to the deployed server by default; override with `-PclientServerUrl=https://your-domain.example`. No account, password, AI key, database or backend is bundled. Website fixes appear when the app is reopened online without reinstalling. Changes to native capabilities still require a new APK signed with the same persistent key. Camera, gallery, downloads, printing and server selection remain available. The phone variant is portrait; the tablet variant rotates.

Use the existing client packaging command or `packaging/android/build-client.ps1` with a Windows JDK and Android SDK. Keep signing material outside Git and back it up.

`packaging/Dockerfile.family` builds this repository on a verified runtime image. Pin `RUNTIME_IMAGE` by digest and provide `APP_REVISION` and `APP_VERSION`. It runs lint, all Vitest tests, template database initialization and a production build. Before deployment, back up the live SQLite database with its backup API and preserve settings, environment and Compose. Replace only this app image, preserving mounts, ports and resource limits, with `PRESERVE_EXISTING_DATA=true`. Roll back the Compose configuration and matching consistent database backup on failure; do not restart unrelated services.

#!/usr/bin/env bash
# Kassa ilovasining yangi Android APK sini yig'adi va repo ildiziga
# e-kassam.apk (git-ignored) qilib qo'yadi. Istalgan joydan: ./build-apk.sh
#
#  1. Vite web build (dist/ yangilanadi — PROD, ya'ni api.e-kassam.uz)
#  2. Capacitor sync — web build Android loyihaga nusxalanadi
#  3. gradlew assembleDebug o'suvchi versionCode bilan (epoch-daqiqa) —
#     har yangi APK o'rnatilganining USTIGA tushadi
#  4. APK ildizga nusxalanadi
#
# (uyijara'dagi build-apk.sh bilan bir xil qolip.)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "==> 1/4 Web build (vite)"
npm run build

echo "==> 2/4 Capacitor sync (android)"
npx --no-install cap sync android

VCODE=$(( $(date +%s) / 60 ))
VNAME="$(date +%Y.%m.%d-%H%M)"

echo "==> 3/4 Gradle assembleDebug (versionCode=$VCODE, versionName=$VNAME)"
cd "$ROOT/android"
./gradlew --console=plain assembleDebug \
  -PappVersionCode="$VCODE" -PappVersionName="$VNAME"

SRC="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
cp "$SRC" "$ROOT/e-kassam.apk"
echo "==> 4/4 Tayyor: $ROOT/e-kassam.apk ($VNAME)"

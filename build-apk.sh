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

# ⚠ DOIMIY IMZO: kalit repodan TASHQARIDA (desktop imzo kaliti bilan bir
# qoida). Usiz qurilgan APK boshqa imzo oladi va o'rnatilganining ustiga
# tushmaydi — shuning uchun kalit topilmasa to'xtaymiz.
KEYDIR="/c/Users/shaxo/ekassam-android-kalit"
[ -f "$KEYDIR/ekassam.keystore" ] || { echo "XATO: $KEYDIR/ekassam.keystore topilmadi"; exit 1; }
SIGN_PASS="$(cat "$KEYDIR/parol.txt")"

echo "==> 3/4 Gradle assembleRelease (versionCode=$VCODE, versionName=$VNAME)"
cd "$ROOT/android"
./gradlew --console=plain assembleRelease \
  -PappVersionCode="$VCODE" -PappVersionName="$VNAME" \
  -PsignKeystore="$KEYDIR/ekassam.keystore" -PsignPassword="$SIGN_PASS"

SRC="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
cp "$SRC" "$ROOT/e-kassam.apk"
echo "==> 4/4 Tayyor: $ROOT/e-kassam.apk ($VNAME, imzolangan)"

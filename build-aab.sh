#!/usr/bin/env bash
# Google Play uchun IMZOLANGAN Android App Bundle (.aab) yasaydi.
#
# Nega alohida skript (build-apk.sh bor-ku):
#
#   1. Play yangi ilovalarni FAQAT App Bundle sifatida qabul qiladi. APK
#      yuklab bo'lmaydi — u yondan o'rnatish uchun qoladi (build-apk.sh).
#   2. Play build'ida ilova o'z APK sini TARQATMASLIGI shart (Play
#      qoidasi; jazosi — do'kondan olib tashlash). Shu skript
#      `VITE_PLAY_BUILD=1` beradi va `canDistributeApk()` shu bayroqqa
#      qarab Sozlamalardagi yuklab olish tugmasini yopadi. build-apk.sh
#      bu bayroqni BERMAYDI — yondan o'rnatilgan ilovada yangilanishning
#      yagona yo'li o'sha havola.
#
# Ishlatish:  ./build-aab.sh  [--clean]
# Natija:     ./e-kassam-<versiya>.aab
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# ⚠ DOIMIY IMZO: kalit repodan TASHQARIDA (build-apk.sh bilan bir xil
# qoida va bir xil kalit). Kalit yoki parol yo'qolsa — Play'dagi ilovaga
# BOSHQA HECH QACHON yangilanish chiqarib bo'lmaydi.
KEYDIR="/c/Users/shaxo/ekassam-android-kalit"
if [ ! -f "$KEYDIR/ekassam.keystore" ]; then
  cat >&2 <<MSG
XATO: $KEYDIR/ekassam.keystore topilmadi.

Imzo kalitisiz Gradle imzolanmagan bundle yasab beradi va buni faqat
yuklash paytida, tushunarsiz xato bilan bilib qolasiz. Kalit va parol
(parol.txt) o'sha papkada turishi shart.
MSG
  exit 1
fi
SIGN_PASS="$(cat "$KEYDIR/parol.txt")"

VCODE=$(( $(date +%s) / 60 ))
VNAME="$(date +%Y.%m.%d-%H%M)"

echo "==> 1/3 Web build (vite, PLAY rejimi)"
# ⚠ VITE_PLAY_BUILD — aynan shu build'ni Play build'i qiladi.
VITE_PLAY_BUILD=1 npm run build

echo "==> 2/3 Capacitor sync (android)"
npx --no-install cap sync android

# `clean` ataylab IXTIYORIY: usiz Gradle o'zgarganini qayta quradi va
# to'g'ri imzolangan bundle beradi. Yarim soatlik reliz — odamlar chetlab
# o'ta boshlaydigan reliz. Bog'liqlik o'zgarganda `--clean` bering.
CLEAN=""
[ "${1:-}" = "--clean" ] && CLEAN="clean"

echo "==> 3/3 Gradle bundleRelease (versionCode=$VCODE, versionName=$VNAME)${CLEAN:+ [clean]}"
cd "$ROOT/android"
./gradlew --console=plain $CLEAN bundleRelease \
  -PappVersionCode="$VCODE" -PappVersionName="$VNAME" \
  -PsignKeystore="$KEYDIR/ekassam.keystore" -PsignPassword="$SIGN_PASS"

SRC="$ROOT/android/app/build/outputs/bundle/release/app-release.aab"
[ -f "$SRC" ] || { echo "XATO: $SRC yasalmadi" >&2; exit 1; }

DEST="$ROOT/e-kassam-$VNAME.aab"
cp "$SRC" "$DEST"

# ⚠⚠ dist/ NI ODATDAGI HOLATIGA QAYTARAMIZ — bu shart, qulaylik emas.
#
# Bu repoda `dist/` git'da TURADI va Netlify aynan o'shani chiqaradi
# (netlify.toml da qurish buyrug'i yo'q). Yuqoridagi qadam esa uni PLAY
# bayrog'i bilan qayta yozdi. Agar shu holatda commit qilinsa,
# app.e-kassam.uz ga Play build tushadi va SAYTDAGI APK yuklab olish
# havolasi ham yo'qolardi — yondan o'rnatgan foydalanuvchilar
# yangilanishsiz qolardi. Xatoni sezish qiyin: hech narsa yiqilmaydi,
# shunchaki tugma yo'qoladi.
echo "==> dist/ ni odatdagi (Play emas) holatiga qaytarish"
cd "$ROOT"
npm run build >/dev/null

cat <<MSG

Tayyor: $DEST  ($(du -h "$DEST" | cut -f1))
versionName=$VNAME  versionCode=$VCODE

Keyingi qadam: Play Console -> Production -> Create new release -> shu .aab.

⚠ BIRINCHI YUKLASHDA MUHIM: Play App Signing sozlanayotganda
   «Use an existing app signing key» ni tanlab AYNAN SHU kalitni
   (ekassam.keystore) yuklang. Aks holda Play o'z kalitini yaratadi va
   do'kondagi ilova yondan o'rnatilgan APK dan BOSHQA imzo oladi —
   hozirgi foydalanuvchilar yangilanishni ololmay, ilovani o'chirib
   qayta o'rnatishga majbur bo'ladi.
MSG

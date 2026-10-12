"""
══════════════════════════════════════════════════════════════════════════
FONTAWESOME — YENGIL BO'LAK + TO'LIQ ZAXIRA (B2, 2026-10-12)

═══ NEGA ═════════════════════════════════════════════════════════════

Trace (/sale, 4G, 4x sekin): qattiq ikonka shrifti 158 KB + oddiy 25 KB
birinchi chizishdan KEYIN keladi, matn shriftlari bilan tarmoqni bo'lishadi
va yana bir layout chaqiradi. Ilova esa ~300 ta ikonka ishlatadi, to'plamda
~1400 ta.

⚠ ODDIY QISQARTIRISH RAD ETILGAN (`index.html` izohi, `size-budget.json`
2026-09-24): kategoriya ikonkasi BAZADAN keladi va koddan topib bo'lmaydi —
qisqartirilsa ular jimgina yo'qolardi.

═══ YECHIM — unicode-range ═══════════════════════════════════════════

Bitta shrift oilasiga IKKITA `@font-face`:
  1. TO'LIQ shrift (avvalgidek, oldin yozilgan);
  2. YENGIL bo'lak — faqat ishlatiladigan belgilar, `unicode-range` bilan,
     KEYIN yozilgan (CSS Fonts: oxirgi yozilgan birinchi tekshiriladi).
Brauzer belgi uchun avval yengil bo'lakka qaraydi; unda bo'lmasa —
to'liqiga. TO'LIQ SHRIFT FAQAT KERAK BO'LGANDA YUKLANADI: sahifada bo'lakda
yo'q ikonka paydo bo'lsa (masalan bazadan kelgan noma'lum kategoriya
ikonkasi). Ya'ni hech narsa yo'qolmaydi — eng yomoni, avvalgidek og'ir.

⚠ `unicode-range` HAR SHRIFT UCHUN O'Z GLIFLARI bilan kesishmasi: qattiq va
oddiy shriftlarda belgilar to'plami har xil. Shriftda yo'q belgini bo'lakka
yozsak, brauzer o'sha yuzni tanlab bo'sh joy chizishi mumkin edi.

Manba nomlar: `src/**` + `index.html` (`check-icons.mjs` bilan bir xil
o'qish: izohlarsiz, `${…}` dagi matn qiymatlari) va backend kategoriya
shablonlari — `scripts/fa-extra-icons.json`.

Ishga tushirish (Python + fonttools + brotli kerak; CI emas, qo'lda):
  python scripts/gen-fa-subset.py
Natija: public/fa/*.sub.woff2, public/fa/all.css (belgilar orasida),
scripts/fa-subset.json (`check-icons.mjs` tekshiradi: koddagi ikonka
bo'lakda yo'q bo'lsa — qayta ishga tushirish kerak).
══════════════════════════════════════════════════════════════════════════
"""
import io, json, os, re, sys
from fontTools.ttLib import TTFont
from fontTools import subset

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FA = os.path.join(ROOT, "public", "fa")
CSS = os.path.join(FA, "all.css")
BEGIN, END = "/*ek-subset:boshi*/", "/*ek-subset:oxiri*/"

css = io.open(CSS, encoding="utf-8").read()
css = re.sub(re.escape(BEGIN) + r".*?" + re.escape(END), "", css, flags=re.S)   # eski bo'lak — qayta yasaladi

code = {}
for m in re.finditer(r'((?:\.fa-[a-z0-9-]+,?)+)\{--fa:"\\([0-9a-f]+)"\}', css):
    for n in re.findall(r"\.fa-([a-z0-9-]+)", m.group(1)):
        code["fa-" + n] = int(m.group(2), 16)

def strip(s):
    s = re.sub(r"<!--.*?-->", " ", s, flags=re.S)
    s = re.sub(r"/\*.*?\*/", " ", s, flags=re.S)
    return "\n".join("" if re.match(r"^\s*//", l) else l for l in s.split("\n"))

used = set()
files = [os.path.join(ROOT, "index.html")]
for d, dirs, fs in os.walk(os.path.join(ROOT, "src")):
    dirs[:] = [x for x in dirs if x not in ("node_modules", "dist")]
    files += [os.path.join(d, f) for f in fs if re.search(r"\.(jsx?|html)$", f)]
for f in files:
    src = strip(io.open(f, encoding="utf-8").read())
    for m in re.finditer(r"(fa-[a-z0-9-]*)\$\{([^}]*)\}", src):
        for p in re.findall(r"[\"'`]([a-z0-9-]+)[\"'`]", m.group(2)):
            used.add(m.group(1) + p)
    for m in re.finditer(r"(?<!-)\bfa-[a-z0-9-]*", src):
        used.add(m.group(0))
extra = json.load(io.open(os.path.join(ROOT, "scripts", "fa-extra-icons.json"), encoding="utf-8"))["names"]
used |= set(extra)
codes = sorted({code[n] for n in used if n in code})
print(f"ishlatilgan nom: {len(used)} · kod nuqtasi: {len(codes)} (backenddan {len(extra)})")

meta, faces = {}, []
for name, weight in (("fa-solid-900", 900), ("fa-regular-400", 400)):
    full = os.path.join(FA, name + ".woff2")
    cmap = set(TTFont(full).getBestCmap().keys())
    mine = [c for c in codes if c in cmap]
    out = os.path.join(FA, name + ".sub.woff2")
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    font = TTFont(full)
    sub = subset.Subsetter(options=opts)
    sub.populate(unicodes=mine)
    sub.subset(font)
    font.flavor = "woff2"
    font.save(out)
    print(f"{name}: {os.path.getsize(full)//1024} KB → {os.path.getsize(out)//1024} KB ({len(mine)} belgi)")
    meta[name] = {"subset": mine, "full": sorted(cmap)}
    rng = ",".join(f"U+{c:X}" for c in mine)
    faces.append('@font-face{font-family:"Font Awesome 6 Free";font-style:normal;font-weight:%d;font-display:block;'
                 'src:url(/fa/%s.sub.woff2) format("woff2");unicode-range:%s}' % (weight, name, rng))

# ⚠ Bo'lak TO'LIQ yuzdan KEYIN turishi shart — oxirgi yozilgan birinchi tekshiriladi.
css = css.rstrip("\n") + "\n" + BEGIN + "".join(faces) + END + "\n"
io.open(CSS, "w", encoding="utf-8", newline="").write(css)
json.dump(meta, io.open(os.path.join(ROOT, "scripts", "fa-subset.json"), "w", encoding="utf-8"), separators=(",", ":"))
print("tayyor: public/fa/all.css, scripts/fa-subset.json")

// Windows'da relizda konsol oynasi ochilmasin — kassir ekranida qora
// oyna ilova bilan birga ochilib turishi kerak emas. Debug'da esa konsol
// KERAK: `println!` va panic xabarlari shu yerda ko'rinadi.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod printer;
mod scale;

use tauri::Manager;

/// Oynani to'liq ekranga o'tkazadi yoki qaytaradi (F11 ning vazifasi).
///
/// ⚠ BU ISH FAQAT RUST TOMONIDAN BAJARILADI. Veb tomonidagi
/// `requestFullscreen()` WebView2 da sahifani OYNA ICHIDA yoyadi: oyna
/// ramkasi, sarlavhasi va Windows'ning vazifalar paneli joyida qolaveradi
/// va kassir ekranining tepasi baribir band bo'lardi.
///
/// ⚠ `async` EMAS. Oyna bilan ishlash asosiy oqimning ishi; `async` bilan
/// buyruq boshqa oqimga tushadi va Windows'da oyna amallari o'sha yerdan
/// ishonchsiz bo'ladi.
#[tauri::command]
fn set_fullscreen(window: tauri::Window, on: bool) -> Result<(), String> {
    window.set_fullscreen(on).map_err(|e| e.to_string())
}

/// Sahifa masshtabi (Ctrl + / Ctrl − / Ctrl + g'ildirak) — 2026-10-05.
///
/// ⚠ NEGA O'Z BUYRUG'IMIZ, `zoomHotkeysEnabled` EMAS. WebView2 ning o'z
/// masshtabi qadamni o'zi tanlaydi, ekranda hech narsa ko'rsatmaydi va
/// ilova yopilganda unutiladi — kassir har tongda qayta kattalashtirardi.
/// Bu yerda veb tomon qadamni boshqaradi va qiymatni qurilma sozlamasi
/// sifatida saqlaydi (`ek-zoom.js`).
#[tauri::command]
fn set_zoom(window: tauri::WebviewWindow, scale: f64) -> Result<(), String> {
    if !(0.5..=3.0).contains(&scale) {
        return Err("masshtab chegaradan tashqarida".into());
    }
    window.set_zoom(scale).map_err(|e| e.to_string())
}

/// QURILMA SOZLAMALARI FAYLI (2026-10-05) — printer va tarozi sozlamasi.
///
/// ⚠ NEGA FAYL HAM. Sozlamalar veb tomonida `localStorage` da turadi va u
/// WebView ma'lumoti bilan birga o'chishi mumkin (sessiya tozalanishi,
/// profil buzilishi). Egasi: «ma'lumotni esdan chiqarmaydigan qil». Shuning
/// uchun nusxasi ilovaning o'z papkasida (`%APPDATA%/uz.ekassam.pos/device.json`)
/// saqlanadi va ishga tushganda yo'qolgani shundan tiklanadi.
/// Faylda faqat qurilma sozlamalari — token yoki shaxsiy ma'lumot YO'Q.
fn device_file(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("device.json"))
}

#[tauri::command]
fn device_store_get(app: tauri::AppHandle) -> Result<String, String> {
    let p = device_file(&app)?;
    Ok(std::fs::read_to_string(p).unwrap_or_default())
}

#[tauri::command]
fn device_store_set(app: tauri::AppHandle, json: String) -> Result<(), String> {
    // 64 KB dan katta bo'lsa — bu qurilma sozlamasi emas, xato; yozilmaydi.
    if json.len() > 65_536 {
        return Err("juda katta".into());
    }
    let p = device_file(&app)?;
    // Avval vaqtinchalik faylga, keyin almashtirish: yozish o'rtasida chiroq
    // o'chsa, yarim fayl qolib, hamma sozlama yo'qolmasin.
    let tmp = p.with_extension("json.tmp");
    std::fs::write(&tmp, json).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &p).map_err(|e| e.to_string())
}

fn main() {
    // ⚠ Plaginlar ATAYLAB kam. Kassa ilovasiga fayl tizimi, shell yoki
    // tashqi havola ochish kerak emas — har bir qo'shilgan plagin hujum
    // yuzasini kengaytiradi, foydasi esa nol.
    //
    // Ikkita istisno bor, ikkalasi ham auto-update uchun:
    //   updater — yangi versiyani tekshiradi, yuklaydi, o'rnatadi
    //   process — o'rnatishdan keyin ilovani qayta ishga tushiradi;
    //             usiz kassir eski oynada qolib ketardi
    //
    // Yangilanish paketi minisign kaliti bilan IMZOLANADI, ochiq kalit esa
    // `tauri.conf.json` ichida. Ya'ni reliz manzili qo'lga olinsa ham,
    // imzosi mos kelmagan fayl o'rnatilmaydi.
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            printer::list_printers,
            printer::print_raw,
            printer::print_tcp,
            set_fullscreen,
            set_zoom,
            scale::serial_ports,
            scale::serial_open,
            scale::serial_read,
            scale::serial_write,
            scale::serial_close,
            scale::serial_current,
            device_store_get,
            device_store_set,
        ])
        .run(tauri::generate_context!())
        .expect("e-Kassam ishga tushmadi");
}

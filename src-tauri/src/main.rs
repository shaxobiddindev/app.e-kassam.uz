// Windows'da relizda konsol oynasi ochilmasin — kassir ekranida qora
// oyna ilova bilan birga ochilib turishi kerak emas. Debug'da esa konsol
// KERAK: `println!` va panic xabarlari shu yerda ko'rinadi.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod printer;

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
        ])
        .run(tauri::generate_context!())
        .expect("e-Kassam ishga tushmadi");
}

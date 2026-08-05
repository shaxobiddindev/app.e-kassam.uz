// Windows'da relizda konsol oynasi ochilmasin — kassir ekranida qora
// oyna ilova bilan birga ochilib turishi kerak emas. Debug'da esa konsol
// KERAK: `println!` va panic xabarlari shu yerda ko'rinadi.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod printer;

fn main() {
    // ⚠ Qo'shimcha plaginlar ATAYLAB yo'q. Kassa ilovasiga fayl tizimi,
    // shell yoki tashqi havola ochish kerak emas — har bir qo'shilgan plagin
    // hujum yuzasini kengaytiradi, foydasi esa nol.
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            printer::list_printers,
            printer::print_raw,
            printer::print_tcp,
        ])
        .run(tauri::generate_context!())
        .expect("e-Kassam ishga tushmadi");
}

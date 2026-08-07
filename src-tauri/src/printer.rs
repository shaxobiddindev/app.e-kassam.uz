/*!
Kassa apparatlari bilan ishlash — chek printeri va pul yashigi.

Bu yerda HECH QANDAY chek mantiqi yo'q. Frontend tayyor ESC/POS baytlarini
yuboradi, bu modul esa ularni faqat YETKAZADI. Sabab: chek ko'rinishi tez-tez
o'zgaradi (tarjima, do'kon nomi, tartib), yetkazish esa deyarli hech qachon.
Ikkalasini aralashtirish har chek o'zgarishida `.exe` ni qayta qurishni
talab qilardi.

Ikkita yo'l qo'llab-quvvatlanadi:

  `print_raw` — Windows drayveri orqali. Drayver USB/COM/LPT farqini o'zi
                yashiradi, shuning uchun bu eng ishonchli yo'l.
                ⚠ RAW rejimi MAJBURIY: drayver baytlarni o'zgartirmasdan,
                "hujjat" deb talqin qilmasdan printerga uzatadi.

  `print_tcp` — tarmoq printeri, 9100-port (de-fakto standart).

⚠ UCHALA buyruq ham `#[tauri::command(async)]`. `async` SO'ZINI OLIB
TASHLAMANG: Tauri sinxron buyruqni ASOSIY OQIMDA bajaradi, ya'ni spooler
(`StartDocPrinter`/`WritePrinter`) yoki TCP ulanish kutayotgan paytda butun
oyna qotib qoladi. Kassir buni "chek chiqishida to'xtalish" deb sezadi.
`(async)` buyruqni ishchi oqimga chiqaradi — oyna kutmaydi.
*/

use std::io::Write;
use std::net::{SocketAddr, TcpStream, ToSocketAddrs};
use std::time::Duration;

use windows::core::{PCWSTR, PWSTR};
use windows::Win32::Foundation::HANDLE;
use windows::Win32::Graphics::Printing::{
    ClosePrinter, EndDocPrinter, EndPagePrinter, EnumPrintersW, GetDefaultPrinterW, OpenPrinterW,
    StartDocPrinterW, StartPagePrinter, WritePrinter, DOC_INFO_1W, PRINTER_ENUM_CONNECTIONS,
    PRINTER_ENUM_LOCAL, PRINTER_INFO_2W,
};

/// Rust satrini Windows API kutadigan nol bilan tugaydigan UTF-16 ga o'giradi.
fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

/// O'rnatilgan printerlar ro'yxati.
///
/// Foydalanuvchi nomni QO'LDA yozmasligi uchun kerak: "Xprinter XP-80" dagi
/// bitta xato harf chekni jimgina yo'q qilardi.
// Tarmoq printeri o'chiq bo'lsa `EnumPrintersW` bir necha soniya kutadi —
// shu sababli bu ham asosiy oqimda emas.
#[tauri::command(async)]
pub fn list_printers() -> Result<Vec<String>, String> {
    unsafe {
        let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;
        let mut needed = 0u32;
        let mut returned = 0u32;

        // Birinchi chaqiruv faqat kerakli BUFER HAJMINI aniqlaydi va
        // ataylab xato qaytaradi — bu Win32 dagi odatiy naqsh.
        let _ = EnumPrintersW(flags, PCWSTR::null(), 2, None, &mut needed, &mut returned);
        if needed == 0 {
            return Ok(vec![]);
        }

        let mut buf = vec![0u8; needed as usize];
        EnumPrintersW(
            flags,
            PCWSTR::null(),
            2,
            Some(&mut buf),
            &mut needed,
            &mut returned,
        )
        .map_err(|e| format!("EnumPrinters: {e}"))?;

        let info = buf.as_ptr() as *const PRINTER_INFO_2W;
        let mut out = Vec::with_capacity(returned as usize);
        for i in 0..returned as usize {
            let p = &*info.add(i);
            if !p.pPrinterName.is_null() {
                out.push(p.pPrinterName.to_string().unwrap_or_default());
            }
        }
        Ok(out)
    }
}

/// Baytlarni Windows printeriga RAW ko'rinishida yuboradi.
///
/// `printer` — `None` bo'lsa tizimdagi standart printer ishlatiladi.
#[tauri::command(async)]
pub fn print_raw(printer: Option<String>, data: Vec<u8>) -> Result<(), String> {
    if data.is_empty() {
        return Err("Bo'sh ma'lumot".into());
    }

    let name = match printer.filter(|p| !p.trim().is_empty()) {
        Some(p) => p,
        None => default_printer()?,
    };

    unsafe {
        let mut handle = HANDLE::default();
        let wname = wide(&name);
        OpenPrinterW(PCWSTR(wname.as_ptr()), &mut handle, None)
            .map_err(|e| format!("Printer ochilmadi ({name}): {e}"))?;

        // Handle ochilgandan keyin har qanday xatoda uni YOPISH shart.
        // Aks holda navbat band qolib, keyingi chek umuman chiqmasdi.
        let result = (|| -> Result<(), String> {
            let mut wdoc = wide("e-Kassam chek");
            let mut wtype = wide("RAW");
            // `pDatatype: "RAW"` — ENG MUHIM maydon. Usiz drayver baytlarni
            // "hujjat" deb talqin qilib, ESC/POS buyruqlarini matn sifatida
            // bosib chiqarardi.
            let doc = DOC_INFO_1W {
                pDocName: PWSTR::from_raw(wdoc.as_mut_ptr()),
                pOutputFile: PWSTR::null(),
                pDatatype: PWSTR::from_raw(wtype.as_mut_ptr()),
            };

            let job = StartDocPrinterW(handle, 1, &doc);
            if job == 0 {
                return Err("StartDocPrinter muvaffaqiyatsiz".into());
            }
            StartPagePrinter(handle).ok().map_err(|e| format!("StartPagePrinter: {e}"))?;

            let mut written = 0u32;
            WritePrinter(handle, data.as_ptr() as *const _, data.len() as u32, &mut written)
                .ok()
                .map_err(|e| format!("WritePrinter: {e}"))?;

            if written as usize != data.len() {
                return Err(format!("Yuborildi {written}/{} bayt", data.len()));
            }

            let _ = EndPagePrinter(handle);
            let _ = EndDocPrinter(handle);
            Ok(())
        })();

        let _ = ClosePrinter(handle);
        result
    }
}

/// Tizimdagi standart printer nomi.
///
/// ⚠ `GetDefaultPrinterW` `Result` EMAS, `BOOL` qaytaradi va birinchi
/// parametri `Option` emas, oddiy `PWSTR`. Ikkalasi ham qo'shni funksiyalardan
/// farq qiladi (`OpenPrinterW` va `EnumPrintersW` `Result` beradi) — shu
/// sababli bu yerda `.ok()` orqali `Result` ga o'giriladi.
fn default_printer() -> Result<String, String> {
    unsafe {
        // Birinchi chaqiruv faqat kerakli uzunlikni aniqlaydi va ataylab
        // muvaffaqiyatsiz tugaydi — Win32 dagi odatiy naqsh.
        let mut len = 0u32;
        let _ = GetDefaultPrinterW(PWSTR::null(), &mut len);
        if len == 0 {
            return Err("Standart printer topilmadi".into());
        }

        let mut buf = vec![0u16; len as usize];
        GetDefaultPrinterW(PWSTR::from_raw(buf.as_mut_ptr()), &mut len)
            .ok()
            .map_err(|e| format!("GetDefaultPrinter: {e}"))?;

        // `len` yakuniy nolni ham sanaydi — uni kesib tashlaymiz.
        Ok(String::from_utf16_lossy(
            &buf[..(len as usize).saturating_sub(1)],
        ))
    }
}

/// Baytlarni tarmoq printeriga yuboradi (odatda 9100-port).
///
/// Taymaut QISQA (3 s): kassir chek chiqishini kutib turadi va uzoq
/// kutdirilgandan ko'ra tez xato ko'rgani afzal.
#[tauri::command(async)]
pub fn print_tcp(host: String, port: u16, data: Vec<u8>) -> Result<(), String> {
    if data.is_empty() {
        return Err("Bo'sh ma'lumot".into());
    }

    let addr: SocketAddr = format!("{host}:{port}")
        .to_socket_addrs()
        .map_err(|e| format!("Manzil noto'g'ri ({host}:{port}): {e}"))?
        .next()
        .ok_or_else(|| format!("Manzil topilmadi: {host}:{port}"))?;

    let mut stream = TcpStream::connect_timeout(&addr, Duration::from_secs(3))
        .map_err(|e| format!("Printerga ulanib bo'lmadi ({host}:{port}): {e}"))?;
    stream
        .set_write_timeout(Some(Duration::from_secs(3)))
        .map_err(|e| format!("Taymaut: {e}"))?;
    stream
        .write_all(&data)
        .map_err(|e| format!("Yuborilmadi: {e}"))?;
    stream.flush().map_err(|e| format!("Flush: {e}"))?;
    Ok(())
}

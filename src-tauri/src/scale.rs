//! TAROZI PORTI — DESKTOP ILOVANING O'ZI OCHADI (2026-10-05)
//!
//! Egasi: «asosan desktop ilovada ishlatamiz — uni avto sozlaydigan va
//! ma'lumotni esdan chiqarmaydigan qil, xuddi stikernikidek».
//!
//! ⚠ NEGA WEB SERIAL EMAS. Brauzerdagi `navigator.serial` port tanlash
//! oynasini va ruxsatni BRAUZER profilida saqlaydi. WebView2 ichida u
//! ishonchsiz: tanlash oynasi chiqmasligi yoki ruxsat yangilanishdan keyin
//! yo'qolishi mumkin — do'kon «yana uzilib qolibdi» dedi. Bu yerda port
//! oddiy Windows COM porti sifatida ochiladi: ruxsat ham, oyna ham kerak emas,
//! demak ilova uni O'ZI topib ulay oladi.
//!
//! Tuzilish ataylab sodda: bitta ochiq port, alohida oqim baytlarni buferga
//! yig'adi, veb tomoni `serial_read` bilan har ~120 ms da olib turadi.
//! Hodisa (event) emas — so'rov: veb tomonida tarozi mantig'i (so'rov
//! yuborish, ACK, oqimni o'qish) allaqachon bor va o'zgarmaydi.

use serde::Serialize;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

#[derive(Serialize)]
pub struct PortInfo {
    name: String,
    /// "usb" | "pci" | "bluetooth" | "unknown"
    kind: String,
    vid: Option<u16>,
    pid: Option<u16>,
    manufacturer: Option<String>,
    product: Option<String>,
}

struct Conn {
    name: String,
    port: Box<dyn serialport::SerialPort>,
    buf: Arc<Mutex<Vec<u8>>>,
    dead: Arc<AtomicBool>,
    stop: Arc<AtomicBool>,
}

static CONN: Mutex<Option<Conn>> = Mutex::new(None);

/// Kompyuterdagi COM portlar (USB adapterlarning sotuvchi/mahsulot raqami bilan).
#[tauri::command]
pub fn serial_ports() -> Vec<PortInfo> {
    let list = serialport::available_ports().unwrap_or_default();
    list.into_iter()
        .map(|p| match p.port_type {
            serialport::SerialPortType::UsbPort(u) => PortInfo {
                name: p.port_name,
                kind: "usb".into(),
                vid: Some(u.vid),
                pid: Some(u.pid),
                manufacturer: u.manufacturer,
                product: u.product,
            },
            serialport::SerialPortType::PciPort => PortInfo {
                name: p.port_name, kind: "pci".into(), vid: None, pid: None,
                manufacturer: None, product: None,
            },
            serialport::SerialPortType::BluetoothPort => PortInfo {
                name: p.port_name, kind: "bluetooth".into(), vid: None, pid: None,
                manufacturer: None, product: None,
            },
            serialport::SerialPortType::Unknown => PortInfo {
                name: p.port_name, kind: "unknown".into(), vid: None, pid: None,
                manufacturer: None, product: None,
            },
        })
        .collect()
}

fn close_inner(slot: &mut Option<Conn>) {
    if let Some(c) = slot.take() {
        c.stop.store(true, Ordering::SeqCst);
        // Port `c` bilan birga yopiladi (drop); o'qish oqimi `stop` ni ko'rib chiqadi.
    }
}

/// Portni ochadi (ochiq bo'lsa — avval yopadi).
///
/// ⚠ DTR/RTS KO'TARILADI: ko'p USB-tarozi bu signallarsiz umuman gapirmaydi
/// (veb yo'lidagi `setSignals` ning jufti). Bilmaydigan adapterda xato yutiladi.
#[tauri::command]
pub fn serial_open(name: String, baud: u32) -> Result<(), String> {
    let mut slot = CONN.lock().map_err(|_| "qulf".to_string())?;
    close_inner(&mut slot);
    let mut port = serialport::new(&name, baud)
        .data_bits(serialport::DataBits::Eight)
        .stop_bits(serialport::StopBits::One)
        .parity(serialport::Parity::None)
        .flow_control(serialport::FlowControl::None)
        .timeout(Duration::from_millis(60))
        .open()
        .map_err(|e| format!("{name}: {e}"))?;
    let _ = port.write_data_terminal_ready(true);
    let _ = port.write_request_to_send(true);
    let mut reader = port.try_clone().map_err(|e| e.to_string())?;
    let buf = Arc::new(Mutex::new(Vec::<u8>::new()));
    let dead = Arc::new(AtomicBool::new(false));
    let stop = Arc::new(AtomicBool::new(false));
    let (b, d, s) = (buf.clone(), dead.clone(), stop.clone());
    std::thread::spawn(move || {
        let mut tmp = [0u8; 256];
        while !s.load(Ordering::SeqCst) {
            match reader.read(&mut tmp) {
                Ok(n) if n > 0 => {
                    if let Ok(mut v) = b.lock() {
                        v.extend_from_slice(&tmp[..n]);
                        // Hech kim o'qimasa ham xotira cheksiz o'smasin.
                        let len = v.len();
                        if len > 8192 { v.drain(..len - 8192); }
                    }
                }
                Ok(_) => {}
                Err(e) if e.kind() == std::io::ErrorKind::TimedOut => {}
                Err(_) => {
                    // Kabel sug'urildi yoki port yo'qoldi — veb tomoni `serial_read` dan biladi.
                    d.store(true, Ordering::SeqCst);
                    break;
                }
            }
        }
    });
    *slot = Some(Conn { name, port, buf, dead, stop });
    Ok(())
}

/// Yig'ilgan baytlarni beradi va buferni bo'shatadi. Port o'lgan bo'lsa — xato.
#[tauri::command]
pub fn serial_read() -> Result<Vec<u8>, String> {
    let slot = CONN.lock().map_err(|_| "qulf".to_string())?;
    let c = slot.as_ref().ok_or_else(|| "closed".to_string())?;
    if c.dead.load(Ordering::SeqCst) {
        return Err("closed".into());
    }
    let mut v = c.buf.lock().map_err(|_| "qulf".to_string())?;
    Ok(std::mem::take(&mut *v))
}

/// Taroziga so'rov yuboradi (ENQ, «W» va h.k.).
#[tauri::command]
pub fn serial_write(data: Vec<u8>) -> Result<(), String> {
    let mut slot = CONN.lock().map_err(|_| "qulf".to_string())?;
    let c = slot.as_mut().ok_or_else(|| "closed".to_string())?;
    c.port.write_all(&data).map_err(|e| e.to_string())?;
    let _ = c.port.flush();
    Ok(())
}

/// Portni yopadi. Ochiq port bo'lmasa ham xato emas.
#[tauri::command]
pub fn serial_close() {
    if let Ok(mut slot) = CONN.lock() {
        close_inner(&mut slot);
    }
}

/// Hozir qaysi port ochiq (tashxis uchun).
#[tauri::command]
pub fn serial_current() -> Option<String> {
    CONN.lock().ok().and_then(|s| s.as_ref().map(|c| c.name.clone()))
}

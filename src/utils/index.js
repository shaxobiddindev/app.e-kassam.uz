// Barcha sozlamalar config.js dan
export * from "../config";

// ── DEVICE_ID — getDeviceId() ni bir marta chaqirib saqlash ───
export const DEVICE_ID = (() => {
  let id = localStorage.getItem("ek_deviceId");
  if (!id) {
    id = "web-" + Math.random().toString(36).slice(2, 12);
    localStorage.setItem("ek_deviceId", id);
  }
  return id;
})();

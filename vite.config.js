import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/* ══════════════════════════════════════════════════════════════════════════
   ⚠ QR KUTUBXONASI ALOHIDA BO'LAKDA (V60)

   `qrcode-generator` (51 KB) faqat mijoz kabineti, QR plakat, elektron
   chek va brauzerdagi chek uchun kerak — ya'ni kassir uni odatda hech
   qachon ochmaydi. Lekin bu joylarning HAMMASI kechiktirilgan sahifa
   bo'lgani uchun Rollup umumiy bog'liqlikni «ota» bo'lakka, ya'ni
   KIRISH bo'lagiga ko'tarib qo'yardi: har ochilishda kassir uni bekorga
   yuklab olardi.

   Alohida bo'lakda u faqat haqiqatan kerak bo'lganda yuklanadi.

   ⚠ REACT VA MARSHRUTIZATOR bu yerda YO'Q va ataylab: ular birinchi
   chizishning O'ZI uchun kerak. Ularni bo'lakka ajratish faylni
   ko'paytiradi-yu, kutish vaqtini kamaytirmaydi — aksincha, ikkinchi
   so'rov qo'shadi.
   ══════════════════════════════════════════════════════════════════════════ */
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/qrcode-generator")) return "qr";
          return undefined;
        },
      },
    },
  },
});

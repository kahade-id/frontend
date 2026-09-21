/**
 * Kahade — Expo config plugin: Android FLAG_SECURE (D-02 audit).
 *
 * Standar aplikasi finansial Indonesia (mobile banking/e-wallet) melarang
 * screenshot/screen-recording pada layar yang menampilkan PIN/OTP, KTP+NIK,
 * kode cadangan 2FA, dan saldo. Android menyediakannya lewat satu flag
 * window: `WindowManager.LayoutParams.FLAG_SECURE`.
 *
 * Keputusan non-obvious:
 *   - Flag dipasang di MainActivity → berlaku SATU jendela app (semua layar).
 *     Granularitas per-layar (hanya sheet PIN/KYC) butuh native module dengan
 *     toggle runtime — di luar cakupan config plugin. Aplikasi bank di
 *     Indonesia pada umumnya memblokir seluruh app; trade-off ini diterima
 *     dan didokumentasikan di docs/SECURITY-CHECKLIST.md.
 *   - Idempoten: bila `FLAG_SECURE` sudah ada di sumber MainActivity (mis.
 *     template masa depan), plugin tidak mengubah apa pun.
 *   - iOS TIDAK bisa diblokir setara; Apple hanya mengizinkan DETEKSI
 *     screen-capture (UIScreen.capturedDidChangeNotification) — butuh modul
 *     native/Swift terpisah, tercatat sebagai gap di checklist yang sama.
 *   - Web tidak terpengaruh (tidak ada API browser untuk ini).
 *
 * Pakai: daftarkan `"./plugins/with-flag-secure"` di `app.json` → `plugins`.
 * Opsi: `{ "enabled": false }` untuk mematikan (mis. build internal yang
 * butuh screenshot untuk dokumentasi).
 */
// File ini CJS murni: Expo memuat config plugin lewat require() saat
// prebuild, di luar pipeline TS/bundler repo — jadi require di sini bukan
// pilihan gaya, melainkan satu-satunya bentuk yang dibaca loader Expo.
/* eslint-disable @typescript-eslint/no-require-imports */
const { withMainActivity } = require("@expo/config-plugins");

const KOTLIN_FLAG = [
  "// Kahade (D-02): blokir screenshot/screen-recording (aplikasi finansial).",
  "window.setFlags(",
  "android.view.WindowManager.LayoutParams.FLAG_SECURE,",
  "android.view.WindowManager.LayoutParams.FLAG_SECURE",
  ")",
].join("\n    ");

const JAVA_FLAG = [
  "// Kahade (D-02): blokir screenshot/screen-recording (aplikasi finansial).",
  "getWindow().setFlags(",
  "android.view.WindowManager.LayoutParams.FLAG_SECURE,",
  "android.view.WindowManager.LayoutParams.FLAG_SECURE);",
].join("\n    ");

/**
 * Template Expo berubah antar SDK: RN 0.7x memakai
 * `super.onCreate(savedInstanceState)`, template Expo SDK 5x memakai
 * `super.onCreate(null)` (state sengaja tidak diteruskan). Dukung keduanya.
 */
const ANCHOR_RE = /super\.onCreate\((?:null|savedInstanceState)\);?/;

function withFlagSecure(config, props) {
  const { enabled = true } = props ?? {};
  if (!enabled) return config;
  return withMainActivity(config, (cfg) => {
    const contents = cfg.modResults.contents;
    if (contents.includes("FLAG_SECURE")) return cfg;
    const match = ANCHOR_RE.exec(contents);
    if (!match) {
      throw new Error(
        "withFlagSecure: anchor `super.onCreate(...)` tidak ditemukan di MainActivity — perbarui plugin ini untuk template Expo yang baru.",
      );
    }
    // Deteksi Kotlin dari bahasa mod ATAU isi file (SDK 54 menghasilkan
    // MainActivity.kt tetapi `modResults.language` bisa tetap "java").
    const isKotlin =
      cfg.modResults.language === "kotlin" || /override fun onCreate/.test(contents);
    const flag = isKotlin ? KOTLIN_FLAG : JAVA_FLAG;
    const insertAt = match.index + match[0].length;
    cfg.modResults.contents =
      contents.slice(0, insertAt) + "\n    " + flag + contents.slice(insertAt);
    return cfg;
  });
}

module.exports = withFlagSecure;

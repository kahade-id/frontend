/**
 * Kahade — <BackupCodesDisplay> (§3.1 Mono untuk kode teknis, §9.6 Card,
 * §9.13 Alert, §12 Voice & Tone).
 *
 * Menampilkan kode cadangan 2FA (biasanya 8–10 kode) setelah pengguna
 * mengaktifkan autentikator, plus di halaman "Keamanan" untuk melihat sisa
 * kode. Kode adalah rahasia sekali pakai — komponen ini memperlakukannya
 * seperti nominal uang: jelas, tidak ambigu, mudah disalin.
 *
 * Keputusan non-obvious:
 *   - Kode dirender `monoBody` (JetBrains Mono) — bukan body tabular — karena
 *     kode mencampur huruf & angka; 0/O dan 1/l/I harus bisa dibedakan saat
 *     pengguna mengetik ulang dari kertas. Ini alasan yang sama Mono dipakai
 *     untuk nomor rekening & ID transaksi (§3.1).
 *   - Grid 2 kolom tetap (bukan 3): satu kode "ABCD-EFGH" di monoBody 14px
 *     butuh ~90px; pada 360px dengan px-5 card, 3 kolom membuat kode
 *     terpotong. 2 kolom x 5 baris juga meniru layout kertas cetak yang
 *     familiar (GitHub, Google).
 *   - Kode yang sudah dipakai (`usedCodes`) TIDAK dihilangkan: tetap tampil
 *     `line-through` text-secondary supaya pengguna tahu berapa yang tersisa
 *     dan urutan tidak bergeser dari salinan kertas mereka.
 *   - Peringatan memakai <Alert tone="warning" variant="soft"> di dalam kartu,
 *     bukan teks merah: kehilangan kode bukan error, tapi risiko (§2.3 —
 *     warning = "perlu perhatian", danger = "gagal/ditolak").
 *   - Clipboard & file TIDAK ditangani di sini: `onCopyAll(text)` dan
 *     `onDownload(text)` menerima string siap pakai (satu kode per baris).
 *     Komponen UI tetap bebas dependensi native (expo-clipboard,
 *     expo-file-system) dan layar pemanggil yang menampilkan Toast
 *     "Disalin" — konsisten dengan pola Switch/FollowButton yang stateless.
 *   - Tombol: "Salin semua" `secondary` (aksi paling sering), "Unduh"
 *     `ghost`; "Buat kode baru" dipisah di bawah sebagai `ghost` dengan ikon
 *     ArrowsClockwise karena membatalkan semua kode lama — cukup jauh dari
 *     tombol salin agar tidak salah tekan, tapi tidak destructive karena
 *     pemanggil wajib menampilkan konfirmasi (Dialog) sebelum benar-benar
 *     meregenerasi.
 *   - `masked` menyembunyikan kode di balik "••••-••••" untuk halaman
 *     Keamanan yang dibuka kembali; pengguna harus menekan "Tampilkan"
 *     (idealnya setelah re-auth oleh pemanggil). Saat masked, tombol salin/
 *     unduh dinonaktifkan supaya rahasia tidak keluar tanpa terlihat.
 *   - Aksesibilitas: tiap kode `accessible` dengan label dieja per karakter
 *     ("A B C D strip E F G H") agar screen reader tidak membaca sebagai
 *     kata; kode terpakai diberi awalan "sudah dipakai".
 */
import { ArrowsClockwise, Copy, DownloadSimple, Eye } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type BackupCodesLabels = {
  title: string
  remaining: (n: number, total: number) => string
  warningTitle: string
  warningBody: string
  copyAll: string
  download: string
  regenerate: string
  reveal: string
  used: string
}

export type BackupCodesDisplayProps = Omit<ViewProps, "children"> & {
  /** Kode apa adanya, mis. "ABCD-EFGH" */
  codes: string[]
  /** Subset `codes` yang sudah dipakai — dirender line-through */
  usedCodes?: string[]
  /** Sembunyikan kode; tampilkan tombol "Tampilkan" */
  masked?: boolean
  onReveal?: () => void
  /** Menerima string siap pakai: satu kode per baris */
  onCopyAll?: (text: string) => void
  onDownload?: (text: string) => void
  /** Pemanggil WAJIB konfirmasi sebelum meregenerasi */
  onRegenerate?: () => void
  regenerating?: boolean
  /** Sembunyikan Alert peringatan (mis. sudah ditampilkan di atas layar) */
  showWarning?: boolean
  labels?: Partial<BackupCodesLabels>
  className?: string
}

const DEFAULT_LABELS: BackupCodesLabels = {
  title: "Kode cadangan",
  remaining: (n, total) => `${n} dari ${total} kode tersisa`,
  warningTitle: "Simpan di tempat aman",
  warningBody:
    "Setiap kode hanya bisa dipakai sekali. Kode ini satu-satunya cara masuk jika Anda kehilangan akses ke aplikasi autentikator.",
  copyAll: "Salin semua",
  download: "Unduh",
  regenerate: "Buat kode baru",
  reveal: "Tampilkan",
  used: "sudah dipakai",
}

/** "ABCD-EFGH" -> "A B C D strip E F G H" supaya screen reader mengeja */
function spellOut(code: string): string {
  return code
    .split("")
    .map((c) => (c === "-" ? "strip" : c))
    .join(" ")
}

export function BackupCodesDisplay({
  codes,
  usedCodes = [],
  masked = false,
  onReveal,
  onCopyAll,
  onDownload,
  onRegenerate,
  regenerating = false,
  showWarning = true,
  labels,
  className,
  ...rest
}: BackupCodesDisplayProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const used = new Set(usedCodes)
  const remaining = codes.filter((c) => !used.has(c))
  const plain = remaining.join("\n")

  return (
    <Card padded className={cn("gap-5", className)} {...rest}>
      <View className="gap-1">
        <Text variant="h3" tone="primary">
          {t.title}
        </Text>
        <Text variant="caption" tone="secondary">
          {t.remaining(remaining.length, codes.length)}
        </Text>
      </View>

      {/* Grid 2 kolom: lebar sel = 50% karena tidak ada gap horizontal antar
          kolom (pemisah cukup dari padding sel), jadi fraksi Tailwind aman */}
      <View className="flex-row flex-wrap rounded-md border border-border bg-surface">
        {codes.map((code, i) => {
          const isUsed = used.has(code)
          const isLastRow = i >= codes.length - (codes.length % 2 === 0 ? 2 : 1)
          const isLeft = i % 2 === 0
          return (
            <View
              key={`${code}-${i}`}
              accessible
              accessibilityLabel={
                masked ? `Kode ${i + 1}, tersembunyi` : `${isUsed ? `${t.used}, ` : ""}${spellOut(code)}`
              }
              className={cn(
                "w-1/2 items-center justify-center py-3",
                !isLastRow && "border-b border-border",
                isLeft && "border-r border-border",
              )}
            >
              <Text
                variant="monoBody"
                tone={isUsed ? "secondary" : "primary"}
                className={cn(isUsed && "line-through")}
              >
                {masked ? code.replace(/[^-]/g, "\u2022") : code}
              </Text>
            </View>
          )
        })}
      </View>

      {showWarning ? (
        <Alert tone="warning" title={t.warningTitle}>
          {t.warningBody}
        </Alert>
      ) : null}

      {masked && onReveal ? (
        <Button variant="secondary" leftIcon={Eye} onPress={onReveal} fullWidth>
          {t.reveal}
        </Button>
      ) : (
        <View className="flex-row gap-3">
          {onCopyAll ? (
            <Button
              variant="secondary"
              leftIcon={Copy}
              disabled={masked || remaining.length === 0}
              onPress={() => onCopyAll(plain)}
              containerClassName="flex-1"
              fullWidth
            >
              {t.copyAll}
            </Button>
          ) : null}
          {onDownload ? (
            <Button
              variant="ghost"
              leftIcon={DownloadSimple}
              disabled={masked || remaining.length === 0}
              onPress={() => onDownload(plain)}
              containerClassName="flex-1"
              fullWidth
            >
              {t.download}
            </Button>
          ) : null}
        </View>
      )}

      {onRegenerate ? (
        <Button
          variant="ghost"
          size="sm"
          leftIcon={ArrowsClockwise}
          loading={regenerating}
          onPress={onRegenerate}
          accessibilityHint="Semua kode lama tidak berlaku lagi"
        >
          {t.regenerate}
        </Button>
      ) : null}
    </Card>
  )
}

import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const cli = fileURLToPath(new URL("../node_modules/expo/bin/cli", import.meta.url))
const raw = execFileSync(process.execPath, [cli, "config", "--type", "public", "--json"], {
  encoding: "utf8",
  env: { ...process.env, EXPO_OFFLINE: "1" },
})
const config = JSON.parse(raw)
const problems = []
const projectId = config.extra?.eas?.projectId
if (!projectId) problems.push("EAS_PROJECT_ID belum terhubung ke proyek Kahade yang sebenarnya.")
if (!config.ios?.bundleIdentifier) problems.push("IOS_BUNDLE_IDENTIFIER belum ditentukan.")
if (!config.android?.package) problems.push("ANDROID_APPLICATION_ID belum ditentukan.")
if (!config.updates?.enabled || config.updates.url !== `https://u.expo.dev/${projectId}`)
  problems.push("EAS Update URL belum aktif atau tidak cocok dengan project ID.")
if (config.runtimeVersion?.policy !== "fingerprint")
  problems.push(
    "Gunakan runtime fingerprint untuk mencegah OTA lintas native binary yang tidak kompatibel.",
  )
if (!config.version || !/^\d+\.\d+\.\d+$/.test(config.version))
  problems.push("Versi native release harus berupa x.y.z yang disetujui.")

if (!problems.length) {
  const base = process.env.EXPO_PUBLIC_API_URL || "https://api.kahade.id"
  if (!base.startsWith("https://"))
    problems.push("Release wajib memakai API HTTPS yang eksplisit, bukan proxy lokal.")
  else {
    try {
      const response = await fetch(`${base.replace(/\/$/, "")}/v1/public/app-version`, {
        signal: AbortSignal.timeout(20_000),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const body = await response.json()
      if (body.success !== true) throw new Error("Envelope versi tidak valid")
      const compare = (left, right) => {
        const a = left.split(".").map(Number),
          b = right.split(".").map(Number)
        for (let i = 0; i < Math.max(a.length, b.length); i++)
          if ((a[i] || 0) !== (b[i] || 0)) return Math.sign((a[i] || 0) - (b[i] || 0))
        return 0
      }
      for (const platform of ["ios", "android"]) {
        const min = body.data?.[platform]?.minimumVersion
        if (typeof min !== "string" || !/^\d+\.\d+\.\d+$/.test(min))
          throw new Error(`Minimum ${platform} tidak dapat diverifikasi`)
        if (compare(config.version, min) < 0)
          problems.push(
            `Versi ${platform} ${config.version} di bawah minimum server ${min}; butuh native release, bukan OTA bypass.`,
          )
      }
    } catch (error) {
      problems.push(`Pemeriksaan minimum versi live gagal: ${error.message}`)
    }
  }
}
if (problems.length) {
  console.error("OTA DIBLOKIR:\n" + problems.map((p) => `- ${p}`).join("\n"))
  console.error("Lihat docs/audit/OTA.md. Tidak ada update yang dipublikasikan oleh skrip ini.")
  process.exitCode = 1
} else {
  console.log(
    "Konfigurasi dasar lolos. Tetap verifikasi akun EAS, binary/fingerprint terpasang, environment/channel, pengujian native dan rollback sebelum publikasi. Skrip ini TIDAK mempublikasikan OTA.",
  )
}

/**
 * Kahade — route landing (web saja).
 *
 * Dipakai bila pengunjung web BELUM login (gate di app/index.tsx).
 * Native tidak berubah: langsung diarahkan balik ke "/" yang ditangani
 * gate biasa (onboarding/login). Komponen halaman penuh (<LandingPage>)
 * dibangun batch C; di sini hanya route-nya.
 */
import { Platform } from "react-native"
import { Redirect } from "expo-router"

import { LandingPage } from "@/components/landing/landing-page"

export default function Landing() {
  if (Platform.OS !== "web") return <Redirect href="/" />
  return <LandingPage />
}

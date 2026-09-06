import type { PropsWithChildren } from "react"
import { ScrollViewStyleReset } from "expo-router/html"
import config from "../app.json"

/** Static web document; no session/token access during server rendering. */
export default function Html({ children }: PropsWithChildren) {
  return (
    <html lang="id">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>{config.expo.name}</title>
        {/*
          Audit web statis: sebelumnya <head> hanya berisi title + viewport.
          Akibatnya tab browser memakai ikon default, bookmark tanpa ikon,
          hasil share/SEO tanpa deskripsi, dan bilah status browser tidak
          mengikuti tema. Semua aset di bawah sudah ada di public/ — tautannya
          hanya belum pernah dideklarasikan.
        */}
        <meta
          name="description"
          content="Kahade — platform transaksi aman dengan escrow: kirim dan terima pembayaran, kelola dompet, dan selesaikan pesanan dalam satu aplikasi."
        />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        {/* Bilah status/tema browser mengikuti mode terang & gelap. */}
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000000" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  )
}

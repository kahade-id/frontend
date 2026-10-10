/**
 * Kahade — katalog platform tautan sosial (ikon + label).
 *
 * Dipisah dari <SocialLinksEditor> supaya layar PROFIL PUBLIK (yang hanya
 * menampilkan tautan) tidak perlu mengimpor seluruh editor (Input, ChipGroup,
 * tombol urut) hanya untuk mendapatkan ikon platform.
 *
 * Ikon platform memakai logo Phosphor monokrom (bukan warna brand) —
 * konsisten §7; pengecualian warna hanya untuk logo bank.
 */
import {
  FacebookLogo,
  Globe,
  InstagramLogo,
  LinkedinLogo,
  Storefront,
  TelegramLogo,
  TiktokLogo,
  WhatsappLogo,
  XLogo,
  YoutubeLogo,
} from "phosphor-react-native"

import type { IconComponent } from "@/components/ui/icon"
import { mapValue } from "@/lib/has-own"

export type SocialPlatform =
  | "instagram"
  | "tiktok"
  | "x"
  | "facebook"
  | "youtube"
  | "linkedin"
  | "whatsapp"
  | "telegram"
  | "shop"
  | "website"

export const SOCIAL_PLATFORM_ICONS: Record<SocialPlatform, IconComponent> = {
  instagram: InstagramLogo,
  tiktok: TiktokLogo,
  x: XLogo,
  facebook: FacebookLogo,
  youtube: YoutubeLogo,
  linkedin: LinkedinLogo,
  whatsapp: WhatsappLogo,
  telegram: TelegramLogo,
  shop: Storefront,
  website: Globe,
}

/**
 * Label platform. Nama merek tidak diterjemahkan; dua label generik
 * ("Toko online", "Situs web") diterjemahkan oleh pemanggil lewat
 * `translate()` — lihat `socialPlatformLabel`.
 */
export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
  facebook: "Facebook",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  shop: "Toko online",
  website: "Situs web",
}

export const ALL_SOCIAL_PLATFORMS = Object.keys(SOCIAL_PLATFORM_ICONS) as SocialPlatform[]

/**
 * `platform` dibaca dari tautan tersimpan dan tidak divalidasi. `MAP[key] ??
 * Globe` tidak melindungi dari kunci warisan Object.prototype:
 * `MAP["toString"]` adalah fungsi, bukan undefined, sehingga `??` diam saja
 * dan <Icon> akan merender fungsi itu sebagai komponen. `mapValue`
 * menutupnya (lihat lib/has-own).
 */
export function socialPlatformIcon(platform: string): IconComponent {
  return mapValue(SOCIAL_PLATFORM_ICONS, platform, Globe)
}

/** Label platform mentah (belum diterjemahkan); fallback = nama platform. */
export function socialPlatformLabel(platform: string): string {
  return mapValue(SOCIAL_PLATFORM_LABELS, platform, platform)
}

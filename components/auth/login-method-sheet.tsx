/**
 * Kahade — LoginMethodSheet: bottomsheet pilihan metode masuk.
 *
 * Ditampilkan dari onboarding saat pengguna mengetuk "Masuk". Berisi
 * daftar metode login: Nomor WhatsApp, Email, Username, Google, Apple.
 *
 * Setiap pilihan mengarahkan ke layar login dengan param `method` yang
 * sesuai, kecuali Google/Apple yang langsung memicu OAuth via
 * SocialLoginButtons (ditangani oleh layar login).
 */

import { Platform, View } from "react-native"
import { AppleLogo, Envelope, GoogleLogo, Phone, User } from "phosphor-react-native"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { VStack } from "@/components/ui/stack"

export type LoginMethod = "phone" | "email" | "username" | "google" | "apple"

type MethodOption = {
  method: LoginMethod
  title: string
  subtitle: string
  icon: typeof Phone
}

const METHODS: MethodOption[] = [
  {
    method: "phone",
    title: "Nomor WhatsApp",
    subtitle: "Masuk dengan kode OTP via WhatsApp",
    icon: Phone,
  },
  {
    method: "email",
    title: "Email",
    subtitle: "Masuk dengan email dan kata sandi",
    icon: Envelope,
  },
  {
    method: "username",
    title: "Username",
    subtitle: "Masuk dengan username dan kata sandi",
    icon: User,
  },
  {
    method: "google",
    title: "Google",
    subtitle: "Masuk dengan akun Google",
    icon: GoogleLogo,
  },
  // Apple hanya di iOS — mengikuti pola SocialLoginButtons.
  ...(Platform.OS === "ios"
    ? [
        {
          method: "apple" as LoginMethod,
          title: "Apple",
          subtitle: "Masuk dengan Apple ID",
          icon: AppleLogo,
        },
      ]
    : []),
]

type Props = {
  visible: boolean
  onRequestClose: () => void
  onSelect: (method: LoginMethod) => void
}

export function LoginMethodSheet({ visible, onRequestClose, onSelect }: Props) {
  return (
    <BottomSheet visible={visible} onRequestClose={onRequestClose} title="Masuk ke Kahade">
      <VStack gap={2} className="px-5 pb-6 pt-2">
        {METHODS.map((opt) => (
          <PressableScale
            key={opt.method}
            onPress={() => {
              onSelect(opt.method)
              onRequestClose()
            }}
            className="flex-row items-center gap-4 rounded-lg px-4 py-3 active:bg-fill"
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-fill">
              <Icon icon={opt.icon} size={20} />
            </View>
            <VStack gap={1} className="flex-1">
              <Text variant="body" weight={600}>
                {opt.title}
              </Text>
              <Text variant="caption" tone="secondary">
                {opt.subtitle}
              </Text>
            </VStack>
          </PressableScale>
        ))}
      </VStack>
    </BottomSheet>
  )
}

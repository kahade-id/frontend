/** Kahade login router: one visible credential method, with social options below. */
import { useCallback, useEffect, useState } from "react"
import { ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useLocalSearchParams, useRouter } from "expo-router"

import { LoginPasswordForm } from "@/components/auth/login-password-form"
import { LoginSocialSection } from "@/components/auth/login-social-section"
import { LoginWhatsappForm } from "@/components/auth/login-whatsapp-form"
import { FadeIn } from "@/components/ui/fade-in"
import { FooterBar } from "@/components/ui/footer-bar"
import { HEADER_BAR_HEIGHT, Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { KeyboardAvoiding } from "@/components/ui/keyboard-avoiding"
import { Screen } from "@/components/ui/screen"
import { SegmentedControl, type SegmentItem } from "@/components/ui/segmented-control"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { VStack } from "@/components/ui/stack"
import { useAuthSession } from "@/lib/use-auth-session"
import { ROUTES } from "@/lib/routes"
import type { SocialProvider } from "@/lib/api/social"

export type LoginMethod = "phone" | "email" | "username"

const LOGIN_METHODS: readonly SegmentItem<LoginMethod>[] = [
  { value: "phone", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "username", label: "Username" },
]

function providerFromParam(method?: string): SocialProvider | null {
  if (method === "google") return "GOOGLE"
  if (method === "apple") return "APPLE"
  return null
}

export default function LoginScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { next, method } = useLocalSearchParams<{ next?: string; method?: string }>()
  const nextPath = typeof next === "string" && next.startsWith("/") ? next : undefined
  const session = useAuthSession()

  const [selectedMethod, setSelectedMethod] = useState<LoginMethod>(() =>
    method === "phone" || method === "email" || method === "username" ? method : "email",
  )
  const [directSocialProvider, setDirectSocialProvider] = useState<SocialProvider | null>(() =>
    providerFromParam(method),
  )

  useEffect(() => {
    if (!session.restoring && session.token) router.replace(ROUTES.home)
  }, [session.restoring, session.token, router])

  const handleForgotPassword = useCallback(() => {
    router.push(ROUTES.forgotPassword())
  }, [router])

  const handleRegister = useCallback(() => {
    router.push(ROUTES.register)
  }, [router])

  const showOtherMethods = useCallback(() => {
    setDirectSocialProvider(null)
    setSelectedMethod("email")
  }, [])

  return (
    <Screen padded={false} edges={["top"]}>
      <Header title="Masuk" safeArea={false} showBack={false} />
      <KeyboardAvoiding offset={insets.top + HEADER_BAR_HEIGHT}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="grow px-5 pb-8 pt-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeIn duration="fast">
            <VStack gap={6}>
              {directSocialProvider ? (
                <>
                  <VStack gap={2}>
                    <Heading level={1} className="text-balance">
                      {directSocialProvider === "GOOGLE" ? "Masuk dengan Google" : "Masuk dengan Apple"}
                    </Heading>
                    <Text variant="body" tone="secondary" className="text-pretty">
                      Lanjutkan dengan akun yang terhubung ke Kahade.
                    </Text>
                  </VStack>
                  <LoginSocialSection
                    nextPath={nextPath}
                    autoStartProvider={directSocialProvider}
                  />
                  <View className="items-center">
                    <TextLink onPress={showOtherMethods}>Pilih metode lain</TextLink>
                  </View>
                </>
              ) : (
                <>
                  <VStack gap={2}>
                    <Heading level={1} className="text-balance">
                      Selamat datang kembali
                    </Heading>
                    <Text variant="body" tone="secondary" className="text-pretty">
                      Masuk ke akun Kahade Anda untuk melanjutkan.
                    </Text>
                  </VStack>

                  <SegmentedControl
                    accessibilityLabel="Metode masuk"
                    items={LOGIN_METHODS}
                    value={selectedMethod}
                    onChange={setSelectedMethod}
                  />

                  {selectedMethod === "phone" ? (
                    <LoginWhatsappForm nextPath={nextPath} />
                  ) : (
                    <LoginPasswordForm method={selectedMethod} nextPath={nextPath} />
                  )}

                  <LoginSocialSection nextPath={nextPath} showDivider />
                </>
              )}
            </VStack>
          </FadeIn>
        </ScrollView>

        <FooterBar>
          {!directSocialProvider && selectedMethod !== "phone" ? (
            <View className="items-center">
              <TextLink onPress={handleForgotPassword}>Lupa kata sandi?</TextLink>
            </View>
          ) : null}
          <Text variant="body" tone="secondary" className="text-center">
            Belum punya akun?{" "}
            <TextLink inline onPress={handleRegister}>
              Daftar
            </TextLink>
          </Text>
          <View className="items-center">
            <TextLink onPress={() => router.push(ROUTES.deletionStatus)}>
              Akun dihapus? Pulihkan di sini
            </TextLink>
          </View>
        </FooterBar>
      </KeyboardAvoiding>
    </Screen>
  )
}

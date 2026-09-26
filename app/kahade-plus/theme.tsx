/**
 * Screen — Kahade+ : tema eksklusif (benefit 5).
 *
 * Pilihan warna aksen eksklusif + preferensi ikon aplikasi. Hanya bisa dipilih
 * saat langganan aktif; saat berakhir, UI otomatis fallback ke tema default
 * (preferensi tersimpan dipertahankan — berlangganan lagi mengembalikannya).
 *
 * Tidak ada fetch di sini: pilihan tema adalah state perangkat — <Screen>,
 * bukan <DataScreen>. Status langganan dari `useKahadePlusTheme()`.
 */
import { View } from "react-native"
import { router } from "expo-router"
import { CheckCircle, CrownSimple, LockSimple } from "phosphor-react-native"

import { useTheme } from "@/components/theme-provider"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { Icon } from "@/components/ui/icon"
import { ListGroup, ListItem } from "@/components/ui/list-item"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"
import { translate } from "@/lib/i18n/translate"
import {
  DEFAULT_THEME_ID,
  useKahadePlusTheme,
} from "@/lib/kahade-plus-theme"
import { ROUTES } from "@/lib/routes"

export default function KahadePlusThemeScreen() {
  const { mode } = useTheme()
  const toast = useToast()
  const { themes, effectiveThemeId, canUse, isFallback, select } =
    useKahadePlusTheme()

  const choose = (id: string) => {
    if (!canUse) {
      toast.show({
        title: "Khusus anggota Kahade+",
        description: "Berlangganan untuk membuka tema eksklusif.",
        tone: "info",
      })
      return
    }
    select(id)
  }

  return (
    <Screen edges={["top"]} padded={false} scroll>
      <Header title="Tema eksklusif" />
      <View className="gap-4 px-5 pb-6 pt-3">
        {!canUse ? (
          <EmptyState
            icon={CrownSimple}
            title="Khusus anggota Kahade+"
            description="Berlangganan Kahade+ untuk membuka pilihan warna aksen dan ikon aplikasi eksklusif."
            action={
              <Button fullWidth={false} onPress={() => router.push(ROUTES.kahadePlusPlans)}>
                Lihat paket
              </Button>
            }
          />
        ) : (
          <>
            {isFallback ? (
              <Alert tone="warning" title="Langganan berakhir">
                Pilihan tema eksklusif Anda tersimpan dan akan aktif lagi begitu
                Anda berlangganan kembali.
              </Alert>
            ) : null}

            <SectionHeader
              title="Warna aksen"
              subtitle="Berlaku untuk seluruh aplikasi, mengikuti mode terang/gelap."
            />
            <ListGroup>
              <ListItem
                title="Standar Kahade"
                subtitle="Warna bawaan aplikasi"
                leading={
                  <View
                    className="h-8 w-8 rounded-full border border-border"
                    style={{ backgroundColor: mode === "dark" ? "#FFFFFF" : "#000000" }}
                  />
                }
                trailing={
                  effectiveThemeId === DEFAULT_THEME_ID ? (
                    <Icon icon={CheckCircle} weight="fill" tone="success" />
                  ) : null
                }
                onPress={() => choose(DEFAULT_THEME_ID)}
                divider
              />
              {themes.map((theme, i) => {
                const c = theme.colors[mode]
                const active = effectiveThemeId === theme.id
                return (
                  <ListItem
                    key={theme.id}
                    title={theme.name}
                    subtitle={theme.description}
                    leading={
                      <View
                        className="h-8 w-8 flex-row overflow-hidden rounded-full border border-border"
                      >
                        <View className="flex-1" style={{ backgroundColor: c.fill }} />
                        <View className="flex-1" style={{ backgroundColor: c.bgSoft }} />
                      </View>
                    }
                    trailing={
                      active ? (
                        <Icon icon={CheckCircle} weight="fill" tone="success" />
                      ) : null
                    }
                    onPress={() => choose(theme.id)}
                    divider={i < themes.length - 1}
                  />
                )
              })}
            </ListGroup>

            <SectionHeader title="Ikon aplikasi" />
            <ListGroup>
              <ListItem
                title="Ikon mengikuti tema"
                subtitle={translate(
                  "Pergantian ikon aplikasi membutuhkan pembaruan aplikasi dari toko — pilihan Anda tersimpan dan diterapkan saat tersedia.",
                )}
                leading={
                  <View className="h-8 w-8 items-center justify-center rounded-md bg-surface-elevated">
                    <Icon icon={LockSimple} size="sm" tone="default" />
                  </View>
                }
                divider={false}
              />
            </ListGroup>

            <Text variant="caption" tone="tertiary">
              Pilihan tersimpan di perangkat ini. Jika langganan berakhir, tampilan
              kembali ke standar secara otomatis.
            </Text>
          </>
        )}
      </View>
    </Screen>
  )
}

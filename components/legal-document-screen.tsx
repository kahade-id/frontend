import { useState } from "react"
import { Linking, View } from "react-native"
import { FileText } from "phosphor-react-native"
import { api } from "@/lib/api"
import { safeHttpsUrl } from "@/lib/version"
import { useApiQuery } from "@/lib/use-api-query"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { LoadingScreen } from "@/components/ui/loading-screen"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"

/** Legal claims may only come from the authoritative configuration, never a bundled draft. */
export function LegalDocumentScreen({ kind }: { kind: "terms" | "privacy" }) {
  const title = kind === "terms" ? "Syarat & Ketentuan" : "Kebijakan Privasi"
  const query = useApiQuery("public-legal-config", () => api.public.getPublicConfig())
  const [openError, setOpenError] = useState(false)
  const url = safeHttpsUrl(kind === "terms" ? query.data?.termsUrl : query.data?.privacyUrl)
  return (
    <Screen edges={["top"]} padded={false}>
      <Header title={title} />
      <View className="flex-1 px-6">
        {query.loading ? (
          <LoadingScreen message="Memuat dokumen resmi…" />
        ) : query.error ? (
          <ErrorState
            title="Dokumen belum dapat dimuat"
            description={query.error}
            onRetry={() => void query.reload()}
          />
        ) : url ? (
          <View className="gap-4 py-6">
            <Text variant="body">
              Baca versi resmi dan terbaru dari {title.toLowerCase()} pada situs Kahade.
            </Text>
            <Button
              onPress={() => {
                setOpenError(false)
                void Linking.openURL(url).catch(() => setOpenError(true))
              }}
            >
              Buka Dokumen Resmi
            </Button>
            {openError ? (
              <Text variant="body" tone="danger">
                Tautan tidak dapat dibuka. Periksa koneksi lalu coba lagi.
              </Text>
            ) : null}
          </View>
        ) : (
          <EmptyState
            icon={FileText}
            title="Dokumen resmi belum tersedia"
            description="Tautan dokumen belum dipublikasikan oleh penyedia layanan. Hubungi dukungan Kahade sebelum memberikan persetujuan; halaman ini bukan pengganti dokumen hukum."
            action={
              <Button variant="secondary" onPress={() => void query.reload()}>
                Periksa kembali
              </Button>
            }
          />
        )}
      </View>
    </Screen>
  )
}

// @vitest-environment jsdom
/**
 * Kahade — biaya render baris list.
 *
 * Berkas ini bukan uji benar/salah, melainkan ANGKA PEMBANDING untuk keputusan
 * yang berulang kali muncul di audit: "cukup bungkus barisnya dengan memo?"
 *
 * Jawabannya tidak. Tabel yang dicetak test ini menunjukkan memo saja tidak
 * mengubah apa pun selama prop callback masih dibuat inline (pola B), karena
 * elemen `onPress={() => …}` adalah fungsi baru tiap render sehingga
 * pembandingan dangkal milik memo selalu gagal. Yang benar-benar menurunkan
 * biaya ke nol adalah memo DITAMBAH callback stabil (pola C).
 *
 * Konsekuensinya untuk layar dengan kolom cari: menambal per-baris itu mahal
 * dan mudah bocor. Lebih murah mengurung state yang berubah cepat di komponen
 * terkecil — lihat components/ui/debounced-search-field.tsx.
 */
import { describe, it, expect, afterEach } from "vitest"
import { memo, useCallback, useState } from "react"
import { cleanup, render, act, fireEvent } from "@testing-library/react"
import { FlatList, Text, Pressable, View } from "react-native"

type Row = { id: string; label: string }
const DATA: Row[] = Array.from({ length: 20 }, (_, i) => ({ id: String(i), label: `baris ${i}` }))

const counts = { a: 0, b: 0, c: 0 }

/* A: pola repo saat ini — baris tanpa memo, onPress inline */
function RowPlain({ label }: { label: string; onPress: () => void }) {
  counts.a++
  return <Text>{label}</Text>
}
/* B: baris di-memo, TAPI onPress masih inline (identitas berubah tiap render) */
const RowMemoUnstableCb = memo(function Row({ label }: { label: string; onPress: () => void }) {
  counts.b++
  return <Text>{label}</Text>
})
/* C: baris di-memo + onPress stabil (menerima id, bukan closure baru) */
const RowMemoStableCb = memo(function Row({ label }: { label: string; id: string; onPress: (id: string) => void }) {
  counts.c++
  return <Text>{label}</Text>
})

function Harness({ mode }: { mode: "a" | "b" | "c" }) {
  const [tick, setTick] = useState(0)
  const stable = useCallback((_id: string) => {}, [])
  return (
    <View>
      <Pressable testID="bump" onPress={() => setTick((t) => t + 1)}><Text>tick {tick}</Text></Pressable>
      <FlatList
        data={DATA}
        keyExtractor={(r) => r.id}
        initialNumToRender={20}
        renderItem={({ item }) =>
          mode === "a" ? <RowPlain label={item.label} onPress={() => {}} /> :
          mode === "b" ? <RowMemoUnstableCb label={item.label} onPress={() => {}} /> :
          <RowMemoStableCb label={item.label} id={item.id} onPress={stable} />
        }
      />
    </View>
  )
}

async function measure(mode: "a" | "b" | "c") {
  counts[mode] = 0
  const { getByTestId } = render(<Harness mode={mode} />)
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
  const mount = counts[mode]
  counts[mode] = 0
  await act(async () => { fireEvent.click(getByTestId("bump")) })
  const onParentChange = counts[mode]
  cleanup()
  return { mount, onParentChange }
}

describe("biaya render baris list (20 baris terlihat)", () => {
  afterEach(cleanup)
  it("membandingkan tiga pola", async () => {
    const a = await measure("a")
    const b = await measure("b")
    const c = await measure("c")
    console.log(`
  pola                                    | mount | 1x state induk berubah
  ----------------------------------------|-------|-----------------------
  A tanpa memo (pola repo saat ini)       | ${String(a.mount).padStart(5)} | ${String(a.onParentChange).padStart(21)}
  B memo + callback inline                | ${String(b.mount).padStart(5)} | ${String(b.onParentChange).padStart(21)}
  C memo + callback stabil                | ${String(c.mount).padStart(5)} | ${String(c.onParentChange).padStart(21)}
`)
    // Pola A dan B sama mahalnya: memo tanpa callback stabil tidak menolong.
    expect(a.onParentChange).toBe(20)
    expect(b.onParentChange).toBe(20)
    // Pola C: tidak ada baris yang perlu digambar ulang sama sekali.
    expect(c.onParentChange).toBe(0)
    expect(a.mount).toBe(20)
  })
})

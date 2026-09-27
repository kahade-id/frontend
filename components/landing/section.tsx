/**
 * Kahade landing — <Section>: pembungkus section dengan anchor id,
 * eyebrow, judul, dan deskripsi yang konsisten.
 */
import type { ReactNode } from "react"
import { View } from "react-native"

import { cn } from "@/lib/cn"
import { Text } from "@/components/ui/text"

import { Reveal } from "./reveal"

type SectionProps = {
  id: string
  eyebrow: string
  title: string
  description?: string
  /** Section gelap (kontras) — untuk variasi ritme halaman. */
  dark?: boolean
  children: ReactNode
  className?: string
}

export function Section({ id, eyebrow, title, description, dark, children, className }: SectionProps) {
  return (
    <View
      id={id}
      className={cn("w-full", dark ? "bg-primary" : "bg-background", className)}
    >
      <View className="mx-auto w-full max-w-6xl px-5 py-16 md:px-8 md:py-24">
        <Reveal>
          <View className="mx-auto mb-10 max-w-2xl items-center md:mb-14">
            <View className="mb-4 rounded-full border border-border px-4 py-1.5">
              <Text variant="label" tone={dark ? "inverse" : "secondary"}>
                {eyebrow}
              </Text>
            </View>
            <Text variant="h2" tone={dark ? "inverse" : "primary"} className="text-center">
              {title}
            </Text>
            {description ? (
              <Text variant="body" tone={dark ? "inverse" : "secondary"} className="mt-4 text-center">
                {description}
              </Text>
            ) : null}
          </View>
        </Reveal>
        {children}
      </View>
    </View>
  )
}

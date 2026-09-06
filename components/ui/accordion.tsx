/**
 * Kahade — <Accordion> + <AccordionItem> (komposisi <Collapse>, §8 durasi standar).
 *
 * Daftar bentang-lipat untuk FAQ, "Rincian biaya", detail S&K per bagian.
 * Accordion memegang state (controlled lewat `value`/`onValueChange` atau
 * uncontrolled lewat `defaultValue`), AccordionItem merender header +
 * <Collapse>.
 *
 * Keputusan non-obvious:
 *   - `type="single"` (default) menutup item lain saat satu dibuka — untuk
 *     FAQ. `"multiple"` membiarkan beberapa terbuka — untuk rincian biaya
 *     yang perlu dibandingkan.
 *   - Pemisah antar item `border-b border-border`; `bordered` membungkus
 *     seluruh accordion dalam kartu radius.md (§6 hierarki border).
 *   - Ikon CaretDown berputar 180° dengan Animated rotate (transform tidak
 *     bisa di-className), durasi base + easing standar — sinkron dengan
 *     animasi tinggi di Collapse.
 *   - Header = PressableScale scaleOnPress=false (baris lebar) dengan
 *     `accessibilityState.expanded` — Collapse sendiri sudah menyembunyikan
 *     konten tertutup dari screen reader.
 *   - Konten dibungkus `px-4 pb-4` (bukan py) karena header sudah punya
 *     padding bawah; menghindari celah ganda.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Animated, Easing, View, type ViewProps } from "react-native"
import { CaretDown } from "phosphor-react-native"

import { Collapse } from "@/components/ui/collapse"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"
import { motionDuration, useReducedMotion } from "@/lib/use-reduced-motion"

type AccordionContextValue = {
  open: readonly string[]
  toggle: (value: string) => void
}

const AccordionContext = createContext<AccordionContextValue | null>(null)

export type AccordionType = "single" | "multiple"

export type AccordionProps = Omit<ViewProps, "children"> & {
  type?: AccordionType
  /** Controlled: daftar value yang terbuka */
  value?: readonly string[]
  onValueChange?: (open: string[]) => void
  defaultValue?: readonly string[]
  /** Bungkus dalam kartu ber-border radius.md */
  bordered?: boolean
  children: ReactNode
  className?: string
}

export function Accordion({
  type = "single",
  value,
  onValueChange,
  defaultValue = [],
  bordered = false,
  children,
  className,
  ...rest
}: AccordionProps) {
  const [internal, setInternal] = useState<readonly string[]>(defaultValue)
  const open = value ?? internal

  const toggle = useCallback(
    (v: string) => {
      const isOpen = open.includes(v)
      const next = isOpen
        ? open.filter((x) => x !== v)
        : type === "single"
          ? [v]
          : [...open, v]
      if (value == null) setInternal(next)
      onValueChange?.(next)
    },
    [open, type, value, onValueChange],
  )

  const ctx = useMemo(() => ({ open, toggle }), [open, toggle])

  return (
    <AccordionContext.Provider value={ctx}>
      <View accessible={false}
        className={cn(
          "w-full",
          bordered && "overflow-hidden rounded-md border border-border bg-surface-elevated",
          className,
        )}
        {...rest}
      >
        {children}
      </View>
    </AccordionContext.Provider>
  )
}

export type AccordionItemProps = Omit<ViewProps, "children"> & {
  value: string
  title: string
  subtitle?: string
  icon?: IconComponent
  /** Node kanan sebelum caret (mis. <Amount>) */
  trailing?: ReactNode
  disabled?: boolean
  /** Sembunyikan garis bawah (item terakhir di dalam `bordered`) */
  last?: boolean
  children: ReactNode
  className?: string
}

export function AccordionItem({
  value,
  title,
  subtitle,
  icon,
  trailing,
  disabled = false,
  last = false,
  children,
  className,
  ...rest
}: AccordionItemProps) {
  const ctx = useContext(AccordionContext)
  if (!ctx) throw new Error("<AccordionItem> harus di dalam <Accordion>")
  const open = ctx.open.includes(value)

  const rotation = useRef(new Animated.Value(open ? 1 : 0)).current
  // Reduce Motion (audit #2): rotasi chevron non-esensial -> instan.
  const reducedMotion = useReducedMotion()
  useEffect(() => {
    Animated.timing(rotation, {
      toValue: open ? 1 : 0,
      duration: motionDuration(reducedMotion, tokens.motion.duration.base),
      easing: Easing.bezier(...tokens.motion.easing.standard),
      useNativeDriver: true,
    }).start()
  }, [open, rotation, reducedMotion])
  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] })

  return (
    <View className={cn("w-full", !last && "border-b border-border", className)} {...rest}>
      <PressableScale accessibilityHint="Ketuk untuk berinteraksi" hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open, disabled }}
        accessibilityLabel={title}
        scaleOnPress={false}
        disabled={disabled}
        onPress={() => ctx.toggle(value)}
        containerClassName="w-full"
        className="min-h-14 w-full flex-row items-center gap-3 px-4 py-3 tabular-nums focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        {icon ? <Icon icon={icon} size="md" active={open} /> : null}
        <View className="flex-1 gap-[2px]">
          <Text ellipsizeMode="tail" variant="body" weight={open ? 600 : 500} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {trailing}
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Icon icon={CaretDown} size="sm" active={open} />
        </Animated.View>
      </PressableScale>

      <Collapse open={open}>
        <View className="px-4 pb-4">{children}</View>
      </Collapse>
    </View>
  )
}
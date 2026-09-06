/** Shared press, pointer and keyboard feedback. No new animation dependency. */
import { forwardRef, useCallback, useEffect, useRef, useState } from "react"
import { Animated, Easing, Platform, Pressable, View, type GestureResponderEvent, type PressableProps, type View as RNView } from "react-native"
import { cn } from "@/lib/cn"
import { haptic as fireHaptic, type HapticKind } from "@/lib/haptics"
import { tokens } from "@/lib/tokens"
import { useReducedMotion } from "@/lib/use-reduced-motion"

export type PressableScaleProps = Omit<PressableProps, "style" | "children"> & {
  className?: string
  containerClassName?: string
  scaleOnPress?: boolean
  haptic?: boolean | HapticKind
  children?: React.ReactNode
}
export const PressableScale = forwardRef<RNView, PressableScaleProps>(function PressableScale(
  { className, containerClassName, scaleOnPress = true, haptic = false, disabled,
    onPressIn, onPressOut, onHoverIn, onHoverOut, accessibilityState, children, ...rest }, ref,
) {
  const scale = useRef(new Animated.Value(1)).current
  const [pressed, setPressed] = useState(false)
  const [hovered, setHovered] = useState(false)
  const reducedMotion = useReducedMotion()
  const shouldScale = scaleOnPress && !reducedMotion && !disabled

  useEffect(() => {
    // A preference/disabled change mid-gesture must never leave a scaled control.
    if (!shouldScale) { scale.stopAnimation(); scale.setValue(1) }
    return () => scale.stopAnimation()
  }, [scale, shouldScale])
  const animateTo = useCallback((to: number) => {
    scale.stopAnimation()
    Animated.timing(scale, {
      toValue: to, duration: tokens.motion.duration.press,
      easing: Easing.bezier(...tokens.motion.easing.standard), useNativeDriver: true,
    }).start()
  }, [scale])
  const handlePressIn = useCallback((e: GestureResponderEvent) => {
    setPressed(true)
    if (shouldScale) animateTo(tokens.motion.scale.press)
    if (!disabled && haptic) fireHaptic(haptic === true ? "light" : haptic)
    onPressIn?.(e)
  }, [animateTo, disabled, haptic, onPressIn, shouldScale])
  const handlePressOut = useCallback((e: GestureResponderEvent) => {
    setPressed(false)
    if (shouldScale) animateTo(1)
    onPressOut?.(e)
  }, [animateTo, onPressOut, shouldScale])
  return (
    <Pressable
      ref={ref}
      disabled={disabled}
      unstable_pressDelay={Platform.OS === "android" ? 50 : undefined}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onHoverIn={(e) => { setHovered(true); onHoverIn?.(e) }}
      onHoverOut={(e) => { setHovered(false); onHoverOut?.(e) }}
      accessibilityState={{ ...accessibilityState, disabled: !!disabled }}
      className={cn("web:rounded-sm web:outline-none web:focus-visible:ring-2 web:focus-visible:ring-border-focus web:focus-visible:ring-offset-2 web:focus-visible:ring-offset-background", !disabled && (hovered || pressed) && "web:ring-1 web:ring-inset web:ring-border-control", containerClassName)}
      {...rest}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <View className={cn(className, disabled && "opacity-disabled")}>
          {children}
        </View>
      </Animated.View>
    </Pressable>
  )
})

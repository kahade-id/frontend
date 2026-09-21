/**
 * Stub `react-native-svg` untuk Vitest (config komponen).
 *
 * Paket aslinya menarik modul Flow react-native yang tidak bisa di-parse
 * Node/jsdom. Konsumen test (qr-code-display) hanya butuh <Svg>/<Path>/
 * <Rect> yang bisa dirender — glyph QR bukan objek test.
 */
import React from "react"

function el(tag: string) {
  const Component = (props: Record<string, unknown>) =>
    React.createElement(tag, { "data-svg": tag, ...props }, props.children as React.ReactNode)
  return Component
}

const Svg = el("svg")
export const Path = el("path")
export const Rect = el("rect")
export const Circle = el("circle")
export const G = el("g")
export const Defs = el("defs")
export const ClipPath = el("clipPath")
export const Stop = el("stop")
export const LinearGradient = el("linearGradient")
export const RadialGradient = el("radialGradient")
export const Text = el("text")
export const Line = el("line")
export const Polygon = el("polygon")
export const Ellipse = el("ellipse")
export default Svg

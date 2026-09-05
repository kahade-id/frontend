import type { PropsWithChildren } from "react"
import { ScrollViewStyleReset } from "expo-router/html"
import config from "../app.json"

/** Static web document; no session/token access during server rendering. */
export default function Html({ children }: PropsWithChildren) {
  return (
    <html lang="id">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>{config.expo.name}</title>
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  )
}

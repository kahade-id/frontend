import type { ConfigContext, ExpoConfig } from "expo/config"

/** No fabricated EAS project IDs or store identities. Configure these on the real EAS project. */
export default function appConfig({ config }: ConfigContext): ExpoConfig {
  const projectId = process.env.EAS_PROJECT_ID?.trim()
  if (
    projectId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)
  ) {
    throw new Error("EAS_PROJECT_ID must be the UUID of the existing Kahade project")
  }
  return {
    ...config,
    name: config.name ?? "Kahade",
    slug: config.slug ?? "kahade",
    ...(process.env.EAS_OWNER ? { owner: process.env.EAS_OWNER } : {}),
    version: process.env.APP_VERSION || config.version,
    // Native dependencies changed during this audit. Old binaries must not receive this bundle.
    runtimeVersion: { policy: "fingerprint" },
    ios: {
      ...config.ios,
      ...(process.env.IOS_BUNDLE_IDENTIFIER
        ? { bundleIdentifier: process.env.IOS_BUNDLE_IDENTIFIER }
        : {}),
    },
    android: {
      ...config.android,
      ...(process.env.ANDROID_APPLICATION_ID
        ? { package: process.env.ANDROID_APPLICATION_ID }
        : {}),
    },
    updates: {
      enabled: Boolean(projectId),
      ...(projectId ? { url: `https://u.expo.dev/${projectId}` } : {}),
      checkAutomatically: "ON_LOAD",
      fallbackToCacheTimeout: 0,
    },
    extra: { ...config.extra, ...(projectId ? { eas: { projectId } } : {}) },
  }
}

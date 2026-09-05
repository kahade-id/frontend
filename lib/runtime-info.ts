import Constants from "expo-constants"
import * as Application from "expo-application"
import { Platform } from "react-native"

/** The native binary version, not an OTA manifest pretending to be a newer binary. */
export function installedAppVersion(): string | undefined {
  const developmentHost = Constants.executionEnvironment === "storeClient"
  return Platform.OS === "web" || developmentHost
    ? Constants.expoConfig?.version
    : (Application.nativeApplicationVersion ?? Constants.expoConfig?.version)
}
export function installedBuildNumber(): string | undefined {
  return Platform.OS === "web" || Constants.executionEnvironment === "storeClient"
    ? undefined
    : (Application.nativeBuildVersion ?? undefined)
}

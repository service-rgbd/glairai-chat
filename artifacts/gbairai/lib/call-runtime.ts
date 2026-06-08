import Constants from "expo-constants";
import { Platform } from "react-native";

export function isNativeCallSupported() {
  return Platform.OS !== "web" && Constants.appOwnership !== "expo";
}

export function isExpoGoRuntime() {
  return Constants.appOwnership === "expo";
}

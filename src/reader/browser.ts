import { Linking, NativeModules, Platform } from "react-native";
import { safeUrl } from "../data/feeds";

export async function openExternalBrowser(url: string) {
  const target = safeUrl(url);
  if (!target) throw new Error("Invalid page URL");
  if (Platform.OS === "android" && NativeModules.RessBrowser) {
    await NativeModules.RessBrowser.open(target);
  } else {
    // Expo Go and older internal builds still launch outside Ress.
    await Linking.openURL(target);
  }
}

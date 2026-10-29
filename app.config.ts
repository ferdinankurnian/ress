import type { ExpoConfig } from "expo/config";
const config: ExpoConfig = {
  name: "Ress",
  slug: "ress",
  owner: "iydheko",
  extra: {
    eas: {
      projectId: "db0949c0-e075-48f6-a625-4236f69a61ed",
    },
  },
  scheme: "ress",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  android: {
    allowBackup: false,
    package: "dev.iydheko.ress",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
      backgroundColor: "#F5D547",
    },
  },
  ios: { bundleIdentifier: "dev.iydheko.ress", supportsTablet: true },
  plugins: [
    "expo-font",
    ["expo-splash-screen", {
      image: "./assets/adaptive-icon.png",
      imageWidth: 200,
      backgroundColor: "#F5D547",
    }],
    "./plugins/with-widget-placeholder.cjs",
    "./plugins/with-downloads.cjs",
    "./plugins/with-browser.cjs",
    "expo-document-picker",
    [
      "expo-build-properties",
      {
        android: {
          // WorkManager uses reflection before React Native starts. Older Room /
          // WorkManager consumer rules do not retain constructors with AGP 9 R8.
          extraProguardRules: `
-keep class * extends androidx.room.RoomDatabase {
    <init>();
}
-keep class * extends androidx.work.ListenableWorker {
    public <init>(android.content.Context, androidx.work.WorkerParameters);
}
-keep class * extends androidx.work.InputMerger {
    <init>();
}
`,
        },
      },
    ],
    [
      "react-native-android-widget",
      {
        fonts: [
          "./node_modules/@expo-google-fonts/vollkorn/600SemiBold/Vollkorn_600SemiBold.ttf",
          "./node_modules/@expo-google-fonts/hanken-grotesk/400Regular/HankenGrotesk_400Regular.ttf",
          "./node_modules/@expo-google-fonts/hanken-grotesk/700Bold/HankenGrotesk_700Bold.ttf",
        ],
        widgets: [
          {
            name: "RessDigest",
            widgetFeatures: "reconfigurable",
            label: "Ress — latest 10 posts",
            description: "Your 10 newest posts from your selected feeds, right at home.",
            minWidth: "250dp",
            minHeight: "180dp",
            targetCellWidth: 4,
            targetCellHeight: 3,
            resizeMode: "horizontal|vertical",
            updatePeriodMillis: 1800000,
          },
        ],
      },
    ],
  ],
};
export default config;

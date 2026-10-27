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
      backgroundColor: "#F5D547",
    },
  },
  ios: { bundleIdentifier: "dev.iydheko.ress", supportsTablet: true },
  plugins: [
    "expo-font",
    "./plugins/with-widget-placeholder.cjs",
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
        widgets: [
          {
            name: "RessDigest",
            label: "Ress — your daily edition",
            description: "The latest from your feeds, right at home.",
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

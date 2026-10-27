const { withDangerousMod } = require("expo/config-plugins");
const fs = require("node:fs/promises");
const path = require("node:path");

// Android displays the initial layout before the headless JS worker starts.
// Keep the library's IDs intact; its opaque bitmap covers this placeholder.
module.exports = (config) =>
  withDangerousMod(config, [
    "android",
    async (mod) => {
      const library = path.dirname(
        require.resolve("react-native-android-widget/package.json"),
      );
      const placeholder = `
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:orientation="vertical"
        android:padding="20dp"
        android:background="@drawable/ress_widget_background">
        <TextView android:layout_width="match_parent" android:layout_height="wrap_content"
            android:text="ress" android:textSize="30sp" android:fontFamily="serif"
            android:textStyle="bold" android:textColor="@color/ress_widget_ink" />
        <TextView android:layout_width="match_parent" android:layout_height="wrap_content"
            android:layout_marginTop="16dp" android:text="Loading your feeds…"
            android:textSize="16sp" android:textColor="@color/ress_widget_ink" />
        <TextView android:layout_width="match_parent" android:layout_height="wrap_content"
            android:layout_marginTop="8dp" android:text="Open Ress if this takes a moment."
            android:textSize="12sp" android:textColor="@color/ress_widget_muted" />
    </LinearLayout>
`;
      const res = path.join(
        mod.modRequest.platformProjectRoot,
        "app/src/main/res",
      );
      await fs.mkdir(path.join(res, "drawable"), { recursive: true });
      for (const variant of ["layout", "layout-night"]) {
        const original = await fs.readFile(
          path.join(library, `android/src/main/res/${variant}/rn_widget.xml`),
          "utf8",
        );
        const rootEnd = original.indexOf(">") + 1;
        await fs.mkdir(path.join(res, variant), { recursive: true });
        await fs.writeFile(
          path.join(res, variant, "rn_widget.xml"),
          original.slice(0, rootEnd) + placeholder + original.slice(rootEnd),
        );
      }
      await fs.writeFile(
        path.join(res, "drawable/ress_widget_background.xml"),
        '<shape xmlns:android="http://schemas.android.com/apk/res/android"><solid android:color="@color/ress_widget_paper"/><corners android:radius="24dp"/></shape>',
      );
      for (const [variant, paper, ink, muted] of [
        ["values", "#F3EAB6", "#25271F", "#64665B"],
        ["values-night", "#1B1C17", "#F1F0E5", "#ABAD9E"],
      ]) {
        await fs.mkdir(path.join(res, variant), { recursive: true });
        await fs.writeFile(
          path.join(res, variant, "ress_widget_colors.xml"),
          `<resources><color name="ress_widget_paper">${paper}</color><color name="ress_widget_ink">${ink}</color><color name="ress_widget_muted">${muted}</color></resources>`,
        );
      }
      return mod;
    },
  ]);

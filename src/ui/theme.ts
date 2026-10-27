// Hallmark · app screen · Garden adapted to Ress yellow by request · v2.0.0
export const theme = {
  color: {
    accentInk: "#25271F",
    paper: "#F6F4E9",
    surface: "#EDEADD",
    ink: "#25271F",
    muted: "#64665B",
    rule: "#D5D5C5",
    yellow: "#F5D547",
    yellowSoft: "#F3EAB6",
    error: "#9C3626",
    white: "#FFFEF7",
    transparent: "transparent",
  },
  font: {
    display: "Vollkorn_600SemiBold",
    body: "HankenGrotesk_400Regular",
    medium: "HankenGrotesk_500Medium",
    bold: "HankenGrotesk_700Bold",
    widget: "sans-serif",
    widgetDisplay: "serif",
  },
} as const;

export type ThemePreference = "device" | "light" | "dark";
export type Palette = {
  [Key in keyof typeof theme.color]: Key extends "transparent"
    ? "transparent"
    : `#${string}`;
};
export const darkColors: Palette = {
  paper: "#1B1C17",
  surface: "#272820",
  ink: "#F1F0E5",
  muted: "#ABAD9E",
  rule: "#3A3D31",
  yellow: "#F5D547",
  yellowSoft: "#302D1D",
  error: "#B94A35",
  white: "#FFFEF7",
  transparent: "transparent",
  accentInk: "#25271F",
};
export function resolveTheme(
  preference: ThemePreference,
  device: string | null | undefined,
): "light" | "dark" {
  return preference === "light" || preference === "dark"
    ? preference
    : device === "dark"
      ? "dark"
      : "light";
}
export function colorsFor(scheme: "light" | "dark"): Palette {
  return scheme === "dark" ? darkColors : theme.color;
}

import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { theme, type Palette } from "./theme";

export function ConfirmDialog({ visible, title, children, confirmLabel = "OK", cancelLabel, busy = false, destructive = false, onClose, onConfirm, colors: c }: {
  visible: boolean; title: string; children?: React.ReactNode; confirmLabel?: string; cancelLabel?: string;
  busy?: boolean; destructive?: boolean; onClose: () => void; onConfirm: () => void; colors: Palette;
}) {
  const close = () => { if (!busy) onClose(); };
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={close}>
    <View style={styles.overlay}>
      <Pressable accessibilityLabel="Dismiss dialog" style={StyleSheet.absoluteFill} onPress={close} />
      <View accessibilityViewIsModal accessibilityRole="alert" style={[styles.card, { backgroundColor: c.paper }]}>
        <Text style={{ fontFamily: theme.font.display, fontSize: 28, color: c.ink }}>{title}</Text>
        {children}
        <View style={styles.actions}>
          {cancelLabel && <Pressable accessibilityRole="button" disabled={busy} onPress={close} style={[styles.button, { backgroundColor: c.surface }]}><Text style={{ fontFamily: theme.font.bold, color: c.ink }}>{cancelLabel}</Text></Pressable>}
          <Pressable accessibilityRole="button" accessibilityLabel={destructive ? "Confirm remove source" : confirmLabel} disabled={busy} onPress={onConfirm} style={[styles.button, { backgroundColor: destructive ? c.error : c.yellow, opacity: busy ? 0.5 : 1 }]}><Text style={{ fontFamily: theme.font.bold, color: destructive ? c.white : c.accentInk }}>{confirmLabel}</Text></Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.55)" },
  card: { width: "100%", maxWidth: 400, borderRadius: 24, padding: 24, gap: 12 },
  actions: { flexDirection: "row", gap: 12, marginTop: 12 },
  button: { flex: 1, minHeight: 50, borderRadius: 28, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
});

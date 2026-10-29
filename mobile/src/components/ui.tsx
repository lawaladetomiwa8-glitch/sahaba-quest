import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

import { colors } from '@/lib/theme';

export function Screen({ children, scroll = true, style }: { children: ReactNode; scroll?: boolean; style?: ViewStyle }) {
  const content = <View style={[styles.content, style]}>{children}</View>;
  return scroll ? <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">{content}</ScrollView> : <View style={styles.screen}>{content}</View>;
}

export function Heading({ title, subtitle }: { title: string; subtitle?: string }) {
  return <View style={styles.heading}><Text style={styles.title}>{title}</Text>{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}</View>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput placeholderTextColor={colors.muted} style={styles.input} autoCorrect={false} {...props} /></View>;
}

export function Button({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.button, secondary && styles.secondaryButton, disabled && styles.disabled, pressed && !disabled && styles.pressed]}>
    {disabled ? <ActivityIndicator color={secondary ? colors.teal : '#fff'} /> : <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{title}</Text>}
  </Pressable>;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Notice({ message, success = false }: { message: string; success?: boolean }) {
  if (!message) return null;
  return <View style={[styles.notice, success && styles.successNotice]}><Text style={[styles.noticeText, success && styles.successText]}>{message}</Text></View>;
}

export const uiStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  smallMuted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  statValue: { color: colors.ink, fontSize: 25, fontWeight: '800' },
  statLabel: { color: colors.muted, fontSize: 12, marginTop: 4 },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1 },
  content: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 24, paddingBottom: 36, gap: 18 },
  heading: { gap: 6, marginBottom: 2 },
  title: { color: colors.ink, fontSize: 29, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  field: { gap: 7 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  input: { minHeight: 50, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14, color: colors.ink, fontSize: 16 },
  button: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.teal, paddingHorizontal: 18 },
  secondaryButton: { backgroundColor: colors.mint, borderWidth: 1, borderColor: colors.border },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondaryText: { color: colors.tealDark },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  card: { borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 11 },
  notice: { borderRadius: 12, borderWidth: 1, borderColor: '#F2C7C4', backgroundColor: colors.dangerBg, paddingHorizontal: 14, paddingVertical: 12 },
  noticeText: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  successNotice: { borderColor: '#B4DEC9', backgroundColor: '#EBF8F0' },
  successText: { color: colors.success },
});

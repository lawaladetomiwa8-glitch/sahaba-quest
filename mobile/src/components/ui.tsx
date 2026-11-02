import { useEffect, useRef, type ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { colors } from '@/lib/theme';

export function Screen({ children, scroll = true, style, refreshing, onRefresh }: { children: ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle>; refreshing?: boolean; onRefresh?: () => void }) {
  const content = <View style={[styles.content, style]}>{children}</View>;
  return scroll ? <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.teal} colors={[colors.teal]} /> : undefined}>{content}</ScrollView> : <View style={styles.screen}>{content}</View>;
}

export function FadeIn({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  useEffect(() => {
    let reduceMotion = false;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      reduceMotion = enabled;
      if (!cancelled) Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: reduceMotion ? 0 : 220, delay: reduceMotion ? 0 : delay, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: reduceMotion ? 0 : 220, delay: reduceMotion ? 0 : delay, useNativeDriver: true }),
      ]).start();
    });
    return () => { cancelled = true; opacity.stopAnimation(); translateY.stopAnimation(); };
  }, [delay, opacity, translateY]);
  return <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>{children}</Animated.View>;
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

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export type NoticeType = 'success' | 'info' | 'warning' | 'error';

export function Notice({ message, success = false, type }: { message: string; success?: boolean; type?: NoticeType }) {
  if (!message) return null;
  const variant = type || (success ? 'success' : 'error');
  const noticeStyle = { success: styles.successNotice, info: styles.infoNotice, warning: styles.warningNotice, error: styles.errorNotice }[variant];
  const textStyle = { success: styles.successText, info: styles.infoText, warning: styles.warningText, error: styles.errorText }[variant];
  return <View accessibilityRole="alert" style={[styles.notice, noticeStyle]}><Text style={[styles.noticeText, textStyle]}>{message}</Text></View>;
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
  notice: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  noticeText: { fontSize: 14, lineHeight: 20 },
  successNotice: { borderColor: '#B4DEC9', backgroundColor: '#EBF8F0' },
  successText: { color: colors.success },
  infoNotice: { borderColor: '#B7E5DD', backgroundColor: '#E9F8F5' },
  infoText: { color: '#086B62' },
  warningNotice: { borderColor: '#F2D29A', backgroundColor: '#FFF7E6' },
  warningText: { color: '#8A5A00' },
  errorNotice: { borderColor: '#F2C7C4', backgroundColor: colors.dangerBg },
  errorText: { color: colors.danger },
});

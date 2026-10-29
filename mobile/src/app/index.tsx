import { Redirect, router } from 'expo-router';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

import { Button, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { colors } from '@/lib/theme';

export default function WelcomeScreen() {
  const { session, loading } = useAuth();
  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.teal} /></View>;
  if (session) return <Redirect href="/(tabs)" />;

  return <Screen style={styles.content}>
    <View style={styles.brand}><Image source={require('@/assets/images/icon.png')} style={styles.logo} /><Text style={styles.brandName}>Sahaba Quest</Text></View>
    <View style={styles.hero}>
      <Text style={styles.eyebrow}>LEARN • PLAY • GROW</Text>
      <Text style={styles.title}>A brighter way to learn about the Sahaba.</Text>
      <Text style={styles.body}>Explore stories, answer questions, and build your knowledge one quest at a time.</Text>
      <View style={styles.actions}>
        <Button title="Sign in" onPress={() => router.push('/sign-in')} />
        <Button title="Create an account" secondary onPress={() => router.push('/sign-up')} />
      </View>
    </View>
    <Text style={styles.footer}>Your learning journey starts here.</Text>
  </Screen>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  content: { flex: 1, justifyContent: 'space-between', paddingTop: 34, paddingBottom: 28 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 40, height: 40, borderRadius: 12 },
  brandName: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  hero: { gap: 18, paddingVertical: 30 },
  eyebrow: { color: colors.teal, fontSize: 12, fontWeight: '800', letterSpacing: 1.8 },
  title: { color: colors.ink, fontSize: 40, lineHeight: 47, fontWeight: '900', letterSpacing: -1.1 },
  body: { color: colors.muted, fontSize: 17, lineHeight: 26 },
  actions: { gap: 12, marginTop: 12 },
  footer: { color: colors.muted, fontSize: 13, textAlign: 'center' },
});

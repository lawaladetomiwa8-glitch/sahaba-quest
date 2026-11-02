import { Redirect, router } from 'expo-router';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';

import { Button, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { getStudentSession } from '@/lib/secure-sessions';
import { getFamilyMemberSession } from '@/lib/secure-sessions';
import { apiRequest } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { LaunchLoader } from '@/components/launch-loader';
import { colors } from '@/lib/theme';

export default function WelcomeScreen() {
  const { session, loading } = useAuth();
  const [studentSession, setStudentSession] = useState(false);
  const [checkingStudent, setCheckingStudent] = useState(true);
  const [accountRoute, setAccountRoute] = useState<'player' | 'family' | 'family-member' | 'school-admin' | 'platform-admin' | null>(null);
  const [checkingAccount, setCheckingAccount] = useState(false);
  const [launchComplete, setLaunchComplete] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLaunchComplete(true), 2300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([getStudentSession(), getFamilyMemberSession()]).then(([student, member]) => {
      if (!active) return;
      setStudentSession(Boolean(student));
      setCheckingStudent(false);
      if (session && !student) {
        setCheckingAccount(true);
        void (async () => {
          const [{ data: { user } }, { data: authData }] = await Promise.all([
            supabase.auth.getUser(),
            supabase.auth.getSession(),
          ]);
          if (!user) { setAccountRoute('player'); setCheckingAccount(false); return; }
          if (member) { setAccountRoute('family-member'); setCheckingAccount(false); return; }
          const { data: profile } = await supabase.from('profiles').select('account_type').eq('id', user.id).maybeSingle();
          if (profile?.account_type === 'family') { setAccountRoute('family'); setCheckingAccount(false); return; }
          const { data: admin } = await supabase.from('admin_users').select('role').eq('user_id', user.id).eq('is_active', true).maybeSingle();
          if (admin) { setAccountRoute('platform-admin'); setCheckingAccount(false); return; }
          const accessToken = authData.session?.access_token;
          if (accessToken) {
            try { await apiRequest('/api/schools/dashboard', { token: accessToken }); setAccountRoute('school-admin'); }
            catch { setAccountRoute('player'); }
          } else setAccountRoute('player');
          setCheckingAccount(false);
        })();
      }
    }).catch(() => { if (active) setCheckingStudent(false); });
    return () => { active = false; };
  }, [session]);

  if (!launchComplete || loading || checkingStudent || (session && checkingAccount)) return <LaunchLoader />;
  if (studentSession) return <Redirect href="/student-home" />;
  if (session && accountRoute === 'family-member') return <Redirect href="/family-member-home" />;
  if (session && accountRoute === 'family') return <Redirect href="/family-owner-home" />;
  if (session && accountRoute === 'school-admin') return <Redirect href="/school-admin-home" />;
  if (session && accountRoute === 'platform-admin') return <Redirect href="/admin-home" />;
  if (session) return <Redirect href="/(tabs)" />;

  return <Screen style={styles.content}>
    <View style={styles.brand}><Image source={require('@/assets/images/icon.png')} style={styles.logo} /><Text style={styles.brandName}>Sahaba Quest</Text></View>
    <View style={styles.hero}>
      <Text style={styles.eyebrow}>LEARN • REMEMBER • COMPETE</Text>
      <Text style={styles.title}>Learn from the Best of Generations.</Text>
      <Text style={styles.body}>Discover the lives, sacrifices, character, and remarkable stories of the Companions of the Prophet ﷺ.</Text>
      <View style={styles.actions}>
        <Button title="Start your journey →" onPress={() => router.push('/account-access')} />
        <Button title="Explore the Sahaba" secondary onPress={() => router.push('/sahaba')} />
        <Button title="Schools & Madrasas" secondary onPress={() => router.push('/schools')} />
        <Button title="Create an account" secondary onPress={() => router.push('/sign-up')} />
      </View>
    </View>
    <Text style={styles.footer}>Your learning journey starts here.</Text>
  </Screen>;
}

const styles = StyleSheet.create({
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

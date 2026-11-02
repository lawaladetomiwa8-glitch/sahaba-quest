import { Redirect, router, Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { useAuth } from '@/lib/auth-context';
import { apiRequest } from '@/lib/api';
import { getStudentSession } from '@/lib/secure-sessions';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export default function TabsLayout() {
  const { session, loading } = useAuth();
  const [roleChecked, setRoleChecked] = useState(false);
  useEffect(() => {
    let active = true;
    if (loading) return () => { active = false; };
    if (!session) { setRoleChecked(true); return () => { active = false; }; }
    setRoleChecked(false);
    void (async () => {
      const student = await getStudentSession();
      if (student) { router.replace('/student-home'); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (active) setRoleChecked(true); return; }
      const { data: profile } = await supabase.from('profiles').select('account_type').eq('id', user.id).maybeSingle();
      if (profile?.account_type === 'family') { router.replace('/family-owner-home'); return; }
      const { data: admin } = await supabase.from('admin_users').select('role').eq('user_id', user.id).eq('is_active', true).maybeSingle();
      if (admin) { router.replace('/admin-home'); return; }
      try {
        await apiRequest('/api/schools/dashboard', { token: session.access_token });
        router.replace('/school-admin-home');
        return;
      } catch { /* Ordinary player accounts do not have school dashboard access. */ }
      if (active) setRoleChecked(true);
    })();
    return () => { active = false; };
  }, [loading, session]);
  if (loading) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.teal} /></View>;
  if (!session) return <Redirect href="/sign-in" />;
  if (!roleChecked) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.teal} /></View>;

  return <Tabs screenOptions={{
    headerStyle: { backgroundColor: colors.background },
    headerShadowVisible: false,
    headerTitleStyle: { color: colors.ink, fontWeight: '800' },
    tabBarActiveTintColor: colors.teal,
    tabBarInactiveTintColor: colors.muted,
    tabBarStyle: { backgroundColor: '#FFFFFF', borderTopColor: colors.border, height: 62, paddingTop: 6, paddingBottom: 6 },
    tabBarLabelStyle: { fontSize: 10, fontWeight: '700', marginTop: 1 },
    tabBarItemStyle: { paddingTop: 2 },
  }}>
    <Tabs.Screen name="index" options={{ title: 'Home', tabBarLabel: 'Home', tabBarIcon: ({ color, focused }) => <SymbolView name={{ ios: 'house.fill', android: 'home_filled' }} size={focused ? 23 : 21} tintColor={color} /> }} />
    <Tabs.Screen name="quiz" options={{ title: 'Quiz', tabBarLabel: 'Play', tabBarIcon: ({ color, focused }) => <SymbolView name={{ ios: 'play.circle.fill', android: 'sports_esports' }} size={focused ? 23 : 21} tintColor={color} /> }} />
    <Tabs.Screen name="challenges" options={{ title: 'Challenges', tabBarLabel: 'Challenges', tabBarIcon: ({ color, focused }) => <SymbolView name={{ ios: 'target', android: 'trophy' }} size={focused ? 23 : 21} tintColor={color} /> }} />
    <Tabs.Screen name="leaderboard" options={{ title: 'Leaderboard', tabBarLabel: 'Rankings', tabBarIcon: ({ color, focused }) => <SymbolView name={{ ios: 'trophy.fill', android: 'leaderboard' }} size={focused ? 23 : 21} tintColor={color} /> }} />
    <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarLabel: 'Progress', tabBarIcon: ({ color, focused }) => <SymbolView name={{ ios: 'chart.bar.fill', android: 'monitoring' }} size={focused ? 23 : 21} tintColor={color} /> }} />
    <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarLabel: 'Profile', tabBarIcon: ({ color, focused }) => <SymbolView name={{ ios: 'person.crop.circle.fill', android: 'person' }} size={focused ? 23 : 21} tintColor={color} /> }} />
  </Tabs>;
}

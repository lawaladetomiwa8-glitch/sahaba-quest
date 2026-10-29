import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/lib/auth-context';
import { colors } from '@/lib/theme';

export default function TabsLayout() {
  const { session, loading } = useAuth();
  if (loading) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.teal} /></View>;
  if (!session) return <Redirect href="/sign-in" />;

  return <Tabs screenOptions={{
    headerStyle: { backgroundColor: colors.background },
    headerShadowVisible: false,
    headerTitleStyle: { color: colors.ink, fontWeight: '800' },
    tabBarActiveTintColor: colors.teal,
    tabBarInactiveTintColor: colors.muted,
    tabBarStyle: { backgroundColor: '#FFFFFF', borderTopColor: colors.border, height: 62, paddingTop: 6, paddingBottom: 6 },
  }}>
    <Tabs.Screen name="index" options={{ title: 'Home', tabBarLabel: 'Home' }} />
    <Tabs.Screen name="quiz" options={{ title: 'Quiz', tabBarLabel: 'Play' }} />
    <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarLabel: 'Progress' }} />
    <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarLabel: 'Profile' }} />
  </Tabs>;
}

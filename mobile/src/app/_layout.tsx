import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from '@/lib/auth-context';
import { colors } from '@/lib/theme';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="auth/callback" />
        <Stack.Screen name="update-password" />
        <Stack.Screen name="account-access" />
        <Stack.Screen name="family-access" />
        <Stack.Screen name="family-member-sign-in" />
        <Stack.Screen name="school-admin-sign-in" />
        <Stack.Screen name="student-sign-in" />
        <Stack.Screen name="student-home" />
        <Stack.Screen name="family-member-home" />
        <Stack.Screen name="family-member-leaderboard" />
        <Stack.Screen name="family-ranking" />
        <Stack.Screen name="family-owner-home" />
        <Stack.Screen name="family-member-quest" />
        <Stack.Screen name="daily-quest" />
        <Stack.Screen name="school-admin-home" />
        <Stack.Screen name="schools" />
        <Stack.Screen name="schools/register" />
        <Stack.Screen name="schools/student-activity/[id]" />
        <Stack.Screen name="school-subscription" />
        <Stack.Screen name="school-management" />
        <Stack.Screen name="school-insights" />
        <Stack.Screen name="school-settings" />
        <Stack.Screen name="school-learning" />
        <Stack.Screen name="family-challenges" />
        <Stack.Screen name="family-challenge/[id]" />
        <Stack.Screen name="family-member-challenges" />
        <Stack.Screen name="family-member-challenge/[id]" />
        <Stack.Screen name="pricing" />
        <Stack.Screen name="sponsored" />
        <Stack.Screen name="sponsored-competition/[id]" />
        <Stack.Screen name="sponsored-competition-play/[id]" />
        <Stack.Screen name="sponsored-leaderboard/[id]" />
        <Stack.Screen name="sahaba" />
        <Stack.Screen name="sahaba-article/[slug]" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="challenge/[id]" />
      </Stack>
    </AuthProvider>
  );
}

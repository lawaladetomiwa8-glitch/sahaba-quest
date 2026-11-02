import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { colors } from '@/lib/theme';

type Dashboard = {
  admin: { email: string; role: string };
  school: { school_name: string; school_code: string; status: string; school_type: string };
  subscription: { status: string; billing_interval: string; student_seat_limit: number; total_amount: number; currency: string; current_period_end: string | null } | null;
  statistics: { total_students: number; active_students: number; total_classes: number; seat_limit: number; used_seats: number; remaining_seats: number };
};

export default function SchoolAdminHomeScreen() {
  const { session, loading: authLoading } = useAuth();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) { setLoading(false); return; }
    try {
      const result = await apiRequest<Dashboard & { success: boolean; error?: string }>('/api/schools/dashboard', { token });
      setDashboard(result);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load the school dashboard.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (!authLoading && session) void load(); else if (!authLoading) setLoading(false); }, [authLoading, session, load]);

  async function signOut() { await supabase.auth.signOut(); router.replace('/school-admin-sign-in'); }
  if (authLoading || loading) return <View style={styles.loading}><ActivityIndicator color={colors.teal} /></View>;
  if (!session) return <Redirect href="/school-admin-sign-in" />;
  return <Screen>
    <View style={styles.header}><Text style={styles.brand}>Sahaba Quest · Schools & Madrasas</Text><Button title="Sign out" secondary onPress={() => void signOut()} /></View>
    <Heading title={dashboard?.school.school_name || 'School dashboard'} subtitle="Manage your school's learning environment from here." />
    <Notice message={message} />
    {dashboard ? <>
      <Card style={styles.hero}><Text style={styles.eyebrow}>SCHOOL CODE</Text><Text style={styles.code}>{dashboard.school.school_code}</Text><Text style={styles.status}>{dashboard.school.status} · {dashboard.school.school_type}</Text></Card>
      <View style={styles.grid}>
        <Card style={styles.stat}><Text style={uiStyles.statValue}>{dashboard.statistics.active_students}</Text><Text style={uiStyles.statLabel}>Active students</Text></Card>
        <Card style={styles.stat}><Text style={uiStyles.statValue}>{dashboard.statistics.remaining_seats}</Text><Text style={uiStyles.statLabel}>Available seats</Text></Card>
        <Card style={styles.stat}><Text style={uiStyles.statValue}>{dashboard.statistics.total_classes}</Text><Text style={uiStyles.statLabel}>Active classes</Text></Card>
        <Card style={styles.stat}><Text style={uiStyles.statValue}>{dashboard.statistics.total_students}</Text><Text style={uiStyles.statLabel}>Student records</Text></Card>
      </View>
      <Card>
        <Text style={styles.title}>Subscription</Text>
        {dashboard.subscription ? <>
          <Text style={styles.subscription}>{dashboard.subscription.status} · {dashboard.subscription.billing_interval}</Text>
          <Text style={uiStyles.smallMuted}>{dashboard.statistics.used_seats} of {dashboard.subscription.student_seat_limit} seats used</Text>
          {dashboard.subscription.current_period_end ? <Text style={uiStyles.smallMuted}>Renews or expires {new Date(dashboard.subscription.current_period_end).toLocaleDateString()}</Text> : null}
        </> : <Text style={uiStyles.smallMuted}>No school subscription is currently active.</Text>}
      </Card>
      <Card><Text style={styles.title}>School management</Text><Text style={uiStyles.smallMuted}>Manage classes, students, learning activities, and school seats using your existing school account.</Text><Button title="Manage students and classes →" onPress={() => router.push('/school-management')} /><Button title="Questions and activities →" secondary onPress={() => router.push('/school-learning')} /><Button title="Reports and leaderboard →" secondary onPress={() => router.push('/school-insights')} /><Button title="School profile settings" secondary onPress={() => router.push('/school-settings')} /><Button title="Manage subscription →" secondary onPress={() => router.push('/school-subscription')} /><Button title="Refresh dashboard" secondary onPress={() => { setLoading(true); void load(); }} /></Card>
    </> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  brand: { flex: 1, color: colors.teal, fontSize: 12, fontWeight: '900' },
  hero: { backgroundColor: colors.tealDark, borderColor: colors.tealDark },
  eyebrow: { color: '#B6F3E9', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  code: { color: '#FFFFFF', fontSize: 25, fontWeight: '900', letterSpacing: 1 },
  status: { color: '#E0F5F1', textTransform: 'capitalize' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexGrow: 1, flexBasis: '46%', alignItems: 'center' },
  title: { color: colors.ink, fontSize: 19, fontWeight: '900' },
  subscription: { color: colors.teal, fontWeight: '900', textTransform: 'capitalize' },
});

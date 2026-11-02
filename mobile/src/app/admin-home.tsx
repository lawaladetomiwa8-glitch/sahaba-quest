import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
type Admin = { role: 'admin' | 'super_admin' };
type Competition = { id: string; sponsor_name: string; title: string; is_published: boolean; starts_at: string; ends_at: string };
export default function PlatformAdminHomeScreen() {
  const { session, loading: authLoading } = useAuth();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [items, setItems] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (active) setLoading(false); return; }
      const [role, competitions] = await Promise.all([
        supabase.from('admin_users').select('role').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
        supabase.from('sponsored_competitions').select('id,sponsor_name,title,is_published,starts_at,ends_at').order('display_order').order('starts_at', { ascending: false }),
      ]);
      if (!active) return;
      if (role.error || !role.data) setMessage(role.error?.message || 'This account does not have an active platform administrator role.');
      else { setAdmin(role.data as Admin); setItems((competitions.data || []) as Competition[]); if (competitions.error) setMessage(competitions.error.message); }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [session]);
  async function signOut() { await supabase.auth.signOut(); router.replace('/account-access'); }
  if (authLoading || loading) return <View style={styles.loading}><ActivityIndicator color={colors.teal} /></View>;
  if (!session || !admin) return <Redirect href="/sign-in" />;
  return <Screen>
    <View style={styles.header}><Text style={styles.brand}>Sahaba Quest · Admin</Text><Button title="Sign out" secondary onPress={() => void signOut()} /></View>
    <Heading title="Admin dashboard" subtitle={'Platform administration · ' + admin.role.replace('_', ' ')} />
    <Notice message={message} />
    <View style={styles.stats}><Card style={styles.stat}><Text style={uiStyles.statValue}>{items.length}</Text><Text style={uiStyles.statLabel}>Competitions</Text></Card><Card style={styles.stat}><Text style={uiStyles.statValue}>{items.filter((item) => item.is_published).length}</Text><Text style={uiStyles.statLabel}>Published</Text></Card><Card style={styles.stat}><Text style={uiStyles.statValue}>{items.filter((item) => Date.now() >= new Date(item.starts_at).getTime() && Date.now() < new Date(item.ends_at).getTime()).length}</Text><Text style={uiStyles.statLabel}>Live now</Text></Card></View>
    <Card><Text style={styles.title}>Sponsored competitions</Text><Text style={uiStyles.smallMuted}>Review existing competition records and participation.</Text><Button title="Manage competitions" onPress={() => router.push('/admin-competitions')} /><Button title="Create competition draft" secondary onPress={() => router.push('/admin-competition-new')} /></Card>
    <Card><Text style={styles.title}>Sahabah articles</Text><Text style={uiStyles.smallMuted}>Article administration is not available in the native app yet.</Text></Card>
  </Screen>;
}
const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, brand: { color: colors.teal, fontWeight: '900' }, stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, stat: { flex: 1, minWidth: 90, alignItems: 'center' }, title: { color: colors.ink, fontSize: 18, fontWeight: '900' } });

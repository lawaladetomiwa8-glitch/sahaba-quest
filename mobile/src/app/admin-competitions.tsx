import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
type Competition = { id: string; sponsor_name: string; title: string; competition_type: string; starts_at: string; ends_at: string; is_published: boolean; display_order: number };
type Attempt = { competition_id: string; user_id: string; status: string };
export default function AdminCompetitionsScreen() {
  const [items, setItems] = useState<Competition[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    void (async () => {
      const [{ data: user }] = await Promise.all([supabase.auth.getUser()]);
      if (!user.user) { router.replace('/sign-in'); return; }
      const { data: admin } = await supabase.from('admin_users').select('user_id').eq('user_id', user.user.id).eq('is_active', true).maybeSingle();
      if (!admin) { router.replace('/(tabs)'); return; }
      const [competitions, attemptRows] = await Promise.all([
        supabase.from('sponsored_competitions').select('id,sponsor_name,title,competition_type,starts_at,ends_at,is_published,display_order').order('created_at', { ascending: false }),
        supabase.from('sponsored_attempts').select('competition_id,user_id,status'),
      ]);
      if (!active) return;
      if (competitions.error || attemptRows.error) setMessage(competitions.error?.message || attemptRows.error?.message || 'Unable to load competition records.');
      setItems((competitions.data || []) as Competition[]); setAttempts((attemptRows.data || []) as Attempt[]); setLoading(false);
    })();
    return () => { active = false; };
  }, []);
  const visible = useMemo(() => items.filter((item) => {
    const state = !item.is_published ? 'draft' : Date.now() < new Date(item.starts_at).getTime() ? 'upcoming' : Date.now() < new Date(item.ends_at).getTime() ? 'live' : 'ended';
    return (filter === 'all' || state === filter) && (item.title + ' ' + item.sponsor_name).toLowerCase().includes(query.toLowerCase());
  }), [items, filter, query]);
  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.teal} /></View>;
  return <Screen><Button title="← Admin dashboard" secondary onPress={() => router.replace('/admin-home')} /><Heading title="Sponsored competitions" subtitle="Review competitions and participation." /><Notice message={message} /><TextInput value={query} onChangeText={setQuery} placeholder="Search title or sponsor" placeholderTextColor={colors.muted} style={styles.search} /><View style={styles.filters}>{['all', 'draft', 'upcoming', 'live', 'ended'].map((item) => <Button key={item} title={item} secondary={filter !== item} onPress={() => setFilter(item)} />)}</View>{visible.map((item) => { const rows = attempts.filter((attempt) => attempt.competition_id === item.id); const participants = new Set(rows.map((attempt) => attempt.user_id)).size; return <Card key={item.id}><Text style={styles.title}>{item.title}</Text><Text style={uiStyles.smallMuted}>{item.sponsor_name} · {item.competition_type} · {item.is_published ? 'Published' : 'Draft'}</Text><Text style={uiStyles.smallMuted}>{new Date(item.starts_at).toLocaleString()} – {new Date(item.ends_at).toLocaleString()}</Text><Text style={styles.stat}>{participants} participants · {rows.filter((attempt) => attempt.status === 'completed').length} completed · {rows.filter((attempt) => attempt.status === 'in_progress').length} active</Text><Button title="Open competition" onPress={() => router.push('/admin-competition/' + item.id)} /></Card>})}{!visible.length && <Card><Text style={uiStyles.smallMuted}>No competitions match these filters.</Text></Card>}</Screen>;
}
const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }, search: { minHeight: 48, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', color: colors.ink, borderRadius: 12, paddingHorizontal: 14 }, filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, title: { color: colors.ink, fontWeight: '900', fontSize: 18 }, stat: { color: colors.teal, fontWeight: '800' } });

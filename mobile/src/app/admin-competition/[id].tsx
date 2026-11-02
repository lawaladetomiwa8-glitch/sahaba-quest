import { useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Competition = { id: string; sponsor_name: string; sponsor_description: string | null; title: string; description: string | null; rules: string | null; prizes: string | null; competition_type: string; starts_at: string; ends_at: string; is_published: boolean; display_order: number };
export default function AdminCompetitionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<Competition | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/sign-in'); return; }
      const { data: admin } = await supabase.from('admin_users').select('user_id').eq('user_id', user.id).eq('is_active', true).maybeSingle();
      if (!admin) { router.replace('/(tabs)'); return; }
      const { data, error } = await supabase.from('sponsored_competitions').select('id,sponsor_name,sponsor_description,title,description,rules,prizes,competition_type,starts_at,ends_at,is_published,display_order').eq('id', id).maybeSingle();
      if (!active) return;
      if (error || !data) setMessage(error?.message || 'Competition not found.'); else setItem(data as Competition);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [id]);
  async function togglePublished() {
    if (!item) return;
    setSaving(true); setMessage('');
    const { data, error } = await supabase.from('sponsored_competitions').update({ is_published: !item.is_published }).eq('id', item.id).select('id,sponsor_name,sponsor_description,title,description,rules,prizes,competition_type,starts_at,ends_at,is_published,display_order').single();
    if (error) setMessage(error.message); else setItem(data as Competition);
    setSaving(false);
  }
  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.teal} /></View>;
  return <Screen><Button title="← Competitions" secondary onPress={() => router.replace('/admin-competitions')} /><Heading title={item?.title || 'Competition'} subtitle={item ? `${item.sponsor_name} · ${item.competition_type}` : ''} /><Notice message={message} />{item && <>
    <Card><Text style={styles.label}>Schedule</Text><Text style={styles.body}>{new Date(item.starts_at).toLocaleString()} – {new Date(item.ends_at).toLocaleString()}</Text><Text style={styles.label}>Publication</Text><Text style={styles.body}>{item.is_published ? 'Published' : 'Draft'}</Text><Button title={saving ? 'Saving…' : item.is_published ? 'Unpublish competition' : 'Publish competition'} disabled={saving} secondary={item.is_published} onPress={() => void togglePublished()} /></Card>
    {[['Sponsor', item.sponsor_description], ['Description', item.description], ['Rules', item.rules], ['Prizes', item.prizes]].map(([title, value]) => <Card key={title}><Text style={styles.label}>{title}</Text><Text style={styles.body}>{value || 'Not provided'}</Text></Card>)}
    <Card><Text style={styles.label}>Competition content</Text><Text style={uiStyles.smallMuted}>Question, announcement, and final result management remain available in the existing web administrator tools. They are not exposed here until their full native workflows are implemented.</Text></Card>
  </>}</Screen>;
}
const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }, label: { color: colors.teal, fontWeight: '900', marginBottom: 5 }, body: { color: colors.ink, lineHeight: 21 } });

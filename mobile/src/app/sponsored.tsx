import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Competition = { id: string; sponsor_name: string; sponsor_description: string | null; sponsor_banner_url: string | null; sponsor_logo_url: string | null; title: string; description: string | null; competition_type: 'weekly' | 'monthly'; starts_at: string; ends_at: string; is_published: boolean };
function status(c: Competition) { return Date.now() < new Date(c.starts_at).getTime() ? 'Upcoming' : Date.now() < new Date(c.ends_at).getTime() ? 'Live now' : 'Completed'; }
export default function SponsoredScreen() {
  const [items, setItems] = useState<Competition[]>([]);
  const [premium, setPremium] = useState(false);
  const [individual, setIndividual] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/sign-in'); return; }
      const [profile, subscription, competitions] = await Promise.all([
        supabase.from('profiles').select('account_type').eq('id', user.id).maybeSingle(),
        supabase.from('subscriptions').select('id,current_period_end,status,subscription_plans!inner(plan_type)').eq('user_id', user.id).eq('status', 'active').eq('subscription_plans.plan_type', 'plus').gt('current_period_end', new Date().toISOString()).limit(1).maybeSingle(),
        supabase.from('sponsored_competitions').select('id,sponsor_name,sponsor_description,sponsor_banner_url,sponsor_logo_url,title,description,competition_type,starts_at,ends_at,is_published').eq('is_published', true).order('starts_at', { ascending: false }),
      ]);
      if (!active) return;
      if (profile.data?.account_type === 'family') { router.replace('/family-owner-home'); return; }
      if (profile.error || competitions.error) setMessage(profile.error?.message || competitions.error?.message || 'Could not load competitions.');
      else { setItems((competitions.data || []) as Competition[]); setPremium(Boolean(subscription.data)); setIndividual(profile.data?.account_type === 'individual'); }
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);
  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.teal} /></View>;
  return <Screen>
    <Heading title="Sponsored competitions" subtitle="Learn something. Challenge yourself. Make your mark." />
    <Notice message={message} />
    {(!premium || !individual) && <Card><Text style={styles.title}>Individual Plus access required</Text><Text style={uiStyles.smallMuted}>An active Individual Plus subscription is required to participate.</Text><Button title="Explore plans" onPress={() => router.push('/pricing')} /></Card>}
    {!items.length && !message && <Card><Text style={styles.title}>No competitions yet</Text><Text style={uiStyles.smallMuted}>Check back for upcoming sponsored challenges.</Text></Card>}
    {items.map((item) => <Card key={item.id}>
      {item.sponsor_banner_url ? <Image source={{ uri: item.sponsor_banner_url }} style={styles.banner} /> : null}
      <View style={uiStyles.row}>{item.sponsor_logo_url ? <Image source={{ uri: item.sponsor_logo_url }} style={styles.logo} /> : <Text style={styles.trophy}>🏆</Text>}<View style={styles.flex}><Text style={styles.sponsor}>{item.sponsor_name}</Text><Text style={uiStyles.smallMuted}>{status(item)} · {item.competition_type}</Text></View></View>
      <Text style={styles.title}>{item.title}</Text><Text style={uiStyles.smallMuted}>{item.description || item.sponsor_description || 'A special Sahaba Quest sponsored competition.'}</Text>
      <Text style={styles.date}>{new Date(item.starts_at).toLocaleDateString()} – {new Date(item.ends_at).toLocaleDateString()}</Text>
      <Button title={status(item) === 'Completed' ? 'View results and leaderboard →' : 'View competition →'} onPress={() => router.push('/sponsored-competition/' + item.id)} />
    </Card>)}
  </Screen>;
}
const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }, banner: { width: '100%', height: 150, borderRadius: 12 }, logo: { height: 42, width: 42, borderRadius: 12 }, trophy: { fontSize: 32 }, flex: { flex: 1 }, sponsor: { fontWeight: '800', color: colors.tealDark }, title: { fontSize: 18, fontWeight: '900', color: colors.ink }, date: { fontSize: 13, color: colors.muted } });

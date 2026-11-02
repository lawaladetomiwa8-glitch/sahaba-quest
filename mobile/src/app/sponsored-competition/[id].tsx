import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Image, StyleSheet, Switch, Text, View } from 'react-native';
import { Button, Card, Field, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Competition = { id: string; sponsor_name: string; sponsor_description: string | null; sponsor_banner_url: string | null; sponsor_logo_url: string | null; title: string; description: string | null; rules: string | null; prizes: string | null; competition_type: string; starts_at: string; ends_at: string; is_published: boolean };
type Announcement = { id: string; title: string; content: string; publish_at: string };
export default function SponsoredCompetitionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<Competition | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [premium, setPremium] = useState(false);
  const [individual, setIndividual] = useState(false);
  const [phone, setPhone] = useState('');
  const [hasContact, setHasContact] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/sign-in'); return; }
      const [competition, announcement, profile, subscription, contact] = await Promise.all([
        supabase.from('sponsored_competitions').select('id,sponsor_name,sponsor_description,sponsor_banner_url,sponsor_logo_url,title,description,rules,prizes,competition_type,starts_at,ends_at,is_published').eq('id', id).eq('is_published', true).maybeSingle(),
        supabase.from('sponsored_announcements').select('id,title,content,publish_at').eq('competition_id', id).eq('is_published', true).lte('publish_at', new Date().toISOString()).order('display_order').order('publish_at'),
        supabase.from('profiles').select('account_type').eq('id', user.id).maybeSingle(),
        supabase.from('subscriptions').select('id').eq('user_id', user.id).eq('status', 'active').eq('subscription_plans.plan_type', 'plus').gt('current_period_end', new Date().toISOString()).limit(1).maybeSingle(),
        supabase.from('sponsored_player_contacts').select('whatsapp_number,whatsapp_consent').eq('user_id', user.id).maybeSingle(),
      ]);
      if (!active) return;
      if (profile.data?.account_type === 'family') { router.replace('/family-owner-home'); return; }
      if (profile.data?.account_type === 'individual') setIndividual(true);
      if (competition.error || !competition.data) setMessage(competition.error?.message || 'Competition not found.');
      else setItem(competition.data as Competition);
      if (announcement.error) setMessage(announcement.error.message);
      setAnnouncements((announcement.data || []) as Announcement[]);
      setPremium(Boolean(subscription.data));
      if (contact.data?.whatsapp_consent && contact.data.whatsapp_number) { setPhone(contact.data.whatsapp_number); setHasContact(true); }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [id]);
  const state = item ? Date.now() < new Date(item.starts_at).getTime() ? 'upcoming' : Date.now() < new Date(item.ends_at).getTime() ? 'live' : 'ended' : 'unknown';
  async function start() {
    setMessage(''); setBusy(true);
    try {
      if (!hasContact) {
        if (phone.trim().length < 7 || !consent) { setMessage('Enter a valid WhatsApp number and confirm consent before continuing.'); return; }
        const saved = await supabase.rpc('save_sponsored_player_contact', { p_whatsapp_number: phone.trim(), p_whatsapp_consent: true });
        if (saved.error) throw saved.error;
        if (saved.data?.success === false) throw new Error(saved.data.message || 'Unable to save contact details.');
      }
      const started = await supabase.rpc('start_sponsored_competition', { p_competition_id: id });
      if (started.error) throw started.error;
      if (!started.data?.attempt_id) throw new Error('The competition could not be started.');
      router.push('/sponsored-competition-play/' + id + '?attempt=' + started.data.attempt_id);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not start competition.'); }
    finally { setBusy(false); }
  }
  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.teal} /></View>;
  if (!item) return <Screen><Notice message={message || 'Competition not found.'} /><Button title="Back to competitions" onPress={() => router.replace('/sponsored')} /></Screen>;
  return <Screen>
    <Button title="← Competitions" secondary onPress={() => router.back()} />
    {item.sponsor_banner_url ? <Image source={{ uri: item.sponsor_banner_url }} style={styles.banner} /> : null}
    <Heading title={item.title} subtitle={'Sponsored by ' + item.sponsor_name + ' · ' + item.competition_type} />
    {item.sponsor_logo_url ? <Image source={{ uri: item.sponsor_logo_url }} style={styles.logo} /> : null}
    <Text style={uiStyles.smallMuted}>{item.description || ''}</Text>
    <Card><Text style={styles.title}>Competition details</Text><Text style={uiStyles.smallMuted}>Starts {new Date(item.starts_at).toLocaleString()}{'\n'}Ends {new Date(item.ends_at).toLocaleString()}{'\n'}Status: {state}</Text><Text style={styles.title}>Rules</Text><Text style={uiStyles.smallMuted}>{item.rules || 'Follow the on-screen rules and complete the timed questions.'}</Text><Text style={styles.title}>Prizes</Text><Text style={uiStyles.smallMuted}>{item.prizes || 'See the final leaderboard for competition results.'}</Text>{item.sponsor_description ? <Text style={uiStyles.smallMuted}>{item.sponsor_description}</Text> : null}</Card>
    {announcements.map((a) => <Card key={a.id}><Text style={styles.title}>{a.title}</Text><Text style={uiStyles.smallMuted}>{a.content}</Text></Card>)}
    <Button title="View leaderboard" secondary onPress={() => router.push('/sponsored-leaderboard/' + id)} />
    {(!premium || !individual) ? <Card><Text style={styles.title}>Individual Plus access required</Text><Text style={uiStyles.smallMuted}>An active Individual Plus subscription is required to participate.</Text><Button title="View plans" onPress={() => router.push('/pricing')} /></Card> : state === 'live' ? <Card><Text style={styles.title}>Join competition</Text>{hasContact ? <Text style={uiStyles.smallMuted}>Your saved contact and consent are on file. You can resume your attempt.</Text> : <><Field label="WhatsApp number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" /><View style={styles.consent}><Switch value={consent} onValueChange={setConsent} /><Text style={[uiStyles.smallMuted, styles.flex]}>I consent to Sahaba Quest storing this WhatsApp number for sponsored competition winner/contact purposes.</Text></View></>}<Notice message={message} /><Button title={busy ? 'Starting…' : hasContact ? 'Join / Resume Competition' : 'Save & Start Competition'} disabled={busy} onPress={() => void start()} /></Card> : <Notice message={state === 'upcoming' ? 'This competition has not started yet.' : 'This competition has ended.'} type="info" />}
  </Screen>;
}
const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }, banner: { width: '100%', height: 170, borderRadius: 16 }, logo: { height: 52, width: 52, borderRadius: 12 }, title: { fontWeight: '900', color: colors.ink }, consent: { flexDirection: 'row', alignItems: 'center', gap: 8 }, flex: { flex: 1 } });

import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { clearFamilyMemberSession, getFamilyMemberSession } from '@/lib/secure-sessions';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Progress = { display_name: string; current_level: number; total_xp: number; questions_answered: number; correct_answers: number; current_streak: number; best_streak: number; accuracy: number };
type Leader = { rank: number; display_name: string; total_xp: number; current_level: number; is_current_member: boolean };

export default function FamilyMemberHomeScreen() {
  const [token, setToken] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [questStatus, setQuestStatus] = useState<{ title?: string; status?: string; daily_streak?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      const savedToken = await getFamilyMemberSession();
      if (!savedToken) { if (active) { setToken(null); setLoading(false); } return; }
      setToken(savedToken);
      const [{ data: validSession, error: sessionError }, { data: progressRows, error: progressError }, { data: daily }, { data: leaderboard }] = await Promise.all([
        supabase.rpc('get_family_member_session', { p_session_token: savedToken }),
        supabase.rpc('get_family_member_progress', { p_session_token: savedToken }),
        supabase.rpc('get_daily_quest_status', { p_session_token: savedToken }),
        supabase.rpc('get_family_member_leaderboard', { p_session_token: savedToken }),
      ]);
      if (!active) return;
      if (sessionError || !Array.isArray(validSession) || !validSession.length) {
        await clearFamilyMemberSession(); setToken(null); setMessage('Your family member session has expired. Please select your profile and sign in again.');
      } else if (progressError) setMessage(progressError.message);
      else {
        setProgress(Array.isArray(progressRows) ? progressRows[0] as Progress : null);
        setQuestStatus(Array.isArray(daily) ? daily[0] : daily);
        setLeaders(Array.isArray(leaderboard) ? leaderboard as Leader[] : []);
      }
      setLoading(false);
    })().catch((error) => { if (active) { setMessage(error instanceof Error ? error.message : 'Unable to load family progress.'); setLoading(false); } });
    return () => { active = false; };
  }, []);

  async function logout() { await clearFamilyMemberSession(); setToken(null); router.replace('/family-member-sign-in'); }
  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.teal} /></View>;
  if (!token) return <Redirect href="/family-member-sign-in" />;
  return <Screen>
    <View style={styles.header}><Text style={styles.brand}>Sahaba Quest · Family</Text><Button title="Switch member" secondary onPress={() => void logout()} /></View>
    <Heading title={`Assalamu Alaikum, ${progress?.display_name || 'Family Member'} 👋`} subtitle="Welcome back to your Family Quest. Keep learning, build your streak, and see how you are progressing with your family." />
    <Notice message={message} />
    {progress ? <>
      <Card style={styles.hero}><Text style={styles.tag}>YOUR FAMILY JOURNEY</Text><Text style={styles.level}>Level {progress.current_level}</Text><Text style={styles.xp}>{progress.total_xp.toLocaleString()} XP</Text></Card>
      <View style={styles.grid}>
        <Card style={styles.stat}><Text style={uiStyles.statValue}>{progress.current_level}</Text><Text style={uiStyles.statLabel}>Current level</Text></Card>
        <Card style={styles.stat}><Text style={uiStyles.statValue}>{progress.current_streak}</Text><Text style={uiStyles.statLabel}>Current streak</Text></Card>
        <Card style={styles.stat}><Text style={uiStyles.statValue}>{Math.round(progress.accuracy || 0)}%</Text><Text style={uiStyles.statLabel}>Accuracy</Text></Card>
        <Card style={styles.stat}><Text style={uiStyles.statValue}>{progress.questions_answered}</Text><Text style={uiStyles.statLabel}>Questions</Text></Card>
      </View>
      <Card><Text style={styles.title}>Your Daily Quest Awaits</Text><Text style={uiStyles.smallMuted}>{questStatus?.title || 'A fresh set of Sahaba Quest questions every day.'}</Text><Text style={styles.streak}>🔥 {questStatus?.daily_streak || progress.current_streak} day streak</Text><Button title="Start Today's Quest →" onPress={() => router.push({ pathname: '/daily-quest', params: { member: 'true' } })} /></Card>
      <Card><Text style={styles.title}>Challenge Arena</Text><Text style={uiStyles.smallMuted}>Play challenges with your own family-member progress and saved attempts.</Text><Button title="Explore challenges →" onPress={() => router.push('/family-member-challenges')} /></Card>
      <Card><Text style={styles.title}>Family Leaderboard</Text>{leaders.slice(0, 5).map((person) => <View style={styles.leader} key={person.rank}><Text style={styles.rank}>#{person.rank}</Text><Text style={styles.leaderName}>{person.display_name}{person.is_current_member ? ' · You' : ''}</Text><Text style={styles.leaderXp}>{person.total_xp.toLocaleString()} XP</Text></View>)}</Card>
      <Button title="View full Family Leaderboard" secondary onPress={() => router.push('/family-member-leaderboard')} />
    </> : <Text style={uiStyles.smallMuted}>Family member progress is unavailable right now.</Text>}
  </Screen>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  brand: { color: colors.teal, fontSize: 13, fontWeight: '900' },
  hero: { backgroundColor: colors.tealDark, borderColor: colors.tealDark },
  tag: { color: '#B6F3E9', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  level: { color: '#fff', fontSize: 22, fontWeight: '900' },
  xp: { color: '#fff', fontSize: 28, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexGrow: 1, flexBasis: '46%', alignItems: 'center' },
  title: { color: colors.ink, fontSize: 19, fontWeight: '900' },
  streak: { color: colors.tealDark, fontWeight: '800' },
  leader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderColor: colors.border },
  rank: { width: 28, color: colors.teal, fontWeight: '900' },
  leaderName: { flex: 1, color: colors.ink, fontWeight: '700' },
  leaderXp: { color: colors.tealDark, fontWeight: '900' },
});

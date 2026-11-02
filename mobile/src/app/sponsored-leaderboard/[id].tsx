import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
type Row = { rank?: number; display_name: string; username: string; total_xp: number; correct_answers: number; total_questions: number; total_answer_time_ms: number; completed_at: string; is_current_user: boolean };
export default function SponsoredLeaderboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState('Sponsored leaderboard');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/sign-in'); return; }
      const [competition, leaderboard] = await Promise.all([
        supabase.from('sponsored_competitions').select('title,is_published').eq('id', id).eq('is_published', true).maybeSingle(),
        supabase.rpc('get_sponsored_leaderboard', { p_competition_id: id }),
      ]);
      if (!active) return;
      if (competition.error || leaderboard.error || !competition.data) setMessage(competition.error?.message || leaderboard.error?.message || 'Competition not found.');
      else { setTitle(competition.data.title); setRows((leaderboard.data || []) as Row[]); }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [id]);
  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.teal} /></View>;
  return <Screen><Button title="← Competition" secondary onPress={() => router.back()} /><Heading title={title} subtitle="Sponsored competition leaderboard" /><Notice message={message} />{!rows.length && !message && <Card><Text style={styles.name}>No completed attempts yet</Text><Text style={uiStyles.smallMuted}>The leaderboard will appear when players finish.</Text></Card>}{rows.map((row, index) => <Card key={row.username + index} style={row.is_current_user ? styles.mine : undefined}><View style={uiStyles.row}><Text style={styles.rank}>{row.rank || index + 1}</Text><View style={styles.flex}><Text style={styles.name}>{row.display_name}{row.is_current_user ? ' · You' : ''}</Text><Text style={uiStyles.smallMuted}>@{row.username}</Text></View><Text style={styles.xp}>{Number(row.total_xp || 0).toLocaleString()} XP</Text></View><Text style={uiStyles.smallMuted}>{row.correct_answers}/{row.total_questions} correct · {Math.round(Number(row.total_answer_time_ms || 0) / 1000)}s</Text></Card>)}</Screen>;
}
const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }, mine: { borderColor: colors.teal, backgroundColor: colors.mint }, rank: { width: 30, color: colors.teal, fontWeight: '900' }, flex: { flex: 1 }, name: { color: colors.ink, fontWeight: '800' }, xp: { color: colors.teal, fontWeight: '900' } });

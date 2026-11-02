import { useEffect, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { clearFamilyMemberSession, getFamilyMemberSession } from '@/lib/secure-sessions';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
type Leader = { rank: number; display_name: string; total_xp: number; current_level: number; accuracy?: number; questions_answered?: number; current_streak?: number; best_streak?: number; is_current_member: boolean };
export default function FamilyMemberLeaderboardScreen() {
  const [token, setToken] = useState<string | null>(null);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    void (async () => {
      const sessionToken = await getFamilyMemberSession();
      if (!sessionToken) { if (active) { setToken(null); setLoading(false); } return; }
      const { data, error } = await supabase.rpc('get_family_member_leaderboard', { p_session_token: sessionToken });
      if (!active) return;
      if (error) setMessage(error.message);
      else { setToken(sessionToken); setLeaders(Array.isArray(data) ? data as Leader[] : []); }
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);
  async function switchMember() { await clearFamilyMemberSession(); router.replace('/family-member-sign-in'); }
  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.teal} /></View>;
  if (!token) return <Redirect href="/family-member-sign-in" />;
  return <Screen><Button title="← Family dashboard" secondary onPress={() => router.replace('/family-member-home')} /><Heading title="Family Leaderboard" subtitle="See how your family is progressing together." /><Notice message={message} />{leaders.map((leader) => <Card key={leader.rank} style={leader.is_current_member ? styles.current : undefined}><View style={uiStyles.row}><Text style={styles.rank}>{leader.rank <= 3 ? ['🥇', '🥈', '🥉'][leader.rank - 1] : leader.rank}</Text><View style={styles.nameBlock}><Text style={styles.name}>{leader.display_name}{leader.is_current_member ? ' · You' : ''}</Text><Text style={uiStyles.smallMuted}>Level {leader.current_level} · {leader.questions_answered || 0} questions</Text></View><Text style={styles.xp}>{Number(leader.total_xp || 0).toLocaleString()} XP</Text></View><Text style={uiStyles.smallMuted}>Accuracy {Math.round(Number(leader.accuracy || 0))}% · 🔥 {leader.current_streak || 0} current · best {leader.best_streak || 0}</Text></Card>)}{!leaders.length && !message && <Card><Text style={uiStyles.smallMuted}>No family results are available yet.</Text></Card>}<Button title="Switch member" secondary onPress={() => void switchMember()} /></Screen>;
}
const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }, current: { backgroundColor: colors.mint, borderColor: colors.teal }, rank: { width: 36, fontSize: 20, color: colors.teal, fontWeight: '900' }, nameBlock: { flex: 1 }, name: { color: colors.ink, fontWeight: '900' }, xp: { color: colors.teal, fontWeight: '900' } });

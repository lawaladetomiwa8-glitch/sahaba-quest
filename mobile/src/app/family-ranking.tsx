import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
type FamilyRow = { user_id: string; display_name: string; username: string; total_xp: number; monthly_xp: number; current_level: number; current_streak: number };
type Period = { id: string; label: string; start: Date | null; end: Date | null };
function periods(): Period[] {
  const now = new Date();
  const output: Period[] = [{ id: 'all-time', label: 'All Time', start: null, end: null }];
  for (let cursor = new Date(now.getFullYear(), now.getMonth(), 1), min = new Date(2026, 8, 1); cursor >= min; cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1)) {
    output.push({ id: cursor.getFullYear() + '-' + String(cursor.getMonth() + 1).padStart(2, '0'), label: cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), start: cursor, end: new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1) });
  }
  return output;
}
export default function FamilyRankingScreen() {
  const [period, setPeriod] = useState('all-time');
  const [players, setPlayers] = useState<FamilyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const choices = periods();
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/sign-in'); return; }
      const { data: profile, error: profileError } = await supabase.from('profiles').select('account_type').eq('id', user.id).maybeSingle();
      if (profileError) { if (active) { setMessage(profileError.message); setLoading(false); } return; }
      if (profile?.account_type !== 'family') { router.replace('/(tabs)'); return; }
      let rows: FamilyRow[] = [];
      if (period === 'all-time') {
        const [profiles, progress] = await Promise.all([
          supabase.from('profiles').select('id,display_name,username,account_type').eq('account_type', 'family'),
          supabase.from('family_player_progress').select('user_id,total_xp,current_level,current_streak').order('total_xp', { ascending: false }),
        ]);
        if (profiles.error || progress.error) throw new Error(profiles.error?.message || progress.error?.message || 'Unable to load rankings.');
        const byId = new Map((profiles.data || []).map((row) => [row.id, row]));
        rows = (progress.data || []).flatMap((row) => { const profileRow = byId.get(row.user_id); return profileRow ? [{ user_id: row.user_id, display_name: profileRow.display_name || 'Family Player', username: profileRow.username || '', total_xp: Number(row.total_xp || 0), monthly_xp: Number(row.total_xp || 0), current_level: Number(row.current_level || 1), current_streak: Number(row.current_streak || 0) }] : []; });
      } else {
        const selected = choices.find((item) => item.id === period);
        if (!selected?.start || !selected.end) throw new Error('Choose a valid ranking period.');
        const { data, error } = await supabase.rpc('get_monthly_family_leaderboard', { start_date: selected.start.toISOString().slice(0, 10), end_date: selected.end.toISOString().slice(0, 10) });
        if (error) throw error;
        rows = ((data || []) as FamilyRow[]).map((row) => ({ ...row, total_xp: Number(row.total_xp || 0), monthly_xp: Number(row.monthly_xp || 0), current_level: Number(row.current_level || 1), current_streak: Number(row.current_streak || 0) })).filter((row) => row.monthly_xp > 0);
      }
      if (!active) return;
      rows.sort((a, b) => (period === 'all-time' ? b.total_xp - a.total_xp : b.monthly_xp - a.monthly_xp) || a.display_name.localeCompare(b.display_name));
      setPlayers(rows);
      setLoading(false);
    })().catch((error) => { if (active) { setMessage(error instanceof Error ? error.message : 'Unable to load family rankings.'); setLoading(false); } });
    return () => { active = false; };
  }, [period]);
  return <Screen><Button title="← Family dashboard" secondary onPress={() => router.replace('/family-owner-home')} /><Heading title="Family Leaderboard 🏆" subtitle="Compare Family Quest progress with other family accounts." /><View style={styles.periods}>{choices.map((choice) => <Button key={choice.id} title={choice.label} secondary={period !== choice.id} onPress={() => { setLoading(true); setPeriod(choice.id); }} />)}</View><Notice message={message} />{loading ? <ActivityIndicator color={colors.teal} /> : players.map((player, index) => <Card key={player.user_id}><View style={uiStyles.row}><Text style={styles.rank}>#{index + 1}</Text><View style={styles.person}><Text style={styles.name}>{player.display_name}</Text><Text style={uiStyles.smallMuted}>@{player.username} · Level {player.current_level}</Text></View><Text style={styles.xp}>{(period === 'all-time' ? player.total_xp : player.monthly_xp).toLocaleString()} XP</Text></View><Text style={uiStyles.smallMuted}>🔥 {player.current_streak} current streak</Text></Card>)}{!loading && !players.length && !message ? <Card><Text style={uiStyles.smallMuted}>No Family rankings are available for this period.</Text></Card> : null}</Screen>;
}
const styles = StyleSheet.create({ periods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, rank: { color: colors.teal, width: 38, fontWeight: '900' }, person: { flex: 1 }, name: { color: colors.ink, fontWeight: '900' }, xp: { color: colors.teal, fontWeight: '900' } });

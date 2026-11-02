import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Player = { user_id: string; display_name: string | null; username: string | null; total_xp: number | string | null; monthly_xp?: number | string | null; current_level: number | null; current_streak: number | null };
type Period = { id: string; label: string; start: Date | null; end: Date | null };
function makePeriods(): Period[] {
  const periods: Period[] = [{ id: 'all-time', label: 'All time', start: null, end: null }];
  for (let cursor = new Date(), min = new Date(2026, 8, 1); new Date(cursor.getFullYear(), cursor.getMonth(), 1) >= min; cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1)) {
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    periods.push({ id: start.getFullYear() + '-' + String(start.getMonth() + 1).padStart(2, '0'), label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), start, end: new Date(start.getFullYear(), start.getMonth() + 1, 1) });
  }
  return periods;
}

export default function LeaderboardTab() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentUser, setCurrentUser] = useState('');
  const [period, setPeriod] = useState('all-time');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const periods = makePeriods();
  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage('Sign in again to view the leaderboard.'); setLoading(false); return; }
    setCurrentUser(user.id);
    const { data: profile } = await supabase.from('profiles').select('account_type').eq('id', user.id).maybeSingle();
    if (profile?.account_type === 'family') { setMessage('Family Accounts use the Family Leaderboard from the Family dashboard.'); setLoading(false); return; }
    if (period === 'all-time') {
      const { data, error } = await supabase.rpc('get_all_time_player_leaderboard');
      if (error) setMessage(error.message);
      else setPlayers(Array.isArray(data) ? data as Player[] : []);
    } else {
      const selected = periods.find((item) => item.id === period);
      if (!selected?.start || !selected.end) setMessage('Choose a valid ranking period.');
      else {
        const { data, error } = await supabase.rpc('get_monthly_player_leaderboard', { start_date: selected.start.toISOString(), end_date: selected.end.toISOString() });
        if (error) setMessage(error.message);
        else {
          const monthly = (Array.isArray(data) ? data as Player[] : []).filter((row) => Number(row.monthly_xp || 0) > 0);
          monthly.sort((a, b) => Number(b.monthly_xp || 0) - Number(a.monthly_xp || 0) || Number(b.total_xp || 0) - Number(a.total_xp || 0));
          setPlayers(monthly);
        }
      }
    }
    setLoading(false);
  }, [period]);

  useEffect(() => { void load(); }, [load]);
  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.teal} /></View>;
  return <Screen>
    <Heading title="Global Leaderboard 🏆" subtitle="See how you rank among Sahaba Quest players." />
    <Notice message={message} />
    <Card style={styles.summary}><Text style={styles.kicker}>RANKING PERIOD</Text><Text style={styles.summaryTitle}>{periods.find((item) => item.id === period)?.label || 'All time'}</Text><Text style={uiStyles.smallMuted}>Rankings use Sahaba Quest’s server supplied XP totals for the selected period.</Text><View style={styles.periods}>{periods.map((item) => <Button key={item.id} title={item.label} secondary={period !== item.id} onPress={() => setPeriod(item.id)} />)}</View></Card>
    {players.slice(0, 100).map((player, index) => {
      const isYou = player.user_id === currentUser;
      return <Card key={player.user_id} style={[styles.row, isYou && styles.you]}>
        <Text style={styles.rank}>#{index + 1}</Text>
        <View style={styles.person}><Text style={styles.name}>{player.display_name || 'Player'}{isYou ? ' · YOU' : ''}</Text><Text style={uiStyles.smallMuted}>@{player.username || 'player'}</Text></View>
        <View style={styles.score}><Text style={styles.xp}>{Number(period === 'all-time' ? player.total_xp || 0 : player.monthly_xp || 0).toLocaleString()} XP</Text><Text style={uiStyles.smallMuted}>Level {player.current_level || 1} · 🔥 {player.current_streak || 0}</Text></View>
      </Card>;
    })}
    {!players.length && !message ? <Card><Text style={uiStyles.smallMuted}>The leaderboard is empty right now.</Text></Card> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  summary: { backgroundColor: colors.surface },
  kicker: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  summaryTitle: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  periods: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  you: { borderColor: colors.teal, backgroundColor: colors.mint },
  rank: { width: 34, color: colors.muted, fontSize: 13, fontWeight: '900' },
  person: { flex: 1 },
  name: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  score: { alignItems: 'flex-end' },
  xp: { color: colors.tealDark, fontWeight: '900' },
});

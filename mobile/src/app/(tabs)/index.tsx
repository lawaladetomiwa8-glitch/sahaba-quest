import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type DashboardData = {
  displayName: string;
  accountType: string;
  level: number;
  xp: number;
  streak: number;
  questTitle: string | null;
  questState: string | null;
};

export default function HomeTab() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setMessage('');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      setMessage(userError?.message || 'Sign in again to load your dashboard.');
      setLoading(false);
      return;
    }
    const [{ data: profile }, { data: progress }, { data: quest }] = await Promise.all([
      supabase.from('profiles').select('display_name, username, account_type').eq('id', user.id).maybeSingle(),
      supabase.from('player_progress').select('current_level, total_xp, current_streak').eq('user_id', user.id).maybeSingle(),
      supabase.rpc('get_daily_quest_status'),
    ]);
    const questRow = Array.isArray(quest) ? quest[0] : quest;
    setData({
      displayName: profile?.display_name || profile?.username || user.email?.split('@')[0] || 'Player',
      accountType: profile?.account_type || 'free',
      level: progress?.current_level || 1,
      xp: progress?.total_xp || 0,
      streak: progress?.current_streak || 0,
      questTitle: questRow?.title || null,
      questState: questRow?.status || null,
    });
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.teal} /></View>;

  return <Screen>
    <Heading title={`As-salamu alaykum, ${data?.displayName || 'Player'}!`} subtitle="Ready for today's learning journey?" />
    <Notice message={message} />
    {data ? <>
      <Card style={styles.hero}>
        <Text style={styles.eyebrow}>YOUR QUEST</Text>
        <Text style={styles.heroTitle}>Grow your knowledge, one answer at a time.</Text>
        <Text style={uiStyles.smallMuted}>Account: {data.accountType}</Text>
        <Button title="Start a quiz" onPress={() => router.push('/(tabs)/quiz')} />
      </Card>
      <View style={styles.statRow}>
        <Card style={styles.stat}><Text style={uiStyles.statValue}>{data.level}</Text><Text style={uiStyles.statLabel}>Current level</Text></Card>
        <Card style={styles.stat}><Text style={uiStyles.statValue}>{data.xp}</Text><Text style={uiStyles.statLabel}>Total XP</Text></Card>
        <Card style={styles.stat}><Text style={uiStyles.statValue}>{data.streak}</Text><Text style={uiStyles.statLabel}>Streak</Text></Card>
      </View>
      <Card>
        <Text style={styles.sectionTitle}>Daily Quest</Text>
        <Text style={uiStyles.smallMuted}>{data.questTitle || 'A new daily challenge is waiting for you.'}</Text>
        {data.questState ? <Text style={styles.questState}>{data.questState.replaceAll('_', ' ')}</Text> : null}
        <Button title="View progress" secondary onPress={() => router.push('/(tabs)/progress')} />
      </Card>
    </> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', backgroundColor: colors.background },
  hero: { backgroundColor: colors.mint, paddingVertical: 22 },
  eyebrow: { color: colors.teal, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  heroTitle: { color: colors.ink, fontSize: 23, lineHeight: 29, fontWeight: '800' },
  statRow: { flexDirection: 'row', gap: 9 },
  stat: { flex: 1, paddingHorizontal: 11, paddingVertical: 15, alignItems: 'center' },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  questState: { color: colors.teal, fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
});

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Card, FadeIn, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { SymbolView } from 'expo-symbols';

type Progress = { current_level: number; total_xp: number; questions_answered: number; correct_answers: number; current_streak: number; best_streak: number };

export default function ProgressTab() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage('Sign in again to view your progress.'); setLoading(false); return; }
    const { data, error } = await supabase.from('player_progress')
      .select('current_level, total_xp, questions_answered, correct_answers, current_streak, best_streak')
      .eq('user_id', user.id).maybeSingle();
    if (error) setMessage(error.message);
    setProgress(data);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.teal} /></View>;
  const accuracy = progress?.questions_answered ? Math.round((progress.correct_answers / progress.questions_answered) * 100) : 0;

  return <Screen>
    <Heading title="Your progress" subtitle="Every correct answer moves you forward." />
    <Notice message={message} />
    {progress ? <>
      <FadeIn><Card style={styles.highlight}><SymbolView name={{ ios: 'sparkles', android: 'auto_awesome' }} size={25} tintColor={colors.teal} /><Text style={uiStyles.statValue}>{progress.total_xp.toLocaleString()} XP</Text><Text style={uiStyles.smallMuted}>earned on your learning journey</Text></Card></FadeIn>
      <View style={styles.grid}>
        <FadeIn delay={40} style={styles.statWrap}><Card style={styles.stat}><SymbolView name={{ ios: 'star.circle.fill', android: 'military_tech' }} size={22} tintColor={colors.teal} /><Text style={uiStyles.statValue}>{progress.current_level}</Text><Text style={uiStyles.statLabel}>Current level</Text></Card></FadeIn>
        <FadeIn delay={80} style={styles.statWrap}><Card style={styles.stat}><SymbolView name={{ ios: 'checkmark.circle.fill', android: 'task_alt' }} size={22} tintColor={colors.teal} /><Text style={uiStyles.statValue}>{progress.questions_answered.toLocaleString()}</Text><Text style={uiStyles.statLabel}>Questions answered</Text></Card></FadeIn>
        <FadeIn delay={120} style={styles.statWrap}><Card style={styles.stat}><SymbolView name={{ ios: 'scope', android: 'track_changes' }} size={22} tintColor={colors.teal} /><Text style={uiStyles.statValue}>{accuracy}%</Text><Text style={uiStyles.statLabel}>Accuracy</Text><View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: accuracy }} style={styles.track}><View style={[styles.fill, { width: `${accuracy}%` }]} /></View></Card></FadeIn>
        <FadeIn delay={160} style={styles.statWrap}><Card style={styles.stat}><SymbolView name={{ ios: 'flame.fill', android: 'local_fire_department' }} size={22} tintColor="#E28A24" /><Text style={uiStyles.statValue}>{progress.current_streak}</Text><Text style={uiStyles.statLabel}>Current streak</Text></Card></FadeIn>
      </View>
      <FadeIn delay={200}><Card style={styles.bestCard}><Text style={styles.best}>Best streak: {progress.best_streak} days</Text><Text style={uiStyles.smallMuted}>Keep your streak going with a quiz today.</Text></Card></FadeIn>
    </> : <Text style={uiStyles.smallMuted}>Progress will appear once your player profile is ready.</Text>}
  </Screen>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', backgroundColor: colors.background },
  highlight: { backgroundColor: colors.mint, alignItems: 'center', paddingVertical: 25 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statWrap: { flexBasis: '47%', flexGrow: 1 },
  stat: { minHeight: 132, alignItems: 'center', justifyContent: 'center' },
  best: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  track: { height: 7, width: '100%', backgroundColor: '#E1ECE8', borderRadius: 8, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.teal, borderRadius: 8 },
  bestCard: { backgroundColor: '#F2F8FA' },
});

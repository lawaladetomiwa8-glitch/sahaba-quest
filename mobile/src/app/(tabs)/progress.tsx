import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Card, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

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
      <Card style={styles.highlight}><Text style={uiStyles.statValue}>{progress.total_xp} XP</Text><Text style={uiStyles.smallMuted}>earned on your learning journey</Text></Card>
      <View style={styles.grid}>
        <Card style={styles.stat}><Text style={uiStyles.statValue}>{progress.current_level}</Text><Text style={uiStyles.statLabel}>Current level</Text></Card>
        <Card style={styles.stat}><Text style={uiStyles.statValue}>{progress.questions_answered}</Text><Text style={uiStyles.statLabel}>Questions answered</Text></Card>
        <Card style={styles.stat}><Text style={uiStyles.statValue}>{accuracy}%</Text><Text style={uiStyles.statLabel}>Accuracy</Text></Card>
        <Card style={styles.stat}><Text style={uiStyles.statValue}>{progress.current_streak}</Text><Text style={uiStyles.statLabel}>Current streak</Text></Card>
      </View>
      <Card><Text style={styles.best}>Best streak: {progress.best_streak}</Text><Text style={uiStyles.smallMuted}>Keep your streak going with a quiz today.</Text></Card>
    </> : <Text style={uiStyles.smallMuted}>Progress will appear once your player profile is ready.</Text>}
  </Screen>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', backgroundColor: colors.background },
  highlight: { backgroundColor: colors.mint, alignItems: 'center', paddingVertical: 25 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexBasis: '47%', flexGrow: 1, alignItems: 'center' },
  best: { color: colors.ink, fontSize: 18, fontWeight: '800' },
});

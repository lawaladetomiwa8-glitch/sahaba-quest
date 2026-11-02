import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Challenge = { id: string; title: string; description: string; icon: string | null; challenge_type: string; question_count: number; time_per_question: number; is_premium: boolean; sort_order: number };
type Attempt = { challenge_id: string; status: string; questions_answered: number; correct_answers: number; score: number; passed: boolean | null };

export default function ChallengesTab() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [attempts, setAttempts] = useState<Record<string, Attempt>>({});
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage('Sign in again to view challenges.'); setLoading(false); return; }
    const [{ data: profile }, { data: subscriptions }, { data: challengeData, error: challengeError }, { data: attemptData, error: attemptError }] = await Promise.all([
      supabase.from('profiles').select('account_type').eq('id', user.id).maybeSingle(),
      supabase.from('subscriptions').select('status, subscription_plans(plan_type)').eq('user_id', user.id).eq('status', 'active').limit(1),
      supabase.from('challenges').select('id, title, description, icon, challenge_type, question_count, time_per_question, is_premium, sort_order').eq('is_active', true).order('sort_order', { ascending: true }),
      supabase.from('challenge_attempts').select('id, challenge_id, questions_answered, correct_answers, score, status, passed').eq('user_id', user.id),
    ]);
    if (profile?.account_type === 'family') { setMessage('Family Accounts use Family Challenges in the Family Quest.'); setLoading(false); return; }
    if (challengeError) setMessage(challengeError.message);
    else setChallenges(challengeData || []);
    if (attemptError) setMessage(attemptError.message);
    const attemptMap: Record<string, Attempt> = {};
    (attemptData || []).forEach((item) => { if (!attemptMap[item.challenge_id]) attemptMap[item.challenge_id] = item; });
    setAttempts(attemptMap);
    const activePlan = subscriptions?.[0]?.subscription_plans;
    const plan = Array.isArray(activePlan) ? activePlan[0] : activePlan;
    setIsPremium(['plus', 'family', 'school'].includes(plan?.plan_type || ''));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function openChallenge(challenge: Challenge) {
    const attempt = attempts[challenge.id];
    if (attempt?.status === 'completed') { setMessage('You have already completed this challenge.'); return; }
    if (challenge.is_premium && !isPremium) { setMessage('This challenge requires an active premium plan.'); return; }
    setBusyId(challenge.id); setMessage('');
    const { data, error } = await supabase.rpc('start_challenge', { p_challenge_id: challenge.id });
    setBusyId('');
    if (error) { setMessage(error.message); return; }
    if (!data?.success || !data.attempt_id) { setMessage(data?.message || 'We could not start this challenge.'); return; }
    router.push({ pathname: '/challenge/[id]', params: { id: challenge.id } });
  }

  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.teal} /></View>;
  return <Screen>
    <Heading title="Challenge Arena 🏆" subtitle="Test your knowledge, push yourself further, and build your score." />
    <Notice message={message} />
    <Card style={styles.hero}><Text style={styles.heroTitle}>More than a quiz.</Text><Text style={styles.heroCopy}>Take on focused Sahaba challenges and see what you know.</Text><Text style={styles.heroCopy}>⚡ Timed questions  ·  🏆 Challenge results</Text></Card>
    {challenges.map((challenge) => {
      const attempt = attempts[challenge.id];
      const done = attempt?.status === 'completed';
      return <Card key={challenge.id}>
        <View style={styles.challengeHeading}><Text style={styles.icon}>{challenge.icon || '🏆'}</Text><View style={styles.copy}><Text style={styles.type}>{challenge.challenge_type}</Text><Text style={styles.title}>{challenge.title}</Text></View><Text style={challenge.is_premium ? styles.premium : styles.status}>{challenge.is_premium ? 'Premium' : done ? 'Passed' : 'Ready'}</Text></View>
        <Text style={uiStyles.smallMuted}>{challenge.description}</Text>
        <Text style={styles.meta}>📝 {challenge.question_count} questions · ⏱ {challenge.time_per_question}s each</Text>
        {attempt ? <Text style={styles.meta}>Score {attempt.score} · {attempt.correct_answers}/{attempt.questions_answered} correct</Text> : null}
        <Button title={busyId === challenge.id ? 'Loading…' : done ? 'Challenge completed' : attempt ? 'Resume challenge →' : 'Start challenge →'} onPress={() => void openChallenge(challenge)} disabled={Boolean(busyId) || done} />
      </Card>;
    })}
    {!challenges.length && !message ? <Card><Text style={uiStyles.smallMuted}>No challenges are available right now.</Text></Card> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  hero: { backgroundColor: colors.mint },
  heroTitle: { color: colors.ink, fontSize: 22, fontWeight: '900' },
  heroCopy: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  challengeHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { fontSize: 26 },
  copy: { flex: 1 },
  type: { color: colors.teal, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  title: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  premium: { color: '#875B09', backgroundColor: '#FFF3C4', borderRadius: 9, padding: 6, overflow: 'hidden', fontSize: 10, fontWeight: '900' },
  status: { color: colors.success, fontSize: 11, fontWeight: '900' },
  meta: { color: colors.muted, fontSize: 12, fontWeight: '700' },
});

import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Challenge = { id: string; title: string; description: string | null; icon: string | null; challenge_type: string | null; question_count: number; time_per_question: number; is_premium: boolean; sort_order: number };
type Attempt = { challenge_id: string; status: string; questions_answered: number; correct_answers: number; score: number; passed: boolean | null };

export default function FamilyChallengesScreen() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [attempts, setAttempts] = useState<Record<string, Attempt>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setMessage('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage('Sign in with your Family Account to view challenges.'); setLoading(false); return; }
    const [{ data: profile }, { data: subscription, error: subscriptionError }, { data: attemptRows }, { data: challengeRows, error }] = await Promise.all([
      supabase.from('profiles').select('account_type').eq('id', user.id).maybeSingle(),
      supabase.from('subscriptions').select('status,current_period_end,subscription_plans(plan_type)').eq('user_id', user.id).eq('status', 'active').order('current_period_end', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('family_challenge_attempts').select('challenge_id, status, questions_answered, correct_answers, score, passed').eq('user_id', user.id),
      supabase.from('challenges').select('id,title,description,icon,challenge_type,question_count,time_per_question,is_premium,sort_order').eq('is_active', true).order('sort_order', { ascending: true }),
    ]);
    if (profile?.account_type !== 'family') setMessage('These challenges are available to the Family Account owner.');
    else if (subscriptionError || error) setMessage(subscriptionError?.message || error?.message || 'Unable to load challenges.');
    else {
      const plan = Array.isArray(subscription?.subscription_plans) ? subscription?.subscription_plans[0] : subscription?.subscription_plans;
      const activeFamilyPlan = plan?.plan_type === 'family' && !!subscription?.current_period_end && new Date(subscription.current_period_end).getTime() > Date.now();
      if (!activeFamilyPlan) setMessage('An active Family subscription is required to enter the Family Challenge Arena.');
      const map: Record<string, Attempt> = {};
      for (const item of (attemptRows || []) as Attempt[]) if (!map[item.challenge_id]) map[item.challenge_id] = item;
      setAttempts(map);
      setChallenges(((challengeRows || []) as Challenge[]).filter((item) => !['7-day quest', '7 day quest'].includes(item.title.trim().toLowerCase())));
    }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function start(item: Challenge) {
    setBusy(item.id); setMessage('');
    const { data, error } = await supabase.rpc('start_family_challenge', { p_challenge_id: item.id });
    setBusy('');
    if (error) { setMessage(error.message); return; }
    if (!data?.attempt_id) { setMessage('Unable to start this Family Challenge.'); return; }
    router.push({ pathname: '/family-challenge/[id]', params: { id: item.id } });
  }
  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.teal} /></View>;
  return <Screen><Button title="← Family dashboard" secondary onPress={() => router.replace('/family-owner-home')} /><Heading title="Family Challenge Arena" subtitle="Compete together with your family account. Challenge access and results follow the existing family subscription and scoring rules." /><Notice message={message} />{challenges.map((item) => {
    const attempt = attempts[item.id];
    return <Card key={item.id}><Text style={styles.icon}>{item.icon || '🏆'}</Text><Text style={styles.title}>{item.title}</Text><Text style={uiStyles.smallMuted}>{item.description || 'Test your Sahaba knowledge as a family.'}</Text><Text style={styles.meta}>{item.question_count} questions · {item.time_per_question}s each{item.is_premium ? ' · Family plan' : ''}</Text>{attempt ? <Text style={uiStyles.smallMuted}>{attempt.status === 'completed' ? `${attempt.passed ? 'Passed' : 'Completed'} · ${attempt.correct_answers} correct · ${attempt.score} XP` : `In progress · ${attempt.questions_answered} answered`}</Text> : null}<Button title={busy === item.id ? 'Starting…' : attempt?.status === 'completed' ? 'View result' : attempt?.status === 'in_progress' ? 'Continue challenge →' : 'Start challenge →'} disabled={!!busy} onPress={() => void start(item)} /></Card>;
  })}{!challenges.length && !message ? <Card><Text style={uiStyles.smallMuted}>No challenges are currently available.</Text></Card> : null}<Button title="Refresh challenges" secondary onPress={() => void load()} /></Screen>;
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }, icon: { fontSize: 28 }, title: { color: colors.ink, fontSize: 19, fontWeight: '900' }, meta: { color: colors.tealDark, fontWeight: '800', fontSize: 13 } });

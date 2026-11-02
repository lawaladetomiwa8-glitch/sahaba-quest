import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { getFamilyMemberSession } from '@/lib/secure-sessions';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Challenge = { id: string; title: string; description: string | null; icon: string | null; challenge_type: string; question_count: number; time_per_question: number; is_premium: boolean; available_question_count: number };
type Attempt = { challenge_id: string; status: string; questions_answered: number; correct_answers: number; score: number; passed: boolean | null };

export default function FamilyMemberChallengesScreen() {
  const [token, setToken] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [attempts, setAttempts] = useState<Record<string, Attempt>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    void (async () => {
      const savedToken = await getFamilyMemberSession();
      if (!savedToken) { if (active) { setLoading(false); setMessage('Select a family profile and sign in with its PIN.'); } return; }
      const [{ data: session }, { data: rows, error }, { data: memberAttempts, error: attemptsError }] = await Promise.all([
        supabase.rpc('get_family_member_session', { p_session_token: savedToken }),
        supabase.from('challenges').select('id,title,description,icon,challenge_type,question_count,time_per_question,is_premium').eq('is_active', true).order('created_at', { ascending: true }),
        supabase.rpc('get_family_member_challenge_attempts', { p_session_token: savedToken }),
      ]);
      if (!active) return;
      if (!Array.isArray(session) || !session.length) { setMessage('Your family member session has expired. Sign in again.'); setLoading(false); return; }
      if (error || attemptsError) { setMessage(error?.message || attemptsError?.message || 'Unable to load challenges.'); setLoading(false); return; }
      const items = (rows || []) as Omit<Challenge, 'available_question_count'>[];
      const counts: Record<string, number> = {};
      if (items.length) {
        const { data: links, error: linkError } = await supabase.from('challenge_questions').select('challenge_id, questions!inner(id,is_published)').in('challenge_id', items.map((item) => item.id)).eq('questions.is_published', true);
        if (linkError) { setMessage(linkError.message); setLoading(false); return; }
        for (const link of links || []) counts[link.challenge_id] = (counts[link.challenge_id] || 0) + 1;
      }
      const map: Record<string, Attempt> = {};
      for (const row of (memberAttempts || []) as Attempt[]) if (!map[row.challenge_id]) map[row.challenge_id] = row;
      setToken(savedToken); setAttempts(map);
      setChallenges(items.map((item) => ({ ...item, available_question_count: counts[item.id] || 0 })).filter((item) => item.available_question_count > 0 && !['7-day quest', '7 day quest'].includes(item.title.trim().toLowerCase())));
      setLoading(false);
    })().catch((error) => { if (active) { setMessage(error instanceof Error ? error.message : 'Unable to load challenges.'); setLoading(false); } });
    return () => { active = false; };
  }, []);
  async function start(item: Challenge) {
    if (!token || item.available_question_count <= 0) return;
    setBusy(item.id); setMessage('');
    const { data, error } = await supabase.rpc('start_family_member_challenge', { p_session_token: token, p_challenge_id: item.id });
    setBusy('');
    if (error) { setMessage(error.message); return; }
    if (!data?.success || !data.attempt_id) { setMessage('The challenge could not be started.'); return; }
    router.push({ pathname: '/family-member-challenge/[id]', params: { id: item.id, attempt: data.attempt_id } });
  }
  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.teal} /></View>;
  return <Screen><Button title="← Family member dashboard" secondary onPress={() => router.replace('/family-member-home')} /><Heading title="Family Challenge Arena" subtitle="Challenge yourself, earn separate XP, and keep your progress private within the family." /><Notice message={message} />{challenges.map((item) => { const attempt = attempts[item.id]; return <Card key={item.id}><Text style={styles.icon}>{item.icon || '🏆'}</Text><Text style={styles.title}>{item.title}</Text><Text style={uiStyles.smallMuted}>{item.description || 'Test your Sahaba knowledge.'}</Text><Text style={styles.meta}>{item.available_question_count} questions · {item.time_per_question}s each</Text>{attempt ? <Text style={uiStyles.smallMuted}>{attempt.status} · {attempt.correct_answers} correct · {attempt.score} XP</Text> : null}<Button title={busy === item.id ? 'Starting…' : attempt?.status === 'completed' ? 'View result' : attempt?.status === 'in_progress' ? 'Continue challenge →' : 'Start challenge →'} disabled={!!busy} onPress={() => void start(item)} /></Card>; })}{!challenges.length && !message ? <Card><Text style={uiStyles.smallMuted}>No challenges with published questions are available now.</Text></Card> : null}</Screen>;
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }, icon: { fontSize: 27 }, title: { color: colors.ink, fontSize: 19, fontWeight: '900' }, meta: { color: colors.tealDark, fontWeight: '800', fontSize: 13 } });

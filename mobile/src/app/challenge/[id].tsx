import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Challenge = { id: string; title: string; description: string; icon: string; challenge_type: string; question_count: number; time_per_question: number };
type Question = { id: string; level: number; question: string; option_a: string | null; option_b: string | null; option_c: string | null; option_d: string | null };
type Attempt = { attempt_id: string; questions_answered: number; correct_answers: number; score: number; status: string; action?: string };
type Result = { is_correct: boolean; correct_answer: string; xp_earned: number; questions_answered: number; correct_answers: number; score: number; questions_required: number; passing_score: number; completed: boolean; passed: boolean | null };

export default function ChallengeGameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [answer, setAnswer] = useState('');
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState('');
  const questionStarted = useRef(0);
  const submitting = useRef(false);

  const loadQuestion = useCallback(async (activeChallenge: Challenge, activeAttempt: Attempt) => {
    setBusy(true); setMessage(''); setQuestion(null); setResult(null); setAnswer(''); submitting.current = false;
    const { data, error } = await supabase.rpc('get_next_challenge_question', { p_attempt_id: activeAttempt.attempt_id });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    if (!Array.isArray(data) || !data.length) { setComplete(true); return; }
    const next = data[0] as Question;
    setQuestion(next); questionStarted.current = Date.now(); setRemaining(activeChallenge.time_per_question);
  }, []);

  const start = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage('Sign in again to play this challenge.'); setLoading(false); return; }
    const [{ data: challengeData, error: challengeError }, { data: profile }] = await Promise.all([
      supabase.from('challenges').select('id, title, description, icon, challenge_type, question_count, time_per_question').eq('id', id).eq('is_active', true).maybeSingle(),
      supabase.from('profiles').select('account_type').eq('id', user.id).maybeSingle(),
    ]);
    if (challengeError || !challengeData) { setMessage(challengeError?.message || 'Challenge not found.'); setLoading(false); return; }
    if (profile?.account_type === 'family') { setMessage('Family accounts play in the Family Challenge Arena.'); setLoading(false); return; }
    const loaded = challengeData as Challenge;
    setChallenge(loaded);
    const { data: attemptData, error: attemptError } = await supabase.rpc('start_challenge', { p_challenge_id: id });
    if (attemptError) { setMessage(attemptError.message); setLoading(false); return; }
    if (!attemptData?.attempt_id) { setMessage(attemptData?.message || 'Unable to start this challenge.'); setLoading(false); return; }
    const active = attemptData as Attempt;
    if (active.action === 'completed' || active.status === 'completed') { setAttempt(active); setComplete(true); setLoading(false); return; }
    setAttempt(active);
    await loadQuestion(loaded, active);
    setLoading(false);
  }, [id, loadQuestion]);

  useEffect(() => { void start(); }, [start]);

  async function submit(selected: string, timeout = false) {
    if (!question || !attempt || !challenge || result || submitting.current) return;
    if (challenge.challenge_type === 'Puzzle' && !selected.trim() && !timeout) return;
    submitting.current = true; setBusy(true); setAnswer(selected);
    const responseTime = timeout ? challenge.time_per_question * 1000 : Math.max(0, Date.now() - questionStarted.current);
    const { data, error } = await supabase.rpc('submit_challenge_answer', {
      p_attempt_id: attempt.attempt_id,
      p_question_id: question.id,
      p_selected_answer: selected.trim(),
      p_response_time_ms: Math.min(responseTime, challenge.time_per_question * 1000),
    });
    setBusy(false);
    if (error) { submitting.current = false; setMessage(error.message); return; }
    setResult(data as Result);
  }

  useEffect(() => {
    if (!question || !challenge || result || busy) return;
    const started = Date.now();
    const elapsedAtLoad = Math.max(0, challenge.time_per_question - remaining);
    const initial = started - elapsedAtLoad * 1000;
    const timer = setInterval(() => {
      const seconds = Math.max(0, challenge.time_per_question - Math.floor((Date.now() - initial) / 1000));
      setRemaining(seconds);
      if (seconds === 0) void submit('⏱', true);
    }, 250);
    return () => clearInterval(timer);
  }, [question, challenge, result, busy]);

  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.teal} /><Text style={uiStyles.smallMuted}>Loading challenge…</Text></View>;
  if (complete && challenge) return <Screen>
    <Heading title={result?.passed ? 'Challenge passed! 🏆' : 'Challenge complete'} subtitle={challenge.title} />
    <Card style={result?.passed ? styles.success : styles.result}><Text style={styles.score}>{result?.score ?? attempt?.score ?? 0} XP</Text><Text style={uiStyles.smallMuted}>{result?.correct_answers ?? attempt?.correct_answers ?? 0} correct answers · {result?.questions_answered ?? attempt?.questions_answered ?? 0} questions</Text><Text style={uiStyles.smallMuted}>Passing score: {result?.passing_score ?? '—'}</Text></Card>
    <Button title="Back to challenges" onPress={() => router.replace('/(tabs)/challenges')} />
  </Screen>;
  return <Screen>
    <Button title="← Challenges" secondary onPress={() => router.replace('/(tabs)/challenges')} />
    <Heading title={`${challenge?.icon || '🏆'} ${challenge?.title || 'Challenge'}`} subtitle={challenge?.description} />
    <Notice message={message} />
    {question && challenge ? <>
      <View style={styles.meta}><Text style={styles.metaText}>QUESTION {Math.min((attempt?.questions_answered || 0) + (result ? 0 : 1), challenge.question_count)} / {challenge.question_count}</Text><Text style={[styles.timer, remaining <= 5 && styles.urgent]}>{remaining}s</Text></View>
      <View style={styles.track}><View style={[styles.fill, { width: `${challenge.time_per_question ? (remaining / challenge.time_per_question) * 100 : 0}%` }]} /></View>
      <Card><Text style={styles.question}>{question.question}</Text></Card>
      {challenge.challenge_type === 'Puzzle' && !result ? <><TextInput value={answer} onChangeText={setAnswer} placeholder="Type your answer" style={styles.input} editable={!busy} /><Button title="Submit answer" onPress={() => void submit(answer)} disabled={busy || !answer.trim()} /></> : null}
      {challenge.challenge_type !== 'Puzzle' && !result ? [question.option_a, question.option_b, question.option_c, question.option_d].filter((option): option is string => Boolean(option?.trim())).map((option, index) => <Pressable key={`${question.id}-${index}`} disabled={busy} onPress={() => void submit(option)} style={styles.option}><Text style={styles.letter}>{String.fromCharCode(65 + index)}</Text><Text style={styles.optionText}>{option}</Text></Pressable>) : null}
      {result ? <Card style={result.is_correct ? styles.success : styles.result}><Text style={styles.resultTitle}>{result.is_correct ? `Correct! +${result.xp_earned} XP` : 'Keep learning'}</Text><Text style={uiStyles.smallMuted}>Correct answer: {result.correct_answer}</Text><Button title={result.completed ? 'See results →' : 'Next question →'} onPress={() => result.completed ? setComplete(true) : void loadQuestion(challenge, { ...attempt!, questions_answered: result.questions_answered, correct_answers: result.correct_answers, score: result.score })} /></Card> : null}
    </> : <Card><Text style={uiStyles.smallMuted}>Waiting for the challenge question.</Text></Card>}
  </Screen>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.background },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaText: { color: colors.muted, fontSize: 11, fontWeight: '900' },
  timer: { color: colors.teal, fontSize: 18, fontWeight: '900' },
  urgent: { color: colors.danger },
  track: { height: 6, borderRadius: 5, overflow: 'hidden', backgroundColor: colors.border },
  fill: { height: 6, backgroundColor: colors.teal },
  question: { color: colors.ink, fontSize: 21, lineHeight: 29, fontWeight: '800' },
  option: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 13, backgroundColor: '#fff' },
  letter: { width: 30, height: 30, lineHeight: 30, borderRadius: 10, overflow: 'hidden', textAlign: 'center', color: colors.teal, backgroundColor: colors.mint, fontWeight: '900' },
  optionText: { flex: 1, color: colors.ink, fontSize: 14 },
  input: { minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, color: colors.ink, backgroundColor: '#fff' },
  success: { backgroundColor: '#EBF8F0', borderColor: '#B4DEC9' },
  result: { backgroundColor: colors.mint },
  score: { color: colors.tealDark, fontSize: 28, fontWeight: '900' },
  resultTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' },
});

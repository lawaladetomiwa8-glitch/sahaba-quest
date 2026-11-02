import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Challenge = { id: string; title: string; description: string | null; icon: string | null; challenge_type: string; question_count: number; time_per_question: number };
type Attempt = { attempt_id: string; id?: string; status: string; questions_answered: number; correct_answers: number; score: number; passed?: boolean | null };
type Question = { id: string; question: string; option_a: string | null; option_b: string | null; option_c: string | null; option_d: string | null; question_started_at?: string };
type AnswerResult = { is_correct: boolean; correct_answer: string; score: number; questions_answered: number; correct_answers: number; session_complete: boolean; passed: boolean | null; pass_mark?: number };

export default function FamilyChallengeGameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [answer, setAnswer] = useState('');
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const startedAt = useRef(0);
  const lock = useRef(false);
  const loadQuestion = useCallback(async (attemptId: string, time: number) => {
    setBusy(true); setResult(null); setQuestion(null); setAnswer(''); lock.current = false;
    const { data, error } = await supabase.rpc('get_next_family_challenge_question', { p_attempt_id: attemptId });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    const next = Array.isArray(data) ? data[0] : null;
    if (!next) { setQuestion(null); return; }
    setQuestion(next as Question); startedAt.current = next.question_started_at ? new Date(next.question_started_at).getTime() : Date.now(); setRemaining(Math.max(0, time - Math.floor((Date.now() - startedAt.current) / 1000)));
  }, []);
  const start = useCallback(async () => {
    const [{ data: { user } }, { data: challengeData, error }] = await Promise.all([supabase.auth.getUser(), supabase.from('challenges').select('id,title,description,icon,challenge_type,question_count,time_per_question').eq('id', id).eq('is_active', true).maybeSingle()]);
    if (!user) { setMessage('Sign in as the Family Account owner.'); setLoading(false); return; }
    const { data: profile } = await supabase.from('profiles').select('account_type').eq('id', user.id).maybeSingle();
    if (profile?.account_type !== 'family') { setMessage('Family Challenge access requires the Family Account owner.'); setLoading(false); return; }
    if (error || !challengeData) { setMessage(error?.message || 'Challenge not found.'); setLoading(false); return; }
    const active = challengeData as Challenge; setChallenge(active);
    const { data: started, error: startError } = await supabase.rpc('start_family_challenge', { p_challenge_id: id });
    if (startError || !started?.attempt_id) { setMessage(startError?.message || 'Unable to start this challenge.'); setLoading(false); return; }
    const { data: details, error: detailsError } = await supabase.rpc('get_family_challenge_attempt', { p_attempt_id: started.attempt_id });
    if (detailsError || !details) { setMessage(detailsError?.message || 'Unable to load your saved attempt.'); setLoading(false); return; }
    const saved = details as Attempt; setAttempt({ ...saved, attempt_id: saved.attempt_id || saved.id || started.attempt_id });
    if (saved.status === 'completed') { setResult({ is_correct: false, correct_answer: '', score: saved.score, questions_answered: saved.questions_answered, correct_answers: saved.correct_answers, session_complete: true, passed: saved.passed ?? null }); setLoading(false); return; }
    await loadQuestion(saved.attempt_id || saved.id || started.attempt_id, active.time_per_question); setLoading(false);
  }, [id, loadQuestion]);
  useEffect(() => { void start(); }, [start]);
  async function submit(selected: string, timeout = false) {
    if (!challenge || !attempt || !question || result || lock.current) return;
    lock.current = true; setBusy(true); setAnswer(selected);
    const { data, error } = await supabase.rpc('submit_family_challenge_answer', { p_attempt_id: attempt.attempt_id, p_question_id: question.id, p_selected_answer: timeout ? '' : selected.trim(), p_response_time_ms: timeout ? challenge.time_per_question * 1000 : Math.min(challenge.time_per_question * 1000, Math.max(0, Date.now() - startedAt.current)) });
    setBusy(false);
    if (error) { lock.current = false; setMessage(error.message); return; }
    const response = (Array.isArray(data) ? data[0] : data) as AnswerResult;
    setResult(response); setAttempt((current) => current ? { ...current, score: response.score, correct_answers: response.correct_answers, questions_answered: response.questions_answered } : current);
  }
  useEffect(() => {
    if (!question || !challenge || result || busy) return;
    const interval = setInterval(() => {
      const seconds = Math.max(0, challenge.time_per_question - Math.floor((Date.now() - startedAt.current) / 1000));
      setRemaining(seconds); if (seconds === 0) void submit('', true);
    }, 250);
    return () => clearInterval(interval);
  }, [question, challenge, result, busy]);
  function abandon() {
    if (!attempt) return;
    Alert.alert('Leave this challenge?', 'Your unfinished attempt will be discarded according to the existing Family Challenge rules.', [{ text: 'Keep playing', style: 'cancel' }, { text: 'Leave challenge', style: 'destructive', onPress: () => void (async () => { const { error } = await supabase.rpc('abandon_family_challenge', { p_attempt_id: attempt.attempt_id }); if (error) setMessage(error.message); else router.replace('/family-challenges'); })() }]);
  }
  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.teal} /></View>;
  if (result?.session_complete) return <Screen><Heading title={result.passed ? 'Family Challenge passed! 🏆' : 'Family Challenge complete'} subtitle={challenge?.title} /><Card><Text style={styles.score}>{result.score} XP</Text><Text style={uiStyles.smallMuted}>{result.correct_answers} correct · {result.questions_answered} questions</Text></Card><Button title="Back to Family Challenges" onPress={() => router.replace('/family-challenges')} /></Screen>;
  const options = question ? [question.option_a, question.option_b, question.option_c, question.option_d].filter((option): option is string => Boolean(option?.trim())) : [];
  return <Screen><View style={styles.top}><Button title="← Challenges" secondary onPress={() => router.replace('/family-challenges')} /><Button title="Abandon" secondary onPress={abandon} /></View><Heading title={`${challenge?.icon || '🏆'} ${challenge?.title || 'Family Challenge'}`} subtitle={challenge?.description || undefined} /><Notice message={message} />{question ? <>
    <View style={styles.meta}><Text style={styles.muted}>QUESTION {(attempt?.questions_answered || 0) + 1} / {challenge?.question_count}</Text><Text style={[styles.timer, remaining < 6 && styles.urgent]}>{remaining}s</Text></View><Card><Text style={styles.question}>{question.question}</Text></Card>
    {challenge?.challenge_type === 'Puzzle' ? <><TextInput value={answer} onChangeText={setAnswer} placeholder="Type your answer" style={styles.input} editable={!busy} />{!result ? <Button title="Submit answer" disabled={busy || !answer.trim()} onPress={() => void submit(answer)} /> : null}</> : !result ? options.map((option, index) => <Pressable key={`${question.id}-${index}`} disabled={busy} onPress={() => void submit(option)} style={styles.option}><Text style={styles.letter}>{String.fromCharCode(65 + index)}</Text><Text style={styles.optionText}>{option}</Text></Pressable>) : null}
    {result ? <Card style={result.is_correct ? styles.success : styles.feedback}><Text style={styles.feedbackTitle}>{result.is_correct ? 'Correct!' : 'Keep learning'}</Text><Text style={uiStyles.smallMuted}>Correct answer: {result.correct_answer}</Text><Button title={result.session_complete ? 'View results' : 'Next question →'} onPress={() => result.session_complete ? null : void loadQuestion(attempt!.attempt_id, challenge!.time_per_question)} /></Card> : null}
  </> : <Card><Text style={uiStyles.smallMuted}>This attempt has no available question. Return to the challenge list and refresh.</Text><Button title="Family challenge list" onPress={() => router.replace('/family-challenges')} /></Card>}</Screen>;
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }, top: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, muted: { color: colors.muted, fontSize: 12, fontWeight: '900' }, timer: { color: colors.teal, fontWeight: '900', fontSize: 20 }, urgent: { color: colors.danger }, question: { color: colors.ink, fontWeight: '800', fontSize: 21, lineHeight: 30 }, option: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 13, padding: 12, backgroundColor: '#fff' }, letter: { color: colors.teal, fontWeight: '900', backgroundColor: colors.mint, padding: 8, borderRadius: 9 }, optionText: { flex: 1, color: colors.ink }, input: { minHeight: 52, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: '#fff', color: colors.ink }, score: { color: colors.teal, fontSize: 30, fontWeight: '900' }, success: { backgroundColor: '#EBF8F0' }, feedback: { backgroundColor: colors.mint }, feedbackTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' } });

import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { getFamilyMemberSession } from '@/lib/secure-sessions';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Challenge = { id: string; title: string; description: string | null; icon: string | null; challenge_type: string; question_count: number; time_per_question: number; status?: string };
type Question = { id: string; question: string; question_started_at: string; time_per_question: number; option_a: string | null; option_b: string | null; option_c: string | null; option_d: string | null };
type Result = { is_correct: boolean; correct_answer: string; xp_earned: number; questions_answered: number; correct_answers: number; score: number; session_complete: boolean; passed: boolean; pass_mark?: number };

export default function FamilyMemberChallengeGameScreen() {
  const { id, attempt } = useLocalSearchParams<{ id: string; attempt?: string }>();
  const [token, setToken] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [attemptId, setAttemptId] = useState(attempt || '');
  const [question, setQuestion] = useState<Question | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [answer, setAnswer] = useState('');
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const startedAt = useRef(0);
  const loadQuestion = useCallback(async (activeToken: string, activeAttemptId: string, duration: number) => {
    setBusy(true); setQuestion(null); setResult(null); setAnswer(''); lock.current = false;
    const { data, error } = await supabase.rpc('get_next_family_member_challenge_question', { p_session_token: activeToken, p_attempt_id: activeAttemptId });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    const next = Array.isArray(data) ? data[0] : null;
    if (!next) { setQuestion(null); setMessage('There are no more questions in this attempt.'); return; }
    const questionData = next as Question;
    setQuestion(questionData); startedAt.current = new Date(questionData.question_started_at).getTime();
    setRemaining(Math.max(0, Math.ceil(questionData.time_per_question - (Date.now() - startedAt.current) / 1000)));
  }, []);
  const start = useCallback(async () => {
    const savedToken = await getFamilyMemberSession();
    if (!savedToken) { setMessage('Your family member session has ended. Sign in again.'); setLoading(false); return; }
    setToken(savedToken);
    const { data: session, error: sessionError } = await supabase.rpc('get_family_member_session', { p_session_token: savedToken });
    if (sessionError || !Array.isArray(session) || !session.length) { setMessage('Your family member session has expired. Sign in again.'); setLoading(false); return; }
    const { data, error } = await supabase.rpc('start_family_member_challenge', { p_session_token: savedToken, p_challenge_id: id });
    if (error || !data?.success || !data.attempt_id) { setMessage(error?.message || 'Unable to start this challenge.'); setLoading(false); return; }
    const resolvedAttempt = attempt || data.attempt_id;
    setChallenge(data as Challenge); setAttemptId(resolvedAttempt);
    if (data.status === 'completed') { setResult({ is_correct: false, correct_answer: '', xp_earned: 0, questions_answered: data.questions_answered || 0, correct_answers: data.correct_answers || 0, score: data.score || 0, session_complete: true, passed: data.passed ?? false }); setLoading(false); return; }
    await loadQuestion(savedToken, resolvedAttempt, Number(data.time_per_question) || 30); setLoading(false);
  }, [attempt, id, loadQuestion]);
  useEffect(() => { void start(); }, [start]);
  async function submit(selected: string, timedOut = false) {
    if (!token || !challenge || !question || result || lock.current) return;
    lock.current = true; setBusy(true); setAnswer(selected);
    const { data, error } = await supabase.rpc('submit_family_member_challenge_answer', { p_session_token: token, p_attempt_id: attemptId, p_question_id: question.id, p_selected_answer: timedOut ? '' : selected || null, p_response_time_ms: timedOut ? question.time_per_question * 1000 : Math.min(question.time_per_question * 1000, Math.max(0, Date.now() - startedAt.current)) });
    setBusy(false);
    if (error) { lock.current = false; setMessage(error.message); return; }
    setResult((Array.isArray(data) ? data[0] : data) as Result);
  }
  useEffect(() => {
    if (!question || result || busy) return;
    const timer = setInterval(() => { const seconds = Math.max(0, Math.ceil(question.time_per_question - (Date.now() - startedAt.current) / 1000)); setRemaining(seconds); if (seconds === 0) void submit('', true); }, 250);
    return () => clearInterval(timer);
  }, [question, result, busy]);
  function abandon() {
    if (!token || !attemptId) return;
    Alert.alert('Leave this challenge?', 'Your answers and XP will be saved, and you can continue later.', [{ text: 'Keep playing', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: () => void (async () => { const { error } = await supabase.rpc('abandon_family_member_challenge', { p_session_token: token, p_attempt_id: attemptId }); if (error) setMessage(error.message); else router.replace('/family-member-challenges'); })() }]);
  }
  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.teal} /></View>;
  if (result?.session_complete) return <Screen><Heading title={result.passed ? 'Challenge passed! 🏆' : 'Challenge complete'} subtitle={challenge?.title} /><Card><Text style={styles.score}>{result.score} XP</Text><Text style={uiStyles.smallMuted}>{result.correct_answers} correct · {result.questions_answered} questions</Text></Card><Button title="Back to challenges" onPress={() => router.replace('/family-member-challenges')} /></Screen>;
  const options = question ? [question.option_a, question.option_b, question.option_c, question.option_d].filter((option): option is string => Boolean(option?.trim())) : [];
  return <Screen><View style={styles.top}><Button title="← Challenges" secondary onPress={() => router.replace('/family-member-challenges')} /><Button title="Leave" secondary onPress={abandon} /></View><Heading title={`${challenge?.icon || '🏆'} ${challenge?.title || 'Challenge'}`} subtitle={challenge?.description || undefined} /><Notice message={message} />{question ? <>
    <View style={styles.meta}><Text style={styles.muted}>QUESTION {result?.questions_answered || 1} / {challenge?.question_count}</Text><Text style={[styles.timer, remaining < 6 && styles.urgent]}>{remaining}s</Text></View><Card><Text style={styles.question}>{question.question}</Text></Card>
    {challenge?.challenge_type === 'Puzzle' ? <><TextInput value={answer} onChangeText={setAnswer} placeholder="Type your answer" style={styles.input} editable={!busy} />{!result ? <Button title="Submit answer" disabled={busy || !answer.trim()} onPress={() => void submit(answer)} /> : null}</> : !result ? options.map((option, index) => <Pressable key={`${question.id}-${index}`} disabled={busy} onPress={() => void submit(option)} style={styles.option}><Text style={styles.letter}>{String.fromCharCode(65 + index)}</Text><Text style={styles.optionText}>{option}</Text></Pressable>) : null}
    {result ? <Card style={result.is_correct ? styles.success : styles.feedback}><Text style={styles.feedbackTitle}>{result.is_correct ? `Correct · +${result.xp_earned} XP` : 'Keep learning'}</Text><Text style={uiStyles.smallMuted}>Correct answer: {result.correct_answer}</Text>{!result.session_complete ? <Button title="Next question →" onPress={() => void loadQuestion(token!, attemptId, challenge!.time_per_question)} /> : null}</Card> : null}
  </> : <Card><Text style={uiStyles.smallMuted}>{message || 'No further questions are available.'}</Text><Button title="Back to challenges" onPress={() => router.replace('/family-member-challenges')} /></Card>}</Screen>;
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }, top: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, meta: { flexDirection: 'row', justifyContent: 'space-between' }, muted: { color: colors.muted, fontWeight: '900' }, timer: { color: colors.teal, fontWeight: '900', fontSize: 20 }, urgent: { color: colors.danger }, question: { color: colors.ink, fontSize: 21, lineHeight: 30, fontWeight: '800' }, option: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 13 }, letter: { color: colors.teal, fontWeight: '900', backgroundColor: colors.mint, padding: 8, borderRadius: 9 }, optionText: { flex: 1, color: colors.ink }, input: { minHeight: 52, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: '#fff', color: colors.ink }, score: { color: colors.teal, fontSize: 30, fontWeight: '900' }, success: { backgroundColor: '#EBF8F0' }, feedback: { backgroundColor: colors.mint }, feedbackTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' } });

import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { getFamilyMemberSession } from '@/lib/secure-sessions';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Question = { id: string; level: number; question: string; option_a: string | null; option_b: string | null; option_c: string | null; option_d: string | null; question_type: 'multiple_choice' | 'fill_blank' | string | null; question_started_at: string };
type QuizSession = { session_id: string; level: number; questions_answered?: number };
type AnswerResult = { is_correct: boolean; timed_out: boolean; correct_answer: string; xp_earned: number; current_streak: number; level_completed: boolean; level_passed: boolean; correct_required_to_pass: number };

export default function FamilyMemberQuestScreen() {
  const [token, setToken] = useState<string | null>(null);
  const [session, setSession] = useState<QuizSession | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [answer, setAnswer] = useState('');
  const [remaining, setRemaining] = useState(30);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const submitting = useRef(false);

  const loadQuestion = useCallback(async (sessionToken: string, sessionId: string) => {
    setBusy(true); setMessage(''); setResult(null); setAnswer(''); setQuestion(null);
    const { data, error } = await supabase.rpc('get_next_family_member_quiz_question', { p_session_token: sessionToken, p_session_id: sessionId });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    if (!Array.isArray(data) || !data.length) { setMessage('This Family Quest level is complete.'); return; }
    setQuestion(data[0] as Question);
    setRemaining(Math.max(0, 30 - Math.floor((Date.now() - new Date(data[0].question_started_at).getTime()) / 1000)));
    submitting.current = false;
  }, []);

  const start = useCallback(async () => {
    const savedToken = await getFamilyMemberSession();
    if (!savedToken) { setToken(null); setLoading(false); return; }
    setToken(savedToken);
    const { data: validSession, error: sessionError } = await supabase.rpc('get_family_member_session', { p_session_token: savedToken });
    if (sessionError || !Array.isArray(validSession) || !validSession.length) { setMessage('Your family member session has expired. Sign in again.'); setLoading(false); return; }
    const { data: progress, error: progressError } = await supabase.rpc('get_family_member_progress', { p_session_token: savedToken });
    if (progressError || !Array.isArray(progress) || !progress.length) { setMessage(progressError?.message || 'Family progress is unavailable.'); setLoading(false); return; }
    const level = Math.max(1, Number(progress[0].current_level || 1));
    const { data: started, error: startError } = await supabase.rpc('start_family_member_quiz', { p_session_token: savedToken, p_level: level, p_track: 'individual' });
    if (startError || !Array.isArray(started) || !started.length) { setMessage(startError?.message || 'Could not start your family quest.'); setLoading(false); return; }
    const activeSession = started[0] as QuizSession;
    setSession(activeSession);
    await loadQuestion(savedToken, activeSession.session_id);
    setLoading(false);
  }, [loadQuestion]);

  useEffect(() => { void start(); }, [start]);

  async function submit(selected: string, timeout = false) {
    if (!token || !session || !question || result || submitting.current || busy) return;
    submitting.current = true; setBusy(true); setAnswer(selected);
    const elapsed = Math.max(0, Date.now() - new Date(question.question_started_at).getTime());
    const normalized = question.question_type === 'fill_blank' ? selected.trim().toLowerCase().replace(/\s+/g, ' ') : selected;
    const { data, error } = await supabase.rpc('submit_family_member_quiz_answer', {
      p_session_token: token,
      p_session_id: session.session_id,
      p_question_id: question.id,
      p_selected_answer: timeout ? '' : normalized,
      p_response_time_ms: timeout ? 30000 : Math.min(elapsed, 30000),
    });
    setBusy(false);
    if (error) { submitting.current = false; setMessage(error.message); return; }
    const response = Array.isArray(data) ? data[0] : data;
    if (!response) { submitting.current = false; setMessage('No answer result was returned.'); return; }
    setResult(response as AnswerResult);
  }

  useEffect(() => {
    const hasChoices = Boolean(question && [question.option_a, question.option_b, question.option_c, question.option_d].some((option) => typeof option === 'string' && option.trim()));
    if (!question || result || busy || (question.question_type !== 'fill_blank' && !hasChoices)) return;
    const tick = () => {
      const seconds = Math.max(0, 30 - Math.floor((Date.now() - new Date(question.question_started_at).getTime()) / 1000));
      setRemaining(seconds);
      if (seconds === 0) void submit('', true);
    };
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [question, result, busy]);

  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.teal} /><Text style={uiStyles.smallMuted}>Preparing your family quest…</Text></View>;
  if (!token) return <Redirect href="/family-member-sign-in" />;
  const options = question ? [question.option_a, question.option_b, question.option_c, question.option_d].filter((item): item is string => Boolean(item?.trim())) : [];
  return <Screen>
    <Button title="← Family dashboard" secondary onPress={() => router.replace('/family-member-home')} />
    <Heading title="Continue your Family Quest" subtitle="Answer before the timer runs out. Your family progress is saved separately." />
    <Notice message={message} />
    {question ? <>
      <View style={styles.meta}><Text style={styles.level}>LEVEL {question.level}</Text><Text style={[styles.timer, remaining <= 5 && styles.urgent]}>{remaining}s</Text></View>
      <View style={styles.track}><View style={[styles.fill, { width: `${(remaining / 30) * 100}%` }]} /></View>
      <Card><Text style={styles.question}>{question.question}</Text></Card>
      {!result && question.question_type !== 'fill_blank' && options.length > 0 ? options.map((option, index) => <Pressable key={`${question.id}-${index}`} onPress={() => void submit(option)} disabled={busy} style={({ pressed }) => [styles.option, pressed && styles.selected]}><Text style={styles.letter}>{String.fromCharCode(65 + index)}</Text><Text style={styles.optionText}>{option}</Text></Pressable>) : null}
      {!result && question.question_type !== 'fill_blank' && options.length === 0 ? <><Notice message="Answer choices are unavailable for this question. The timer is paused while you reload it." type="warning" /><Button title="Retry loading question" secondary onPress={() => session && token && void loadQuestion(token, session.session_id)} disabled={busy} /></> : null}
      {!result && question.question_type === 'fill_blank' ? <><TextInput value={answer} onChangeText={setAnswer} placeholder="Type your answer" style={styles.input} editable={!busy} /><Button title="Submit answer" onPress={() => void submit(answer)} disabled={busy || !answer.trim()} /></> : null}
      {result ? <Card style={result.is_correct ? styles.correct : styles.wrong}><Text style={styles.resultTitle}>{result.timed_out ? "Time's up" : result.is_correct ? `MashaAllah! +${result.xp_earned} XP` : 'Not quite — keep learning.'}</Text><Text style={uiStyles.smallMuted}>Correct answer: {result.correct_answer}</Text>{result.level_completed ? <Text style={uiStyles.smallMuted}>{result.level_passed ? 'You passed this level.' : `You need ${result.correct_required_to_pass} correct answers to pass.`}</Text> : null}<Button title="Next question →" onPress={() => void loadQuestion(token, session!.session_id)} /></Card> : null}
      {busy ? <Text style={uiStyles.smallMuted}>Checking your answer…</Text> : null}
    </> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.background },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  level: { color: colors.muted, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  timer: { color: colors.teal, fontSize: 18, fontWeight: '900' },
  urgent: { color: colors.danger },
  track: { height: 6, borderRadius: 6, overflow: 'hidden', backgroundColor: colors.border },
  fill: { height: 6, backgroundColor: colors.teal },
  question: { color: colors.ink, fontSize: 21, lineHeight: 30, fontWeight: '800' },
  option: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 13, backgroundColor: colors.surface },
  selected: { backgroundColor: colors.mint },
  letter: { width: 30, height: 30, lineHeight: 30, borderRadius: 10, overflow: 'hidden', textAlign: 'center', color: colors.teal, backgroundColor: colors.mint, fontWeight: '900' },
  optionText: { flex: 1, color: colors.ink, fontSize: 15 },
  input: { minHeight: 52, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: colors.border, color: colors.ink, backgroundColor: colors.surface },
  correct: { backgroundColor: '#EBF8F0', borderColor: '#B4DEC9' },
  wrong: { backgroundColor: colors.dangerBg, borderColor: '#F2C7C4' },
  resultTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' },
});

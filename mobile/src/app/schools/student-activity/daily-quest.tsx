import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { getFamilyMemberSession } from '@/lib/secure-sessions';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Status = { title: string; description: string | null; question_count: number; time_per_question: number; status: 'not_started' | 'in_progress' | 'completed'; attempt_id: string | null; questions_answered: number; correct_answers: number; score: number; daily_streak: number; best_daily_streak: number };
type Question = { id: string; question_number: number; total_questions: number; question: string; option_a: string; option_b: string; option_c: string; option_d: string; time_per_question: number };
type Result = { is_correct: boolean; correct_answer: string; xp_earned: number; questions_answered: number; correct_answers: number; questions_remaining: number; completed: boolean; daily_streak: number | null; current_streak: number };

export default function DailyQuestScreen() {
  const { member } = useLocalSearchParams<{ member?: string }>();
  const memberMode = member === 'true';
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [remaining, setRemaining] = useState(15);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const startedAt = useRef(0);

  async function loadQuestion(attemptId: string, sessionToken: string | null) {
    setBusy(true); setQuestion(null); setResult(null); lock.current = false;
    const { data, error } = await supabase.rpc('get_next_daily_quest_question', { p_attempt_id: attemptId, p_session_token: sessionToken });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    const next = Array.isArray(data) ? data[0] : data;
    if (!next) { setFinished(true); return; }
    setQuestion(next as Question); setRemaining(next.time_per_question || status?.time_per_question || 15); startedAt.current = Date.now();
  }

  useEffect(() => {
    let active = true;
    (async () => {
      const familyToken = memberMode ? await getFamilyMemberSession() : null;
      if (memberMode && !familyToken) { if (active) { setMessage('Your family member session has ended. Sign in again.'); setLoading(false); } return; }
      if (!memberMode) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { if (active) { setMessage('Sign in to start a Daily Quest.'); setLoading(false); } return; }
        const { data: profile } = await supabase.from('profiles').select('account_type').eq('id', user.id).maybeSingle();
        if (profile?.account_type === 'family') { if (active) { setMessage('Choose a family member to start their Daily Quest.'); setLoading(false); } return; }
      }
      const { data, error } = await supabase.rpc('get_daily_quest_status', { p_session_token: familyToken });
      if (!active) return;
      if (error) setMessage(error.message);
      else { setStatus(data as Status); if (data?.status === 'completed') setFinished(true); }
      setToken(familyToken); setLoading(false);
    })().catch((error) => { if (active) { setMessage(error instanceof Error ? error.message : 'Unable to load Daily Quest.'); setLoading(false); } });
    return () => { active = false; };
  }, [memberMode]);

  async function start() {
    if (memberMode && !token) { setMessage('Sign in as a family member first.'); return; }
    setBusy(true); setMessage('');
    const { data, error } = await supabase.rpc('start_daily_quest', { p_session_token: token });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    const attempt = Array.isArray(data) ? data[0] : data;
    if (!attempt?.attempt_id) { setMessage('Unable to start today’s quest.'); return; }
    setStatus((current) => current ? { ...current, attempt_id: attempt.attempt_id, questions_answered: attempt.questions_answered, score: attempt.score, status: attempt.status } : current);
    if (attempt.status === 'completed') { setFinished(true); return; }
    await loadQuestion(attempt.attempt_id, token);
  }

  async function submit(answer: string, timedOut = false) {
    if (!question || !status?.attempt_id || result || lock.current) return;
    lock.current = true; setBusy(true); setMessage('');
    const elapsedMs = timedOut ? question.time_per_question * 1000 : Math.max(0, Date.now() - startedAt.current);
    const { data, error } = await supabase.rpc('submit_daily_quest_answer', {
      p_attempt_id: status.attempt_id, p_question_id: question.id, p_selected_answer: answer || null,
      p_response_time_ms: elapsedMs, p_session_token: token,
    });
    setBusy(false);
    if (error) { lock.current = false; setMessage(error.message); return; }
    setResult(data as Result);
    setStatus((current) => current ? { ...current, questions_answered: data.questions_answered, correct_answers: data.correct_answers, score: current.score + data.xp_earned, status: data.completed ? 'completed' : 'in_progress', daily_streak: data.daily_streak ?? current.daily_streak } : current);
    if (data.completed) setFinished(true);
  }

  useEffect(() => {
    if (!question || result || busy) return;
    const interval = setInterval(() => setRemaining((current) => {
      if (current <= 1) { void submit('', true); return 0; }
      return current - 1;
    }), 1000);
    return () => clearInterval(interval);
  }, [question, result, busy]);

  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.teal} /></View>;
  if (memberMode && !token) return <Redirect href="/family-member-sign-in" />;
  if (!memberMode && !status && message.includes('Sign in')) return <Redirect href="/sign-in" />;
  const options = question ? [question.option_a, question.option_b, question.option_c, question.option_d] : [];
  return <Screen>
    <Button title={memberMode ? '← Family dashboard' : '← Dashboard'} secondary onPress={() => router.replace(memberMode ? '/family-member-home' : '/(tabs)')} />
    <Heading title="A fresh challenge. Every day. 🌟" subtitle={status?.description || 'Test your knowledge, earn XP, and keep your daily learning streak alive.'} />
    <Notice message={message} />
    {question ? <>
      <View style={styles.meta}><Text style={styles.metaText}>QUESTION {question.question_number} / {question.total_questions}</Text><Text style={[styles.timer, remaining <= 5 && styles.urgent]}>{remaining}s</Text></View>
      <View style={styles.track}><View style={[styles.fill, { width: `${remaining / question.time_per_question * 100}%` }]} /></View>
      <Card><Text style={styles.question}>{question.question}</Text></Card>
      {!result ? options.map((option, index) => <Pressable key={`${question.id}-${index}`} disabled={busy || !option} onPress={() => void submit(option)} style={styles.option}><Text style={styles.letter}>{String.fromCharCode(65 + index)}</Text><Text style={styles.optionText}>{option}</Text></Pressable>) : null}
      {result ? <Card style={result.is_correct ? styles.correct : styles.incorrect}><Text style={styles.resultTitle}>{result.is_correct ? `Correct! +${result.xp_earned} XP` : 'Keep learning'}</Text><Text style={uiStyles.smallMuted}>Correct answer: {result.correct_answer}</Text>{result.completed ? <Text style={uiStyles.smallMuted}>Daily Quest complete · 🔥 {result.daily_streak ?? result.current_streak} day streak</Text> : <Button title="Next question →" onPress={() => void loadQuestion(status!.attempt_id!, token)} />}</Card> : null}
    </> : finished ? <Card style={styles.correct}><Text style={styles.resultTitle}>Daily Quest complete! ✨</Text><Text style={uiStyles.smallMuted}>You answered {status?.questions_answered || status?.question_count || 0} questions and earned {status?.score || 0} XP.</Text></Card> : <Card><Text style={styles.resultTitle}>{status?.title || 'Your Daily Quest Awaits'}</Text><Text style={uiStyles.smallMuted}>{status?.status === 'in_progress' ? 'Continue the quest you started earlier.' : `${status?.question_count || 10} questions · ${status?.time_per_question || 15}s each`}</Text><Button title={busy ? 'Starting…' : status?.status === 'in_progress' ? 'Continue quest →' : 'Start today’s quest →'} onPress={() => void start()} disabled={busy} /></Card>}
  </Screen>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaText: { color: colors.muted, fontSize: 11, fontWeight: '900' },
  timer: { color: colors.teal, fontSize: 17, fontWeight: '900' },
  urgent: { color: colors.danger },
  track: { height: 6, backgroundColor: colors.border, borderRadius: 5, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.teal },
  question: { color: colors.ink, fontSize: 21, lineHeight: 30, fontWeight: '800' },
  option: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff' },
  letter: { width: 30, height: 30, lineHeight: 30, borderRadius: 10, overflow: 'hidden', textAlign: 'center', color: colors.teal, backgroundColor: colors.mint, fontWeight: '900' },
  optionText: { flex: 1, color: colors.ink, fontSize: 14 },
  correct: { backgroundColor: '#EBF8F0', borderColor: '#B4DEC9' },
  incorrect: { backgroundColor: colors.dangerBg, borderColor: '#F2C7C4' },
  resultTitle: { color: colors.ink, fontSize: 20, fontWeight: '900' },
});

import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { getStudentSession } from '@/lib/secure-sessions';
import { colors } from '@/lib/theme';

type QuestSession = { id: string };
type QuestQuestion = { id: string; question: string; question_type?: string; option_a?: string | null; option_b?: string | null; option_c?: string | null; option_d?: string | null };
type QuestionResponse = { success: boolean; question?: QuestQuestion; question_number?: number; total_questions?: number; question_deadline_at?: string; time_per_question?: number; question_started_at?: string; server_now_at?: string; message?: string };
type AnswerResponse = { success?: boolean; message?: string; is_correct?: boolean; timed_out?: boolean; correct_answer?: string; xp_earned?: number; level_completed?: boolean; level_passed?: boolean };

export default function StudentQuestScreen() {
  const [token, setToken] = useState<string | null>(null);
  const [session, setSession] = useState<QuestSession | null>(null);
  const [data, setData] = useState<QuestionResponse | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [result, setResult] = useState<AnswerResponse | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState(30);
  const serverClockOffset = useRef(0);
  const submitting = useRef(false);

  const loadQuestion = useCallback(async (activeToken: string, sessionId: string) => {
    setBusy(true); setMessage(''); setResult(null); setAnswer(null); submitting.current = false;
    try {
      const requestStartedAt = Date.now();
      const next = await apiRequest<QuestionResponse>('/api/schools/student-quest/question', { method: 'POST', token: activeToken, body: JSON.stringify({ session_id: sessionId }) });
      if (!next.success || !next.question) throw new Error(next.message || 'No question was returned.');
      const responseReceivedAt = Date.now();
      const serverNow = next.server_now_at ? new Date(next.server_now_at).getTime() : responseReceivedAt;
      serverClockOffset.current = Number.isFinite(serverNow) ? serverNow - (requestStartedAt + responseReceivedAt) / 2 : 0;
      const duration = Number(next.time_per_question) > 0 ? Number(next.time_per_question) : 30;
      const deadline = next.question_deadline_at || new Date(new Date(next.question_started_at || Date.now()).getTime() + duration * 1000).toISOString();
      setData(next);
      setRemaining(Math.max(0, Math.ceil((new Date(deadline).getTime() - (Date.now() + serverClockOffset.current)) / 1000)));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load the next question.'); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const saved = await getStudentSession();
      if (!saved) { if (active) { setToken(null); setLoading(false); } return; }
      try {
        const started = await apiRequest<{ success: boolean; session: QuestSession; message?: string }>('/api/schools/student-quest/start', { method: 'POST', token: saved.token, body: JSON.stringify({}) });
        if (!started.success || !started.session?.id) throw new Error(started.message || 'Unable to start your quest.');
        if (active) { setToken(saved.token); setSession(started.session); }
        await loadQuestion(saved.token, started.session.id);
      } catch (error) { if (active) setMessage(error instanceof Error ? error.message : 'Unable to start your quest.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [loadQuestion]);

  async function submit(selected: string) {
    if (!token || !session || !data?.question || busy || submitting.current) return;
    submitting.current = true;
    setAnswer(selected); setBusy(true); setMessage('');
    try {
      const clickedAt = new Date().toISOString();
      const response = await apiRequest<AnswerResponse>('/api/schools/student-quest/answer', {
        method: 'POST', token,
        body: JSON.stringify({ session_id: session.id, question_id: data.question.id, selected_answer: selected, client_clicked_at: clickedAt, client_clock_offset_ms: serverClockOffset.current }),
      });
      if (response.success === false) throw new Error(response.message || 'Your answer could not be submitted.');
      setResult(response);
    } catch (error) { submitting.current = false; setAnswer(null); setMessage(error instanceof Error ? error.message : 'Your answer could not be submitted.'); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (!data?.question || result || busy) return;
    const duration = Number(data.time_per_question) > 0 ? Number(data.time_per_question) : 30;
    const deadline = data.question_deadline_at || new Date(new Date(data.question_started_at || Date.now()).getTime() + duration * 1000).toISOString();
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((new Date(deadline).getTime() - (Date.now() + serverClockOffset.current)) / 1000));
      setRemaining(seconds);
      if (seconds === 0) void submit('');
    };
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [data, result, busy]);

  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.teal} /><Text style={uiStyles.smallMuted}>Preparing your quest…</Text></View>;
  if (!token) return <Redirect href="/student-sign-in" />;
  const question = data?.question;
  const options = question ? [question.option_a, question.option_b, question.option_c, question.option_d].filter((value): value is string => Boolean(value?.trim())) : [];
  return <Screen>
    <Button title="← Student dashboard" secondary onPress={() => router.replace('/student-home')} />
    <Heading title="Test your knowledge" subtitle="Choose the best answer before the timer runs out." />
    <Notice message={message} />
    {question ? <>
      <View style={styles.metaRow}><Text style={styles.meta}>Question {data?.question_number || 1} / {data?.total_questions || 50}</Text><Text style={[styles.timer, remaining <= 5 && styles.urgent]}>{remaining}s</Text></View>
      <Card><Text style={styles.question}>{question.question}</Text></Card>
      {question.question_type !== 'fill_blank' ? options.map((option, index) => <Button key={`${question.id}-${index}`} title={`${String.fromCharCode(65 + index)}.  ${option}`} secondary onPress={() => void submit(option)} disabled={busy || Boolean(result)} />) : null}
      {!result && question.question_type === 'fill_blank' ? <><TextInput value={answer || ''} onChangeText={setAnswer} placeholder="Type your answer" style={styles.answer} editable={!busy} /><Button title="Submit answer" onPress={() => void submit(answer || '')} disabled={busy || !answer?.trim()} /></> : null}
      {result ? <Card style={result.is_correct ? styles.result : styles.incorrect}><Text style={styles.resultTitle}>{result.timed_out ? "Time's up" : result.is_correct ? `MashaAllah! +${result.xp_earned || 0} XP` : 'Not quite — keep learning.'}</Text><Text style={uiStyles.smallMuted}>Correct answer: {result.correct_answer || 'Ask your teacher to review the result.'}</Text><Button title="Next question →" onPress={() => void loadQuestion(token, session!.id)} /></Card> : null}
      {busy ? <Text style={uiStyles.smallMuted}>{answer ? 'Submitting your answer…' : 'Loading…'}</Text> : null}
    </> : !message ? <Card><Text style={styles.question}>There are no more questions available in this quest session.</Text></Card> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: colors.background },
  meta: { color: colors.teal, fontSize: 13, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timer: { color: colors.teal, fontSize: 17, fontWeight: '900' },
  urgent: { color: colors.danger },
  question: { color: colors.ink, fontSize: 22, lineHeight: 31, fontWeight: '800' },
  result: { backgroundColor: '#EBF8F0', borderColor: '#B4DEC9' },
  incorrect: { backgroundColor: colors.dangerBg, borderColor: '#F2C7C4' },
  resultTitle: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  answer: { minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, color: colors.ink, backgroundColor: '#fff' },
});

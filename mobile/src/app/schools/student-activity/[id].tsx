import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { getStudentSession } from '@/lib/secure-sessions';
import { colors } from '@/lib/theme';

type Activity = { id: string; title: string; instructions: string | null; activity_type: string; due_at: string | null; time_limit_minutes: number | null };
type Question = { id: string; question_text: string; option_a: string | null; option_b: string | null; option_c: string | null; option_d: string | null; points?: number };
type Attempt = { score: number; max_score: number; correct_count: number; total_questions: number; submitted_at: string; timed_out: boolean };
type Payload = { success: boolean; activity: Activity; questions?: Question[]; alreadySubmitted?: boolean; result?: Attempt; savedAnswers?: Record<string, string>; startedAt?: string | null; deadlineAt?: string | null; message?: string };

export default function StudentActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [token, setToken] = useState<string | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [deadlineAt, setDeadlineAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const session = await getStudentSession();
    if (!session) { setLoading(false); return; }
    setToken(session.token);
    try {
      const payload = await apiRequest<Payload>(`/api/schools/student-activities/${encodeURIComponent(id)}`, { token: session.token });
      setActivity(payload.activity);
      setQuestions(payload.questions || []);
      setAnswers(payload.savedAnswers || {});
      setStartedAt(payload.startedAt || null);
      setDeadlineAt(payload.deadlineAt || null);
      if (payload.alreadySubmitted) setAttempt(payload.result || null);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'This activity could not be loaded.'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function start() {
    if (!token) return;
    setBusy(true); setMessage('');
    try {
      const response = await apiRequest<{ success: boolean; startedAt: string; deadlineAt: string | null; message?: string }>(`/api/schools/student-activities/${encodeURIComponent(id)}`, { method: 'POST', token, body: JSON.stringify({ action: 'start' }) });
      setStartedAt(response.startedAt); setDeadlineAt(response.deadlineAt);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to start this activity.'); }
    finally { setBusy(false); }
  }

  async function submit() {
    if (!token) return;
    setBusy(true); setMessage('');
    try {
      const response = await apiRequest<{ success: boolean; result: Attempt; message?: string }>(`/api/schools/student-activities/${encodeURIComponent(id)}`, { method: 'POST', token, body: JSON.stringify({ answers }) });
      setAttempt(response.result);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to submit this activity.'); }
    finally { setBusy(false); }
  }

  async function saveDraft(nextAnswers: Record<string, string>) {
    if (!token || !startedAt) return;
    try {
      await apiRequest(`/api/schools/student-activities/${encodeURIComponent(id)}`, { method: 'POST', token, body: JSON.stringify({ action: 'save_answers', answers: nextAnswers }) });
    } catch { /* The screen keeps local selections and reports errors on final submission. */ }
  }

  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.teal} /></View>;
  if (!token) return <Redirect href="/student-sign-in" />;
  return <Screen>
    <Button title="← Student dashboard" secondary onPress={() => router.replace('/student-home')} />
    <Heading title={activity?.title || 'School activity'} subtitle={activity?.instructions || 'Complete the activity assigned to your class.'} />
    <Notice message={message} />
    {attempt ? <Card style={styles.result}><Text style={styles.resultTitle}>Activity submitted</Text><Text style={uiStyles.statValue}>{attempt.score} / {attempt.max_score}</Text><Text style={uiStyles.smallMuted}>{attempt.correct_count} correct of {attempt.total_questions}{attempt.timed_out ? ' · time ended' : ''}</Text></Card> : null}
    {!attempt && activity && questions.length && !startedAt ? <Card><Text style={styles.title}>{activity.activity_type.toUpperCase()}</Text><Text style={uiStyles.smallMuted}>{questions.length} questions{activity.time_limit_minutes ? ` · ${activity.time_limit_minutes} minutes` : ''}</Text><Button title="Start activity →" onPress={() => void start()} disabled={busy} /></Card> : null}
    {!attempt && startedAt ? <>
      {deadlineAt ? <Text style={styles.deadline}>⏱ Deadline {new Date(deadlineAt).toLocaleTimeString()}</Text> : null}
      {questions.map((question, index) => <Card key={question.id}>
        <Text style={styles.questionNumber}>QUESTION {index + 1} OF {questions.length}</Text>
        <Text style={styles.question}>{question.question_text}</Text>
        {(['A', 'B', 'C', 'D'] as const).map((letter) => {
          const value = question[`option_${letter.toLowerCase()}` as 'option_a' | 'option_b' | 'option_c' | 'option_d'];
          if (!value) return null;
          const selected = answers[question.id] === letter;
          return <Pressable key={letter} onPress={() => {
            const updated = { ...answers, [question.id]: letter };
            setAnswers(updated); void saveDraft(updated);
          }} style={[styles.option, selected && styles.optionSelected]}>
            <Text style={[styles.optionLetter, selected && styles.selectedLetter]}>{letter}</Text><Text style={styles.optionText}>{value}</Text>
          </Pressable>;
        })}
      </Card>)}
      <Button title={busy ? 'Submitting…' : 'Submit activity'} onPress={() => void submit()} disabled={busy || Object.keys(answers).length < questions.length} />
    </> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  title: { color: colors.teal, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  questionNumber: { color: colors.teal, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  question: { color: colors.ink, fontSize: 19, lineHeight: 27, fontWeight: '800' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 51, padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  optionSelected: { borderColor: colors.teal, backgroundColor: colors.mint },
  optionLetter: { width: 29, height: 29, lineHeight: 29, borderRadius: 10, overflow: 'hidden', textAlign: 'center', backgroundColor: colors.mint, color: colors.teal, fontWeight: '900' },
  selectedLetter: { backgroundColor: colors.teal, color: '#fff' },
  optionText: { flex: 1, color: colors.ink, fontSize: 14 },
  deadline: { color: colors.teal, fontWeight: '800' },
  result: { backgroundColor: '#EBF8F0', borderColor: '#B4DEC9', alignItems: 'center' },
  resultTitle: { color: colors.ink, fontSize: 21, fontWeight: '900' },
});

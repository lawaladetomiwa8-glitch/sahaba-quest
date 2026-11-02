import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Question = { id: string; question_number: number; question_text: string; option_a: string; option_b: string; option_c: string; option_d: string; time_limit_seconds: number; remaining_ms: number; base_xp: number };
type Result = { completed?: boolean; expired?: boolean; total_xp?: number; correct?: boolean; correct_answers?: number; total_questions?: number; message?: string };
const options = ['a', 'b', 'c', 'd'] as const;
export default function SponsoredCompetitionPlayScreen() {
  const { id, attempt } = useLocalSearchParams<{ id: string; attempt?: string }>();
  const [attemptId, setAttemptId] = useState(attempt || '');
  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<typeof options[number] | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [xp, setXp] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState('');
  const submitted = useRef(false);
  const loadQuestion = useCallback(async (key: string) => {
    const response = await supabase.rpc('get_sponsored_current_question', { p_attempt_id: key });
    if (response.error) throw response.error;
    const raw = Array.isArray(response.data) ? response.data[0] : response.data;
    if (!raw) throw new Error('No active question was returned. The attempt may be complete or expired.');
    setQuestion(raw as Question); setRemaining(Number(raw.remaining_ms ?? raw.time_limit_seconds * 1000)); setSelected(null); setResult(null); submitted.current = false;
  }, []);
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/sign-in'); return; }
      let key = attemptId;
      if (!key) {
        const started = await supabase.rpc('start_sponsored_competition', { p_competition_id: id });
        if (started.error) throw started.error;
        key = started.data?.attempt_id || '';
      }
      if (!key) throw new Error('Unable to start the competition.');
      if (active) setAttemptId(key);
      await loadQuestion(key);
      if (active) setLoading(false);
    })().catch((error) => { if (active) { setMessage(error instanceof Error ? error.message : 'Unable to load competition.'); setLoading(false); } });
    return () => { active = false; };
  }, [attemptId, id, loadQuestion]);
  useEffect(() => {
    if (!question || done || busy || remaining <= 0) return;
    const started = Date.now();
    const initial = remaining;
    const timer = setInterval(() => setRemaining(Math.max(0, initial - (Date.now() - started))), 100);
    return () => clearInterval(timer);
  }, [question?.id]);
  const submit = useCallback(async (answer: typeof options[number] | null) => {
    if (!attemptId || !question || submitted.current || busy) return;
    submitted.current = true; setBusy(true); setMessage('');
    try {
      const response = await supabase.rpc('submit_sponsored_answer', { p_attempt_id: attemptId, p_question_id: question.id, p_selected_option: answer });
      if (response.error) throw response.error;
      const data = (response.data || {}) as Result;
      setResult(data); if (typeof data.total_xp === 'number') setXp(data.total_xp);
      if (data.completed || data.expired) { setDone(true); setQuestion(null); }
      else await loadQuestion(attemptId);
    } catch (error) { submitted.current = false; setMessage(error instanceof Error ? error.message : 'Your answer could not be submitted.'); }
    finally { setBusy(false); }
  }, [attemptId, busy, loadQuestion, question]);
  useEffect(() => { if (question && remaining === 0 && !busy) void submit(null); }, [question, remaining, busy, submit]);
  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.teal} /></View>;
  if (done) return <Screen><Card style={styles.center}><Text style={styles.trophy}>🏆</Text><Heading title="Competition complete" subtitle="Your attempt has been recorded. Sponsored XP is separate from your normal Sahaba Quest XP." /><Text style={styles.xp}>{xp} Sponsored XP</Text>{result?.expired && <Notice message="Your attempt expired." type="warning" />}<Button title="View leaderboard" onPress={() => router.replace('/sponsored-leaderboard/' + id)} /><Button title="Back to competitions" secondary onPress={() => router.replace('/sponsored')} /></Card></Screen>;
  if (!question) return <Screen><Notice message={message || 'Question unavailable.'} /><Button title="Competition details" onPress={() => router.replace('/sponsored-competition/' + id)} /></Screen>;
  const questionOptions = [question.option_a, question.option_b, question.option_c, question.option_d];
  return <Screen>
    <Button title="Leave competition" secondary onPress={() => router.replace('/sponsored-competition/' + id)} />
    <Heading title="Sponsored competition" subtitle={'Question ' + question.question_number + ' · ' + Math.ceil(remaining / 1000) + 's remaining'} />
    <View style={styles.track}><View style={[styles.progress, { width: Math.max(0, Math.min(100, remaining / Math.max(1, question.time_limit_seconds * 10))) + '%' }]} /></View>
    <Card><Text style={styles.question}>{question.question_text}</Text>{questionOptions.map((answer, index) => <Text key={options[index]} onPress={() => !busy && setSelected(options[index])} style={[styles.option, selected === options[index] && styles.selected]}>{options[index].toUpperCase()}   {answer}</Text>)}<Notice message={message} />{result && <Notice message={result.correct ? 'Correct answer.' : 'Answer recorded.'} success={Boolean(result.correct)} />}<Button title={busy ? 'Submitting…' : 'Submit answer'} disabled={busy || !selected} onPress={() => void submit(selected)} /></Card>
    <Text style={uiStyles.smallMuted}>XP earned in this competition is reported separately from your regular progress.</Text>
  </Screen>;
}
const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }, center: { alignItems: 'center' }, trophy: { fontSize: 48 }, xp: { fontSize: 24, color: colors.teal, fontWeight: '900' }, track: { height: 7, borderRadius: 6, backgroundColor: colors.border, overflow: 'hidden' }, progress: { height: 7, backgroundColor: colors.teal }, question: { fontSize: 20, lineHeight: 28, color: colors.ink, fontWeight: '800' }, option: { padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 12, color: colors.ink }, selected: { backgroundColor: colors.mint, borderColor: colors.teal }, });

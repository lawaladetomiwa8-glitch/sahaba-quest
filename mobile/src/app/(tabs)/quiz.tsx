import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type AccountType = 'free' | 'individual' | 'family';
type Question = {
  id: string; level: number; question: string; option_a: string | null; option_b: string | null;
  option_c: string | null; option_d: string | null; explanation: string | null;
  question_type: 'multiple_choice' | 'fill_blank';
};
type Result = {
  is_correct: boolean; timed_out: boolean; correct_answer: string; question_type: 'multiple_choice' | 'fill_blank';
  xp_earned: number; current_streak: number; best_streak: number; level_completed: boolean;
  level_passed: boolean; current_level: number; questions_answered_in_level: number;
  correct_answers_in_attempt: number; questions_required: number; correct_required_to_pass: number;
};
type Session = { id: string; level: number; current_question_id: string | null; current_question_started_at: string | null };

export default function QuizTab() {
  const [question, setQuestion] = useState<Question | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<AccountType>('free');
  const [level, setLevel] = useState(1);
  const [questionCount, setQuestionCount] = useState(0);
  const [remaining, setRemaining] = useState(30);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const submissionLock = useRef(false);

  const loadNext = useCallback(async (userId: string, activeSessionId: string) => {
    setMessage('');
    setQuestion(null);
    setResult(null);
    setTypedAnswer('');
    submissionLock.current = false;
    const { data, error } = await supabase.rpc('get_next_quiz_question', {
      p_user_id: userId,
      p_session_id: activeSessionId,
    });
    if (error) { setMessage(error.message); return; }
    if (!data?.length) { setMessage('You have answered all available questions for this game.'); return; }
    const next = data[0] as Question;
    const choices = [next.option_a, next.option_b, next.option_c, next.option_d]
      .filter((value): value is string => Boolean(value?.trim()));
    for (let index = choices.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [choices[index], choices[swap]] = [choices[swap], choices[index]];
    }
    const at = new Date();
    const { error: updateError } = await supabase.from('game_sessions').update({
      current_question_id: next.id,
      current_question_started_at: at.toISOString(),
    }).eq('id', activeSessionId).eq('user_id', userId).eq('status', 'in_progress');
    if (updateError) { setMessage(updateError.message); return; }
    setQuestion(next);
    setOptions(choices);
    setLevel(next.level);
    setStartedAt(at.getTime());
    setRemaining(30);
  }, []);

  const startGame = useCallback(async () => {
    setLoading(true);
    setMessage('');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) { setMessage('Sign in again to play.'); setLoading(false); return; }
    const { data: profile, error: profileError } = await supabase.from('profiles').select('account_type').eq('id', user.id).single();
    if (profileError) { setMessage(profileError.message); setLoading(false); return; }
    const type = profile.account_type as AccountType;
    setAccountType(type);
    if (type === 'family') { setMessage('Family accounts play in the Family Quest area on the Sahaba Quest website.'); setLoading(false); return; }

    const { data: active } = await supabase.from('game_sessions')
      .select('id, level, current_question_id, current_question_started_at')
      .eq('user_id', user.id).eq('status', 'in_progress').order('created_at', { ascending: false }).limit(1).maybeSingle();

    if (active) {
      if (type === 'free' && active.level > 4) {
        setMessage('Free accounts can play through level 4. Upgrade your account on the website to continue.');
        setLoading(false);
        return;
      }
      setSessionId(active.id);
      setLevel(active.level);
      const { count } = await supabase.from('question_attempts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('session_id', active.id);
      setQuestionCount(count || 0);
      if (active.current_question_id) {
        const { data: saved } = await supabase.from('questions')
          .select('id, level, question, option_a, option_b, option_c, option_d, explanation, question_type')
          .eq('id', active.current_question_id).eq('is_published', true).maybeSingle();
        if (saved) {
          const choices = [saved.option_a, saved.option_b, saved.option_c, saved.option_d].filter((v): v is string => Boolean(v?.trim()));
          for (let i = choices.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [choices[i], choices[j]] = [choices[j], choices[i]]; }
          const start = active.current_question_started_at ? new Date(active.current_question_started_at).getTime() : Date.now();
          setQuestion(saved as Question);
          setOptions(choices);
          setStartedAt(start);
          setRemaining(Math.max(0, 30 - Math.floor((Date.now() - start) / 1000)));
          setLoading(false);
          return;
        }
      }
      await loadNext(user.id, active.id);
      setLoading(false);
      return;
    }

    const { data: progress, error: progressError } = await supabase.from('player_progress').select('current_level').eq('user_id', user.id).single();
    if (progressError) { setMessage(progressError.message); setLoading(false); return; }
    const currentLevel = progress.current_level;
    if (type === 'free' && currentLevel > 4) {
      setMessage('Free accounts can play through level 4. Upgrade your account on the website to continue.');
      setLoading(false);
      return;
    }
    const { data: session, error: sessionError } = await supabase.from('game_sessions')
      .insert({ user_id: user.id, level: currentLevel, status: 'in_progress' }).select('id, level').single();
    if (sessionError) { setMessage(sessionError.message); setLoading(false); return; }
    setSessionId(session.id);
    setLevel(session.level);
    await loadNext(user.id, session.id);
    setLoading(false);
  }, [loadNext]);

  useEffect(() => { void startGame(); }, [startGame]);

  async function submitAnswer(answer: string | null) {
    if (!question || !sessionId || !startedAt || submissionLock.current) return;
    submissionLock.current = true;
    setBusy(true);
    const { data, error } = await supabase.rpc('submit_quiz_answer', {
      p_session_id: sessionId,
      p_question_id: question.id,
      p_selected_answer: answer?.trim().replace(/\s+/g, ' ') || null,
      p_response_time_ms: Math.min(Math.max(Date.now() - startedAt, 0), 30000),
    });
    setBusy(false);
    if (error) { setMessage(error.message); submissionLock.current = false; return; }
    const raw = Array.isArray(data) ? data[0] : data;
    if (!raw) { setMessage('The quiz server returned no answer result.'); submissionLock.current = false; return; }
    setResult(raw as Result);
    setQuestionCount((count) => count + 1);
  }

  useEffect(() => {
    if (!question || result || loading || busy || !startedAt) return;
    const timer = setInterval(() => {
      const seconds = Math.max(0, 30 - Math.floor((Date.now() - startedAt) / 1000));
      setRemaining(seconds);
      if (seconds === 0) void submitAnswer(null);
    }, 250);
    return () => clearInterval(timer);
  }, [question, result, loading, busy, startedAt, remaining]);

  async function nextQuestion() {
    setResult(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (questionCount >= 50) {
      if (sessionId) await supabase.from('game_sessions').update({ status: 'completed', completed_at: new Date().toISOString(), current_question_id: null, current_question_started_at: null }).eq('id', sessionId);
      setSessionId(null);
      setQuestionCount(0);
      await startGame();
      return;
    }
    if (user && sessionId) await loadNext(user.id, sessionId);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.teal} /><Text style={uiStyles.smallMuted}>Loading your quest…</Text></View>;

  return <Screen>
    <Heading title="Quiz time" subtitle="Answer carefully. Each question has a 30-second timer." />
    <Notice message={message} />
    {question ? <>
      <View style={styles.meta}><Text style={styles.metaText}>LEVEL {level}</Text><Text style={styles.metaText}>{Math.min(questionCount + 1, 50)} / 50</Text><Text style={[styles.timer, remaining <= 5 && styles.timerUrgent]}>{remaining}s</Text></View>
      <View style={styles.track}><View style={[styles.progressBar, { width: `${(remaining / 30) * 100}%` }]} /></View>
      <Card style={styles.questionCard}><Text style={styles.questionText}>{question.question}</Text></Card>
      {!result && question.question_type === 'fill_blank' ? <>
        <TextInput value={typedAnswer} onChangeText={setTypedAnswer} placeholder="Type your answer" placeholderTextColor={colors.muted} style={styles.answerInput} editable={!busy} />
        <Button title="Submit answer" onPress={() => void submitAnswer(typedAnswer)} disabled={busy || !typedAnswer.trim()} />
      </> : null}
      {!result && question.question_type === 'multiple_choice' ? <View style={styles.choices}>{options.map((option, index) => <Pressable key={`${question.id}-${index}`} disabled={busy} onPress={() => void submitAnswer(option)} style={({ pressed }) => [styles.choice, pressed && styles.pressed]}><Text style={styles.choiceLetter}>{String.fromCharCode(65 + index)}</Text><Text style={styles.choiceText}>{option}</Text></Pressable>)}</View> : null}
      {busy ? <Text style={uiStyles.smallMuted}>Checking your answer…</Text> : null}
      {result ? <>
        <Card style={result.is_correct ? styles.correctCard : styles.wrongCard}>
          <Text style={styles.resultTitle}>{result.timed_out ? "Time's up" : result.is_correct ? 'Correct!' : 'Not quite'}</Text>
          <Text style={styles.resultText}>Correct answer: {result.correct_answer}</Text>
          {question.explanation ? <Text style={styles.resultText}>{question.explanation}</Text> : null}
          <Text style={styles.resultText}>+{result.xp_earned} XP · streak {result.current_streak}</Text>
        </Card>
        <Button title={result.level_completed ? 'Continue' : 'Next question'} onPress={() => void nextQuestion()} />
      </> : null}
    </> : null}
    {!question && !loading && !message ? <Button title="Start another game" onPress={() => void startGame()} /> : null}
    <Text style={styles.accountNote}>Playing as a {accountType} account</Text>
  </Screen>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.background },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaText: { color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  timer: { color: colors.teal, fontSize: 17, fontWeight: '900' },
  timerUrgent: { color: colors.danger },
  track: { height: 6, borderRadius: 5, overflow: 'hidden', backgroundColor: colors.border },
  progressBar: { height: 6, backgroundColor: colors.teal },
  questionCard: { paddingVertical: 25, minHeight: 150, justifyContent: 'center' },
  questionText: { color: colors.ink, fontSize: 21, lineHeight: 30, fontWeight: '800' },
  choices: { gap: 10 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  pressed: { backgroundColor: colors.mint },
  choiceLetter: { width: 31, height: 31, lineHeight: 31, borderRadius: 16, overflow: 'hidden', textAlign: 'center', color: colors.teal, backgroundColor: colors.mint, fontWeight: '900' },
  choiceText: { flex: 1, color: colors.ink, fontSize: 15, lineHeight: 22 },
  answerInput: { minHeight: 54, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14, color: colors.ink, fontSize: 16 },
  correctCard: { borderColor: '#B4DEC9', backgroundColor: '#EBF8F0' },
  wrongCard: { borderColor: '#F2C7C4', backgroundColor: colors.dangerBg },
  resultTitle: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  resultText: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  accountNote: { color: colors.muted, fontSize: 12, textAlign: 'center' },
});

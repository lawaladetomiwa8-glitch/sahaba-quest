import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, Field, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Question = { id: string; question_text: string; status: string; topic?: string | null; difficulty?: string };
type SchoolClass = { id: string; class_name: string; academic_session: string; status: string };
type Activity = { id: string; title: string; status: string; activity_type: string; due_at: string | null; question_count?: number };
type LearningData = { questions: Question[]; classes: SchoolClass[]; activities: Activity[] };

export default function SchoolLearningScreen() {
  const [data, setData] = useState<LearningData>({ questions: [], classes: [], activities: [] });
  const [question, setQuestion] = useState({ question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', explanation: '', topic: '' });
  const [correct, setCorrect] = useState('A');
  const [activity, setActivity] = useState({ title: '', instructions: '', activity_type: 'classwork', time_limit_minutes: '' });
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sign in as a school administrator to manage learning content.');
      const result = await apiRequest<LearningData>('/api/schools/questions', { token: session.access_token });
      setData({ questions: result.questions || [], classes: result.classes || [], activities: result.activities || [] });
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load school learning content.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function createQuestion() {
    setBusy(true); setMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Your administrator session has expired.');
      await apiRequest('/api/schools/questions', { method: 'POST', token: session.access_token, body: JSON.stringify({ action: 'question', ...question, correct_option: correct, difficulty: 'medium', status: 'published' }) });
      setQuestion({ question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', explanation: '', topic: '' });
      setMessage('Question published to your school question library.'); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save question.'); }
    finally { setBusy(false); }
  }

  async function createActivity() {
    setBusy(true); setMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Your administrator session has expired.');
      await apiRequest('/api/schools/questions', { method: 'POST', token: session.access_token, body: JSON.stringify({ action: 'activity', ...activity, status: 'published', due_at: null, time_limit_minutes: activity.time_limit_minutes ? Number(activity.time_limit_minutes) : null, class_ids: selectedClasses, question_ids: selectedQuestions }) });
      setActivity({ title: '', instructions: '', activity_type: 'classwork', time_limit_minutes: '' }); setSelectedClasses([]); setSelectedQuestions([]);
      setMessage('Activity published and assigned to the selected classes.'); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to publish activity.'); }
    finally { setBusy(false); }
  }

  async function archiveQuestion(item: Question) {
    Alert.alert('Archive question?', 'Archived questions will no longer be available for new activities. Existing student results remain subject to the website rules.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', style: 'destructive', onPress: () => void (async () => {
        setBusy(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error('Your administrator session has expired.');
          await apiRequest(`/api/schools/questions?id=${encodeURIComponent(item.id)}`, { method: 'DELETE', token: session.access_token });
          await load();
        } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to archive question.'); }
        finally { setBusy(false); }
      })() },
    ]);
  }

  function toggle(list: string[], setList: (next: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  return <Screen><Heading title="Questions and activities" subtitle="Create school questions and assign published questions to classes through the existing school learning API." /><Notice message={message} success={message.includes('published')} />{loading ? <ActivityIndicator color={colors.teal} /> : <>
    <Card><Text style={styles.title}>Question library · {data.questions.length}</Text>{data.questions.map((item) => <View key={item.id} style={styles.listItem}><View style={styles.grow}><Text style={styles.name}>{item.question_text}</Text><Text style={uiStyles.smallMuted}>{item.topic || 'General'} · {item.difficulty || '—'} · {item.status}</Text></View>{item.status === 'published' ? <Button title="Archive" secondary disabled={busy} onPress={() => archiveQuestion(item)} /> : null}</View>)}</Card>
    <Card><Text style={styles.title}>Create a question</Text><Field label="Question" value={question.question_text} onChangeText={(v) => setQuestion({ ...question, question_text: v })} multiline /><Field label="Option A" value={question.option_a} onChangeText={(v) => setQuestion({ ...question, option_a: v })} /><Field label="Option B" value={question.option_b} onChangeText={(v) => setQuestion({ ...question, option_b: v })} /><Field label="Option C" value={question.option_c} onChangeText={(v) => setQuestion({ ...question, option_c: v })} /><Field label="Option D" value={question.option_d} onChangeText={(v) => setQuestion({ ...question, option_d: v })} /><Text style={styles.label}>Correct option</Text><View style={styles.options}>{['A', 'B', 'C', 'D'].map((item) => <Button key={item} title={item} secondary={correct !== item} onPress={() => setCorrect(item)} />)}</View><Field label="Topic (optional)" value={question.topic} onChangeText={(v) => setQuestion({ ...question, topic: v })} /><Field label="Explanation (optional)" value={question.explanation} onChangeText={(v) => setQuestion({ ...question, explanation: v })} multiline /><Button title={busy ? 'Saving…' : 'Publish question'} disabled={busy || !question.question_text.trim() || !question.option_a.trim() || !question.option_b.trim() || !question.option_c.trim() || !question.option_d.trim()} onPress={() => void createQuestion()} /></Card>
    <Card><Text style={styles.title}>Assigned activities · {data.activities.length}</Text>{data.activities.map((item) => <View key={item.id} style={styles.listItem}><View style={styles.grow}><Text style={styles.name}>{item.title}</Text><Text style={uiStyles.smallMuted}>{item.activity_type} · {item.status} · {item.question_count ?? 0} questions</Text></View></View>)}</Card>
    <Card><Text style={styles.title}>Publish an activity</Text><Field label="Activity title" value={activity.title} onChangeText={(v) => setActivity({ ...activity, title: v })} /><Field label="Instructions" value={activity.instructions} onChangeText={(v) => setActivity({ ...activity, instructions: v })} multiline /><Text style={styles.label}>Activity type</Text><View style={styles.options}>{[['classwork', 'Classwork'], ['test', 'Test'], ['assignment', 'Assignment']].map(([value, label]) => <Button key={value} title={label} secondary={activity.activity_type !== value} onPress={() => setActivity({ ...activity, activity_type: value })} />)}</View><Field label="Time limit in minutes (optional)" value={activity.time_limit_minutes} onChangeText={(v) => setActivity({ ...activity, time_limit_minutes: v.replace(/\D/g, '').slice(0, 4) })} keyboardType="number-pad" /><Text style={styles.label}>Assign classes</Text>{data.classes.filter((item) => item.status === 'active').map((item) => <Pressable key={item.id} onPress={() => toggle(selectedClasses, setSelectedClasses, item.id)} style={[styles.choice, selectedClasses.includes(item.id) && styles.selected]}><Text style={styles.name}>{selectedClasses.includes(item.id) ? '✓ ' : ''}{item.class_name} · {item.academic_session}</Text></Pressable>)}<Text style={styles.label}>Include published questions</Text>{data.questions.filter((item) => item.status === 'published').map((item) => <Pressable key={item.id} onPress={() => toggle(selectedQuestions, setSelectedQuestions, item.id)} style={[styles.choice, selectedQuestions.includes(item.id) && styles.selected]}><Text numberOfLines={3} style={styles.name}>{selectedQuestions.includes(item.id) ? '✓ ' : ''}{item.question_text}</Text></Pressable>)}<Button title={busy ? 'Publishing…' : 'Publish activity'} disabled={busy || !activity.title.trim() || !selectedClasses.length || !selectedQuestions.length} onPress={() => void createActivity()} /></Card>
  </>}<Button title="Refresh learning content" secondary onPress={() => void load()} /></Screen>;
}

const styles = StyleSheet.create({ title: { color: colors.ink, fontSize: 19, fontWeight: '900' }, label: { color: colors.ink, fontSize: 14, fontWeight: '800' }, listItem: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 11 }, grow: { flex: 1 }, name: { color: colors.ink, fontWeight: '700', lineHeight: 21 }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, choice: { borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', borderRadius: 12, padding: 12 }, selected: { borderColor: colors.teal, backgroundColor: colors.mint } });

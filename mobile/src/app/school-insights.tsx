import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { Button, Card, Field, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Report = { activities?: { id: string; title?: string; name?: string; status?: string; question_count?: number; class_ids?: string[] }[]; classes?: { id: string; name: string; status?: string }[]; attempts?: { id: string; student_id?: string; activity_id?: string; student_name?: string; score?: number; max_score?: number; percentage?: number; submitted_at?: string }[]; students?: { id: string; name?: string; admission_number?: string; student_id?: string; class_id?: string | null; status?: string }[]; starts?: { activity_id: string; student_id: string; started_at?: string }[]; builtInQuizSessions?: { id: string; student_id: string; level: number; score: number; questions_answered: number; correct_answers: number; started_at?: string; completed_at?: string; accuracy_percentage?: number; track?: string }[]; builtInQuizQuestionAttempts?: { id: string; student_id: string; is_correct: boolean; xp_earned: number; answered_at: string }[] };
type Leaderboard = { month: string; summary: { total_students: number; total_classes: number; total_xp: number; monthly_xp: number }; overall_leaderboard: { rank: number; student_name: string; student_code: string; class_name: string; total_xp: number; monthly_xp: number }[]; classes: { class_id: string; class_name: string; academic_session: string | null; student_count: number; leaderboard: { rank: number; student_name: string; total_xp: number; monthly_xp: number }[] }[] };
type Section = 'reports' | 'leaderboard';

export default function SchoolInsightsScreen() {
  const [section, setSection] = useState<Section>('reports');
  const [classId, setClassId] = useState('all');
  const [report, setReport] = useState<Report | null>(null);
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sign in as a school administrator to view reports.');
      if (section === 'reports') {
        const result = await apiRequest<Report>('/api/schools/admin-reports', { token: session.access_token });
        setReport(result);
      } else {
        const result = await apiRequest<Leaderboard>(`/api/schools/leaderboard?month=${encodeURIComponent(month)}`, { token: session.access_token });
        setLeaderboard(result);
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load school insights.'); }
    finally { setLoading(false); }
  }, [month, section]);
  useEffect(() => { void load(); }, [load]);
  const studentsInClass = (report?.students || []).filter((student) => student.status === 'active' && (classId === 'all' || student.class_id === classId));
  const visibleStudentIds = new Set(studentsInClass.map((student) => student.id));
  const visibleAttempts = (report?.attempts || []).filter((attempt) => !attempt.student_id || visibleStudentIds.has(attempt.student_id));
  const visibleQuizSessions = (report?.builtInQuizSessions || []).filter((attempt) => visibleStudentIds.has(attempt.student_id));
  async function exportReport() {
    const activityRows = visibleAttempts.map((attempt) => [
      'School activity',
      attempt.student_name || report?.students?.find((student) => student.id === attempt.student_id)?.name || 'Student',
      report?.activities?.find((activity) => activity.id === attempt.activity_id)?.title || 'School activity',
      attempt.score ?? '',
      attempt.max_score ?? '',
      attempt.percentage ?? '',
      attempt.submitted_at || '',
    ]);
    const quizRows = visibleQuizSessions.map((attempt) => [
      'Built-in quiz',
      report?.students?.find((student) => student.id === attempt.student_id)?.name || 'Student',
      'Level ' + attempt.level + (attempt.track ? ' · ' + attempt.track : ''),
      attempt.score ?? '',
      attempt.questions_answered ?? '',
      attempt.accuracy_percentage ?? '',
      attempt.completed_at || attempt.started_at || '',
    ]);
    const rows = [['Source', 'Student', 'Activity', 'Score', 'Maximum / Questions', 'Percentage', 'Date'], ...activityRows, ...quizRows];
    const csv = rows.map((row) => row.map((cell) => {
      const value = String(cell ?? '');
      return /[",\n\r]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
    }).join(',')).join('\n');
    try {
      const file = new File(Paths.cache, 'sahaba-quest-school-report-' + new Date().toISOString().slice(0, 10) + '.csv');
      await file.write(csv);
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
      await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export school learning report' });
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to export the report.'); }
  }
  return <Screen>
    <Heading title="School learning insights" subtitle="Live activity results and student rankings from your school account." />
    <View style={styles.switcher}><Button title="Activity reports" secondary={section !== 'reports'} onPress={() => setSection('reports')} /><Button title="Leaderboard" secondary={section !== 'leaderboard'} onPress={() => setSection('leaderboard')} /></View>
    {section === 'leaderboard' ? <Field label="Month (YYYY-MM)" value={month} onChangeText={setMonth} placeholder="2026-11" /> : null}
    {section === 'reports' ? <><Text style={styles.title}>Filter by class</Text><View style={styles.switcher}><Button title="All classes" secondary={classId !== 'all'} onPress={() => setClassId('all')} />{(report?.classes || []).map((schoolClass) => <Button key={schoolClass.id} title={schoolClass.name} secondary={classId !== schoolClass.id} onPress={() => setClassId(schoolClass.id)} />)}</View></> : null}
    <Notice message={message} />
    {loading ? <ActivityIndicator color={colors.teal} /> : section === 'reports' ? <>
      <Card><Text style={styles.title}>Assigned activities</Text>{report?.activities?.length ? report.activities.map((item) => <View key={item.id} style={styles.row}><Text style={styles.name}>{item.title || item.name || 'Activity'}</Text><Text style={uiStyles.smallMuted}>{item.status || '—'} · {item.question_count ?? 0} questions</Text></View>) : <Text style={uiStyles.smallMuted}>No assigned activities were returned for this school.</Text>}</Card>
      <View style={styles.stats}><Card style={styles.stat}><Text style={uiStyles.statValue}>{studentsInClass.length}</Text><Text style={uiStyles.statLabel}>Active students</Text></Card><Card style={styles.stat}><Text style={uiStyles.statValue}>{visibleAttempts.length}</Text><Text style={uiStyles.statLabel}>Activity submissions</Text></Card><Card style={styles.stat}><Text style={uiStyles.statValue}>{visibleQuizSessions.length}</Text><Text style={uiStyles.statLabel}>Quiz sessions</Text></Card></View>
      <Card><Text style={styles.title}>Recent activity submissions</Text>{visibleAttempts.length ? visibleAttempts.slice(0, 100).map((attempt) => <View key={attempt.id} style={styles.row}><Text style={styles.name}>{attempt.student_name || report?.students?.find((student) => student.id === attempt.student_id)?.name || 'Student'}</Text><Text style={uiStyles.smallMuted}>{report?.activities?.find((activity) => activity.id === attempt.activity_id)?.title || 'School activity'}</Text><Text style={uiStyles.smallMuted}>{attempt.score ?? 0}/{attempt.max_score ?? 0} · {attempt.percentage ?? 0}% · {attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleDateString() : ''}</Text></View>) : <Text style={uiStyles.smallMuted}>No activity submissions have been recorded for this class.</Text>}</Card>
      <Card><Text style={styles.title}>Built-in quiz sessions</Text>{visibleQuizSessions.length ? visibleQuizSessions.slice(0, 100).map((attempt) => <View key={attempt.id} style={styles.row}><Text style={styles.name}>{report?.students?.find((student) => student.id === attempt.student_id)?.name || 'Student'} · Level {attempt.level}</Text><Text style={uiStyles.smallMuted}>{attempt.correct_answers}/{attempt.questions_answered} correct · {attempt.questions_answered ? Math.round(attempt.correct_answers / attempt.questions_answered * 100) : 0}% · {attempt.completed_at ? new Date(attempt.completed_at).toLocaleDateString() : 'In progress'}</Text></View>) : <Text style={uiStyles.smallMuted}>No built-in quiz sessions have been recorded for this class.</Text>}</Card>
      <Button title="Export filtered report as CSV" secondary onPress={() => void exportReport()} />
    </> : leaderboard ? <>
      <View style={styles.stats}>{[[leaderboard.summary.total_students, 'Active students'], [leaderboard.summary.total_classes, 'Classes'], [leaderboard.summary.monthly_xp, 'XP this month']].map(([value, label]) => <Card key={String(label)} style={styles.stat}><Text style={uiStyles.statValue}>{value}</Text><Text style={uiStyles.statLabel}>{label}</Text></Card>)}</View>
      <Card><Text style={styles.title}>School rankings · {leaderboard.month}</Text>{leaderboard.overall_leaderboard.map((student) => <View key={student.student_code} style={styles.rankRow}><Text style={styles.rank}>#{student.rank}</Text><View style={styles.grow}><Text style={styles.name}>{student.student_name}</Text><Text style={uiStyles.smallMuted}>{student.student_code} · {student.class_name}</Text></View><Text style={styles.xp}>{student.monthly_xp} XP</Text></View>)}</Card>
      {leaderboard.classes.map((schoolClass) => <Card key={schoolClass.class_id}><Text style={styles.title}>{schoolClass.class_name} · {schoolClass.academic_session || 'Class ranking'}</Text>{schoolClass.leaderboard.map((student) => <View key={`${schoolClass.class_id}-${student.rank}`} style={styles.rankRow}><Text style={styles.rank}>#{student.rank}</Text><Text style={[styles.name, styles.grow]}>{student.student_name}</Text><Text style={styles.xp}>{student.total_xp} XP</Text></View>)}</Card>)}
    </> : <Card><Text style={uiStyles.smallMuted}>No report data is available.</Text></Card>}
    <Button title="Refresh insights" secondary onPress={() => void load()} />
  </Screen>;
}

const styles = StyleSheet.create({ switcher: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, title: { color: colors.ink, fontSize: 18, fontWeight: '900' }, row: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 10, gap: 3 }, name: { color: colors.ink, fontWeight: '800' }, stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, stat: { flex: 1, minWidth: 95, alignItems: 'center', paddingHorizontal: 8 }, rankRow: { flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 10 }, rank: { color: colors.teal, fontWeight: '900', width: 30 }, grow: { flex: 1 }, xp: { color: colors.teal, fontWeight: '900' } });

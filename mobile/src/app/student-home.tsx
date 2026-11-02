import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { clearStudentSession, getStudentSession } from '@/lib/secure-sessions';
import { colors } from '@/lib/theme';

type StudentDashboard = {
  student: { id: string; student_id: string; first_name: string; last_name: string };
  school: { school_name: string; school_code: string };
  class: { class_name: string; academic_session: string | null } | null;
  progress: { current_level: number; total_xp: number; questions_answered: number; correct_answers: number; current_streak: number; best_streak: number };
};
type Activity = { id: string; title?: string; activity_type?: string; due_at?: string | null; status?: string };
type StudentLeader = { rank: number; student_name: string; monthly_xp: number; is_current_student: boolean };

export default function StudentHomeScreen() {
  const [dashboard, setDashboard] = useState<StudentDashboard | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [leaders, setLeaders] = useState<StudentLeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [studentToken, setStudentToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setMessage('');
    const session = await getStudentSession();
    if (!session) { setStudentToken(null); setLoading(false); return; }
    setStudentToken(session.token);
    try {
      const [data, activityData] = await Promise.all([
        apiRequest<StudentDashboard & { success: boolean }>('/api/schools/student-dashboard', { token: session.token }),
        apiRequest<{ activities?: Activity[] }>('/api/schools/student-activities', { token: session.token }),
      ]);
      setDashboard(data);
      setActivities(activityData.activities || []);
      try {
        const ranking = await apiRequest<{ leaderboard?: StudentLeader[] }>('/api/schools/students/student-leaderboard', { token: session.token });
        setLeaders(ranking.leaderboard || []);
      } catch { setLeaders([]); }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load your student dashboard.');
      if ((error as { status?: number })?.status === 401) {
        await clearStudentSession();
        setStudentToken(null);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function logout() {
    setBusy(true);
    try {
      if (studentToken) await apiRequest('/api/schools/student-auth/logout', { method: 'POST', token: studentToken });
    } catch { /* Local credentials are still cleared if the device is offline. */ }
    await clearStudentSession();
    setStudentToken(null);
    setBusy(false);
    router.replace('/student-sign-in');
  }

  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.teal} /></View>;
  if (!studentToken) return <Redirect href="/student-sign-in" />;

  const progress = dashboard?.progress;
  const accuracy = progress?.questions_answered ? Math.round((progress.correct_answers / progress.questions_answered) * 100) : 0;
  return <Screen>
    <View style={styles.topRow}><Text style={styles.brand}>Sahaba Quest · Schools & Madrasas</Text><Button title="Sign out" secondary onPress={() => void logout()} disabled={busy} /></View>
    <Heading title={`Assalamu Alaikum, ${dashboard?.student.first_name || 'Student'}`} subtitle="May Allah increase you in beneficial knowledge. Keep learning, keep growing, and keep your quest moving forward." />
    <Notice message={message} />
    {dashboard ? <>
      <Card style={styles.hero}>
        <Text style={styles.eyebrow}>YOUR LEARNING JOURNEY</Text>
        <Text style={styles.heroTitle}>{dashboard.school.school_name}</Text>
        <Text style={styles.heroText}>{dashboard.class?.class_name || 'Student'} · Level {progress?.current_level || 1}</Text>
      </Card>
      <View style={styles.grid}>
        <Card style={styles.stat}><Text style={uiStyles.statValue}>{progress?.total_xp || 0}</Text><Text style={uiStyles.statLabel}>Total XP</Text></Card>
        <Card style={styles.stat}><Text style={uiStyles.statValue}>{progress?.current_streak || 0}</Text><Text style={uiStyles.statLabel}>Current streak</Text></Card>
        <Card style={styles.stat}><Text style={uiStyles.statValue}>{accuracy}%</Text><Text style={uiStyles.statLabel}>Accuracy</Text></Card>
        <Card style={styles.stat}><Text style={uiStyles.statValue}>{progress?.best_streak || 0}</Text><Text style={uiStyles.statLabel}>Best streak</Text></Card>
      </View>
      <Card>
        <Text style={styles.sectionTitle}>Continue your journey</Text>
        <Text style={uiStyles.smallMuted}>Your level and progress are managed by your school's Sahaba Quest learning system.</Text>
        <Button title="Start your Student Quest →" onPress={() => router.push('/student-quest')} />
      </Card>
      <Card>
        <Text style={styles.sectionTitle}>My School Activities</Text>
        <Text style={uiStyles.smallMuted}>Classwork, tests, and assignments published for your class.</Text>
        {activities.length ? activities.map((activity) => <View key={activity.id} style={styles.activity}>
          <Text style={styles.activityType}>{(activity.activity_type || 'ACTIVITY').toUpperCase()}</Text>
          <Text style={styles.activityTitle}>{activity.title || 'School activity'}</Text>
          {activity.due_at ? <Text style={uiStyles.smallMuted}>Due {new Date(activity.due_at).toLocaleString()}</Text> : null}
          <Button title="View activity →" secondary onPress={() => router.push({ pathname: '/student-activity/[id]', params: { id: activity.id } })} />
        </View>) : <Text style={uiStyles.smallMuted}>No activities have been assigned to you yet.</Text>}
      </Card>
      {leaders.length ? <Card><Text style={styles.sectionTitle}>Your class leaderboard</Text>{leaders.slice(0, 5).map((leader) => <View key={`${leader.rank}-${leader.student_name}`} style={styles.leader}><Text style={styles.rank}>#{leader.rank}</Text><Text style={styles.leaderName}>{leader.student_name}{leader.is_current_student ? ' · You' : ''}</Text><Text style={styles.leaderXp}>{leader.monthly_xp.toLocaleString()} XP</Text></View>)}</Card> : null}
    </> : <Text style={uiStyles.smallMuted}>The student dashboard did not return your account data.</Text>}
  </Screen>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  brand: { flex: 1, color: colors.teal, fontSize: 13, fontWeight: '800' },
  hero: { backgroundColor: colors.tealDark, borderColor: colors.tealDark },
  eyebrow: { color: '#B6F3E9', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  heroTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  heroText: { color: '#E0F5F1', fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexGrow: 1, flexBasis: '46%', alignItems: 'center' },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '800' },
  activity: { gap: 7, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  activityType: { color: colors.teal, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  activityTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  leader: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 9 },
  rank: { width: 28, color: colors.teal, fontWeight: '900' },
  leaderName: { flex: 1, color: colors.ink, fontWeight: '700' },
  leaderXp: { color: colors.teal, fontWeight: '900' },
});

import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Field, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { clearFamilyMemberSession } from '@/lib/secure-sessions';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Member = { member_id: string; display_name: string; total_xp?: number; current_level?: number; questions_answered?: number; correct_answers?: number; accuracy?: number; current_streak?: number; best_streak?: number; status?: string; is_active?: boolean };
type Progress = { current_level: number; total_xp: number; questions_answered: number; correct_answers: number; current_streak: number; best_streak: number };

export default function FamilyOwnerHomeScreen() {
  const { session, loading: authLoading } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [plan, setPlan] = useState<{ plan_type: string; status: string; current_period_end: string | null } | null>(null);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: profile } = await supabase.from('profiles').select('account_type, display_name').eq('id', user.id).maybeSingle();
    if (profile?.account_type !== 'family') { setMessage('This account is not a Family Account.'); setLoading(false); return; }
    const [membersResult, progressResult, planResult] = await Promise.all([
      supabase.rpc('get_family_members_for_owner'),
      supabase.from('family_player_progress').select('current_level, total_xp, questions_answered, correct_answers, current_streak, best_streak').eq('user_id', user.id).maybeSingle(),
      supabase.from('subscriptions').select('plan_type, status, current_period_end').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (membersResult.error) setMessage(membersResult.error.message);
    else setMembers(Array.isArray(membersResult.data) ? membersResult.data as Member[] : []);
    if (progressResult.error) setMessage(progressResult.error.message);
    else setProgress(progressResult.data);
    if (!planResult.error) setPlan(planResult.data);
    setLoading(false);
  }, []);

  useEffect(() => { if (!authLoading && session) void load(); else if (!authLoading) setLoading(false); }, [authLoading, session, load]);

  async function addMember() {
    const cleanName = name.trim();
    if (!cleanName) { setMessage('Enter a name for the family member.'); return; }
    if (!/^\d{4}$/.test(pin)) { setMessage('PIN must be exactly 4 digits.'); return; }
    if (pin !== confirmPin) { setMessage('The PINs do not match.'); return; }
    if (members.length >= 5) { setMessage('You can add a maximum of 5 family members.'); return; }
    setBusy(true); setMessage('');
    const { error } = await supabase.rpc('create_family_member', { p_display_name: cleanName, p_pin: pin });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    setName(''); setPin(''); setConfirmPin(''); setMessage(`${cleanName} has been added. Keep their 4-digit PIN private.`);
    await load();
  }

  async function saveMemberName(memberId: string) {
    const cleanName = editingName.trim();
    if (!cleanName) { setMessage('Enter a name for the family member.'); return; }
    setBusy(true);
    const { error } = await supabase.rpc('update_family_member_name', { p_member_id: memberId, p_display_name: cleanName });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    setEditingId(null); setEditingName(''); setMessage('Family member name updated.');
    await load();
  }

  function deleteMember(member: Member) {
    Alert.alert('Delete family member?', `${member.display_name} and their separate learning progress will be permanently removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { void (async () => {
        setBusy(true);
        const { error } = await supabase.rpc('delete_family_member', { p_member_id: member.member_id });
        setBusy(false);
        if (error) setMessage(error.message);
        else { setMessage(`${member.display_name} was deleted.`); await load(); }
      })(); } },
    ]);
  }

  async function signOut() { await Promise.all([clearFamilyMemberSession(), supabase.auth.signOut()]); router.replace('/account-access'); }
  if (authLoading || loading) return <View style={styles.loading}><ActivityIndicator color={colors.teal} /></View>;
  if (!session) return <Redirect href="/sign-in" />;
  if (!progress && !message) return <Redirect href="/(tabs)" />;

  return <Screen>
    <View style={styles.header}><Text style={styles.brand}>Sahaba Quest · Family</Text><Button title="Sign out" secondary onPress={() => void signOut()} /></View>
    <Heading title="Your Family Quest" subtitle="Learn together, track your family's progress, and manage family member profiles." />
    <Notice message={message} />
    <Card style={styles.hero}><Text style={styles.kicker}>FAMILY ACCOUNT</Text><Text style={styles.heroTitle}>Family Level {progress?.current_level || 1}</Text><Text style={styles.heroXp}>{(progress?.total_xp || 0).toLocaleString()} XP</Text><Text style={styles.heroSubtitle}>{plan?.status === 'active' ? 'Family subscription active' : 'Family account access'}</Text></Card>
    <Card><Text style={styles.sectionTitle}>Family learning</Text><Text style={uiStyles.smallMuted}>Each member keeps a separate profile, PIN, quest history, and progress record.</Text><Button title="Family Challenge Arena →" onPress={() => router.push('/family-challenges')} /><Button title="Family leaderboard →" secondary onPress={() => router.push('/family-ranking')} /><Button title="Manage family plan →" secondary onPress={() => router.push('/pricing')} /><Button title="Choose a family member" secondary onPress={() => router.push('/family-member-sign-in')} /></Card>
    <View style={styles.grid}>
      <Card style={styles.stat}><Text style={uiStyles.statValue}>{progress?.current_level || 1}</Text><Text style={uiStyles.statLabel}>Current level</Text></Card>
      <Card style={styles.stat}><Text style={uiStyles.statValue}>{progress?.current_streak || 0}</Text><Text style={uiStyles.statLabel}>Current streak</Text></Card>
      <Card style={styles.stat}><Text style={uiStyles.statValue}>{progress?.questions_answered || 0}</Text><Text style={uiStyles.statLabel}>Questions</Text></Card>
      <Card style={styles.stat}><Text style={uiStyles.statValue}>{members.length} / 5</Text><Text style={uiStyles.statLabel}>Family members</Text></Card>
    </View>
    <Card>
      <Text style={styles.sectionTitle}>Add a member</Text>
      <Text style={uiStyles.smallMuted}>Create a profile and private 4-digit PIN. Family members keep their own progress.</Text>
      <Field label="Member name" value={name} onChangeText={setName} maxLength={50} autoCapitalize="words" editable={members.length < 5 && !busy} />
      <Field label="4-digit PIN" value={pin} onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" secureTextEntry maxLength={4} editable={members.length < 5 && !busy} />
      <Field label="Confirm PIN" value={confirmPin} onChangeText={(value) => setConfirmPin(value.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" secureTextEntry maxLength={4} editable={members.length < 5 && !busy} />
      <Button title={members.length >= 5 ? '5 members added' : 'Add family member'} onPress={() => void addMember()} disabled={busy || members.length >= 5} />
    </Card>
    <Card>
      <View style={styles.memberHeading}><Text style={styles.sectionTitle}>Your members</Text><Button title="Member login →" secondary onPress={() => router.push('/family-member-sign-in')} /></View>
      {members.length ? members.map((member) => <View key={member.member_id} style={styles.memberRow}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{member.display_name.slice(0, 1).toUpperCase()}</Text></View>
      <View style={styles.memberCopy}>
          {editingId === member.member_id ? <><Field label="Member name" value={editingName} onChangeText={setEditingName} maxLength={50} /><Button title="Save name" onPress={() => void saveMemberName(member.member_id)} disabled={busy} /></> : <><Text style={styles.memberName}>{member.display_name}</Text><Text style={uiStyles.smallMuted}>Level {member.current_level || 1} · {(member.total_xp || 0).toLocaleString()} XP</Text><Text style={uiStyles.smallMuted}>{member.questions_answered || 0} questions · {member.correct_answers || 0} correct · {Math.round(Number(member.accuracy || 0))}% accuracy</Text><View style={styles.memberActions}><Button title="✏️ Edit name" secondary onPress={() => { setEditingId(member.member_id); setEditingName(member.display_name); }} /><Button title="Delete" secondary onPress={() => deleteMember(member)} disabled={busy} /></View></>}
        </View>
        <Text style={styles.active}>Active</Text>
      </View>) : <Text style={uiStyles.smallMuted}>Add your first family member to get started.</Text>}
      {plan?.current_period_end ? <Text style={uiStyles.smallMuted}>Subscription active until {new Date(plan.current_period_end).toLocaleDateString()}</Text> : null}
    </Card>
  </Screen>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  brand: { color: colors.teal, fontSize: 13, fontWeight: '900' },
  hero: { backgroundColor: colors.tealDark, borderColor: colors.tealDark },
  kicker: { color: '#B6F3E9', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { color: '#fff', fontSize: 23, fontWeight: '900' },
  heroXp: { color: '#fff', fontSize: 28, fontWeight: '900' },
  heroSubtitle: { color: '#E0F5F1', fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexGrow: 1, flexBasis: '46%', alignItems: 'center' },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' },
  memberHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  memberRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderColor: colors.border },
  avatar: { height: 40, width: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.mint },
  avatarText: { color: colors.teal, fontWeight: '900', fontSize: 16 },
  memberCopy: { flex: 1 },
  memberName: { color: colors.ink, fontWeight: '800' },
  active: { color: colors.success, fontSize: 12, fontWeight: '800' },
  memberActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
});

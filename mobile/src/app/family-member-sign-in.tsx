import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Field, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { saveFamilyMemberSession } from '@/lib/secure-sessions';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { colors } from '@/lib/theme';

type FamilyMember = { member_id: string; display_name: string };

export default function FamilyMemberSignInScreen() {
  const { session, loading: authLoading } = useAuth();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [selected, setSelected] = useState<FamilyMember | null>(null);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    if (authLoading) return () => { active = false; };
    if (!session) { setLoading(false); return () => { active = false; }; }
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setMessage('Sign in with your family owner account first.'); setLoading(false); return; }
      const { data: profile } = await supabase.from('profiles').select('account_type').eq('id', user.id).maybeSingle();
      if (profile?.account_type !== 'family') { setMessage('The signed-in account is not a Family Account. Sign out and choose the family owner login.'); setLoading(false); return; }
      const { data, error } = await supabase.rpc('get_family_members_for_login');
      if (!active) return;
      if (error) setMessage(error.message);
      else setMembers(Array.isArray(data) ? data as FamilyMember[] : []);
      setLoading(false);
    })().catch((error) => { if (active) { setMessage(error instanceof Error ? error.message : 'Could not load family members.'); setLoading(false); } });
    return () => { active = false; };
  }, [session, authLoading]);

  async function continueAsMember() {
    if (!selected) { setMessage('Select a family member first.'); return; }
    if (!/^\d{4}$/.test(pin)) { setMessage('Enter the 4-digit PIN for this family member.'); return; }
    setBusy(true); setMessage('');
    const { data, error } = await supabase.rpc('verify_family_member_pin', { p_member_id: selected.member_id, p_pin: pin });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    const result = Array.isArray(data) ? data[0] : null;
    if (!result?.session_token) { setMessage('Family member verification did not return a valid session.'); return; }
    await saveFamilyMemberSession(result.session_token);
    setPin('');
    router.replace('/family-member-home');
  }

  if (authLoading || loading) return <View style={styles.loading}><ActivityIndicator color={colors.teal} /></View>;
  if (!session) return <Redirect href="/family-access" />;

  return <Screen>
    <Button title="← Family access" secondary onPress={() => router.replace('/family-access')} />
    <Heading title={selected ? `Welcome, ${selected.display_name}` : 'Who is playing?'} subtitle={selected ? 'Enter your private 4-digit PIN to continue.' : 'Select a Family Member to continue your Sahaba Quest.'} />
    <Notice message={message} />
    {selected ? <>
      <Field label="4-digit PIN" value={pin} onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" secureTextEntry maxLength={4} />
      <Button title="Continue to Family Quest →" onPress={() => void continueAsMember()} disabled={busy} />
      <Button title="Choose another member" secondary onPress={() => { setSelected(null); setPin(''); setMessage(''); }} />
    </> : <Card>
      <Text style={styles.listTitle}>Select your profile</Text>
      {members.length ? members.map((member) => <Pressable key={member.member_id} onPress={() => { setSelected(member); setMessage(''); }} style={({ pressed }) => [styles.member, pressed && styles.pressed]}>
        <View style={styles.avatar}><Text style={styles.initial}>{member.display_name.slice(0, 1).toUpperCase()}</Text></View>
        <View style={styles.memberCopy}><Text style={styles.memberName}>{member.display_name}</Text><Text style={uiStyles.smallMuted}>Family Member</Text></View>
        <Text style={styles.arrow}>→</Text>
      </Pressable>) : <Text style={uiStyles.smallMuted}>No active family members are available.</Text>}
    </Card>}
  </Screen>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  listTitle: { color: colors.ink, fontSize: 19, fontWeight: '800' },
  member: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  pressed: { backgroundColor: colors.mint },
  avatar: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mint },
  initial: { color: colors.teal, fontSize: 17, fontWeight: '900' },
  memberCopy: { flex: 1 },
  memberName: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  arrow: { color: colors.teal, fontSize: 21, fontWeight: '800' },
});
